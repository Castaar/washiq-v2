import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IntegrationConnection } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { isManager } from '@/lib/permissions';
import { seal } from '@/lib/secret-box';
import { discoverTargets, publicConnection, visibleConnectionIds, PROVIDERS, SHAYP_DEFAULT_URL } from '@/lib/integrations';
import type { IntegrationProvider } from '@/lib/models';

// GET /api/integrations/connections — connections this owner may use (no secrets)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !isManager(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await dbConnect();
  const ids = await visibleConnectionIds(session);
  const docs = await IntegrationConnection.find(ids === null ? {} : { _id: { $in: ids } }).sort({ created_at: 1 }).lean();
  return NextResponse.json(docs.map((d) => publicConnection(d as Parameters<typeof publicConnection>[0])));
}

// POST /api/integrations/connections — add a connection; it is tested before it is saved
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !isManager(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json()) as {
    provider?: string; label?: string; baseUrl?: string; username?: string; customerId?: string; secret?: string;
  };
  const provider = body.provider as IntegrationProvider;
  if (!PROVIDERS.includes(provider)) return NextResponse.json({ error: 'Onbekend type koppeling' }, { status: 400 });
  const secret = (body.secret ?? '').trim();
  const baseUrl = (body.baseUrl ?? '').trim() || (provider === 'shayp' ? SHAYP_DEFAULT_URL : '');
  if (!secret) return NextResponse.json({ error: provider === 'shayp' ? 'API-sleutel ontbreekt' : 'Wachtwoord ontbreekt' }, { status: 400 });
  if (provider === 'mycarwash' && (!baseUrl || !(body.username ?? '').trim())) {
    return NextResponse.json({ error: 'URL en gebruikersnaam zijn verplicht' }, { status: 400 });
  }
  if (provider === 'shayp' && !(body.customerId ?? '').trim()) {
    return NextResponse.json({ error: 'Klant-ID ontbreekt' }, { status: 400 });
  }
  if (!/^https:\/\//i.test(baseUrl)) return NextResponse.json({ error: 'De URL moet met https:// beginnen' }, { status: 400 });

  const draft = {
    provider,
    base_url: baseUrl,
    username: (body.username ?? '').trim(),
    customer_id: (body.customerId ?? '').trim(),
    secret_enc: seal(secret),
  };
  let targets;
  try {
    targets = await discoverTargets(draft);
  } catch (err) {
    return NextResponse.json({ error: `Verbinding mislukt: ${err instanceof Error ? err.message : String(err)}` }, { status: 422 });
  }

  await dbConnect();
  const doc = await IntegrationConnection.create({
    ...draft,
    label: (body.label ?? '').trim() || (provider === 'shayp' ? 'Shayp' : 'MyCarwash'),
    owner_id: session.userId,
    last_ok_at: new Date(),
  });
  return NextResponse.json({ connection: publicConnection(doc.toObject()), targets }, { status: 201 });
}
