import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IntegrationConnection } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { isManager } from '@/lib/permissions';
import { canUseConnection, discoverTargets, type ConnectionLike } from '@/lib/integrations';

// GET /api/integrations/connections/[id]/targets — locations (MyCarwash) or water meters (Shayp)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session || !isManager(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  await dbConnect();
  if (!(await canUseConnection(session, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const conn = await IntegrationConnection.findById(id).lean<ConnectionLike & { _id: unknown }>();
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const targets = await discoverTargets(conn);
    await IntegrationConnection.updateOne({ _id: id }, { $set: { last_ok_at: new Date(), last_error: '' } });
    return NextResponse.json(targets);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await IntegrationConnection.updateOne({ _id: id }, { $set: { last_error: msg } });
    return NextResponse.json({ error: `Verbinding mislukt: ${msg}` }, { status: 502 });
  }
}
