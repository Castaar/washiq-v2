import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IntegrationDay, SiteIntegration } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { canManageSite } from '@/lib/permissions';
import { addDays, brusselsDay, daysBetween, fillMissingDays } from '@/lib/integrations';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/integrations/prefill?siteId=&from=YYYY-MM-DD&to=YYYY-MM-DD
// Sums the stored days after `from` up to and including `to` (the ingave period):
// wagens per Glosiv program (MyCarwash) and liters of water (Shayp).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const sp = req.nextUrl.searchParams;
  const siteId = sp.get('siteId') ?? '';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  if (!session || !canManageSite(session, siteId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!DAY.test(from) || !DAY.test(to) || from >= to) return NextResponse.json({ error: 'Ongeldige periode' }, { status: 400 });
  await dbConnect();

  const links = await SiteIntegration.find({ site_id: siteId, enabled: true, external_id: { $ne: '' } }).lean();
  if (links.length === 0) return NextResponse.json({});

  const wanted = daysBetween(from, to);
  const yesterday = addDays(brusselsDay(new Date()), -1);
  const out: Record<string, unknown> = {};
  for (const l of links) {
    const provider = l.provider as string;
    let error = '';
    try {
      await fillMissingDays(l as never, from, to);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    let days = await IntegrationDay.find({ site_id: siteId, provider, date: { $in: wanted } }).lean();
    if (provider === 'shayp') {
      // Before the meter was installed Shayp reports 0 L, which is "not measured", not
      // "no water used": days before the first measured day count as missing.
      const first = await IntegrationDay.findOne({ site_id: siteId, provider, water_liters: { $gt: 0 } }).sort({ date: 1 }).select('date').lean();
      const firstDay = (first?.date as string | undefined) ?? '9999-12-31';
      days = days.filter((d) => (d.date as string) >= firstDay);
    }
    const have = new Set(days.map((d) => d.date as string));
    // Days still missing (today, or a failed fetch) make the figure incomplete
    const missingDays = wanted.filter((d) => !have.has(d));
    const base = { days: days.length, totalDays: wanted.length, missingDays, includesToday: to > yesterday, error, source: (l.external_name as string) || '' };

    if (provider === 'mycarwash') {
      const map = new Map(((l.program_map as { number: number; program_id: unknown }[]) ?? []).filter((m) => m.program_id).map((m) => [m.number, String(m.program_id)]));
      const perProgram = new Map<string, number>([...new Set(map.values())].map((pid) => [pid, 0]));
      const unmapped = new Map<number, { name: string; count: number }>();
      for (const d of days) {
        for (const c of (d.counters as { number: number; name: string; controller: number; pos: number }[]) ?? []) {
          // Washes counted by the wash controller; when it reports nothing (not connected),
          // fall back to the transactions the till (POS) counted for that program.
          const n = c.controller || c.pos || 0;
          const pid = map.get(c.number);
          if (pid) perProgram.set(pid, (perProgram.get(pid) ?? 0) + n);
          else if (n) unmapped.set(c.number, { name: c.name, count: (unmapped.get(c.number)?.count ?? 0) + n });
        }
      }
      out.mycarwash = {
        ...base,
        programCounts: Object.fromEntries(perProgram),
        unmapped: [...unmapped].map(([number, v]) => ({ number, ...v })),
      };
    } else {
      out.shayp = { ...base, liters: days.reduce((s, d) => s + ((d.water_liters as number) ?? 0), 0) };
    }
  }
  return NextResponse.json(out);
}
