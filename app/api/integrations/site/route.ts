import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db/mongoose';
import { IntegrationConnection, IntegrationDay, SiteIntegration, WashProgram, type IntegrationProvider } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { canManageSite } from '@/lib/permissions';
import { addDays, brusselsDay, canUseConnection, fillMissingDays, PROVIDERS } from '@/lib/integrations';

function linkJson(l: Record<string, unknown>) {
  return {
    provider: l.provider as IntegrationProvider,
    connectionId: String(l.connection_id),
    enabled: l.enabled !== false,
    externalId: (l.external_id as string) ?? '',
    externalName: (l.external_name as string) ?? '',
    programMap: ((l.program_map as { number: number; name: string; program_id: unknown }[]) ?? []).map((m) => ({
      number: m.number, name: m.name ?? '', programId: m.program_id ? String(m.program_id) : '',
    })),
    lastSyncedAt: l.last_synced_at ? (l.last_synced_at as Date).toISOString() : null,
    lastError: (l.last_error as string) ?? '',
  };
}

// GET /api/integrations/site?siteId= — this carwash's links + program numbers seen so far
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const siteId = req.nextUrl.searchParams.get('siteId') ?? '';
  if (!session || !canManageSite(session, siteId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await dbConnect();
  const [links, days] = await Promise.all([
    SiteIntegration.find({ site_id: siteId }).lean(),
    IntegrationDay.find({ site_id: siteId, provider: 'mycarwash', date: { $gte: addDays(brusselsDay(new Date()), -60) } }).select('counters date').sort({ date: -1 }).lean(),
  ]);
  const seen = new Map<number, string>();
  for (const d of days) for (const c of (d.counters as { number: number; name: string }[]) ?? []) if (!seen.has(c.number)) seen.set(c.number, c.name);
  return NextResponse.json({
    links: links.map((l) => linkJson(l as unknown as Record<string, unknown>)),
    seenPrograms: [...seen].map(([number, name]) => ({ number, name })).sort((a, b) => a.number - b.number),
    lastDay: days[0]?.date ?? null,
  });
}

// PUT /api/integrations/site — turn a provider on/off for this carwash
// body: { siteId, provider, connectionId, externalId, externalName, enabled, programMap }
export async function PUT(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const body = (await req.json()) as {
    siteId?: string; provider?: string; connectionId?: string; externalId?: string; externalName?: string;
    enabled?: boolean; programMap?: { number: number; name?: string; programId?: string }[];
  };
  const siteId = body.siteId ?? '';
  if (!session || !canManageSite(session, siteId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const provider = body.provider as IntegrationProvider;
  if (!PROVIDERS.includes(provider)) return NextResponse.json({ error: 'Onbekend type koppeling' }, { status: 400 });
  await dbConnect();

  if (!body.connectionId) {
    await SiteIntegration.deleteOne({ site_id: siteId, provider });
    return NextResponse.json({ ok: true, link: null });
  }
  if (!mongoose.isValidObjectId(body.connectionId) || !(await canUseConnection(session, body.connectionId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const conn = await IntegrationConnection.findById(body.connectionId).select('provider').lean();
  if (!conn || (conn as { provider?: string }).provider !== provider) return NextResponse.json({ error: 'Koppeling past niet' }, { status: 400 });

  // Program numbers may only point at this carwash's own programs
  const programIds = new Set((await WashProgram.find({ site_id: siteId }).select('_id').lean()).map((p) => String(p._id)));
  const programMap = (body.programMap ?? [])
    .filter((m) => Number.isFinite(Number(m.number)))
    .map((m) => ({ number: Number(m.number), name: (m.name ?? '').slice(0, 80), program_id: m.programId && programIds.has(m.programId) ? m.programId : null }));

  const link = await SiteIntegration.findOneAndUpdate(
    { site_id: siteId, provider },
    {
      $set: {
        connection_id: body.connectionId,
        external_id: (body.externalId ?? '').trim(),
        external_name: (body.externalName ?? '').trim(),
        enabled: body.enabled !== false,
        ...(provider === 'mycarwash' ? { program_map: programMap } : {}),
      },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true, new: true },
  ).lean();

  // First fetch of the last two months, so the next ingave can be prefilled right away
  let syncError = '';
  if (link && (link as { enabled?: boolean }).enabled !== false && (link as { external_id?: string }).external_id) {
    try {
      await fillMissingDays(link as never, addDays(brusselsDay(new Date()), -62), brusselsDay(new Date()));
    } catch (err) {
      syncError = err instanceof Error ? err.message : String(err);
    }
  }
  const fresh = await SiteIntegration.findOne({ site_id: siteId, provider }).lean();
  return NextResponse.json({ ok: true, link: fresh ? linkJson(fresh as unknown as Record<string, unknown>) : null, syncError });
}
