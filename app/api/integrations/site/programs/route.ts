import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db/mongoose';
import { IntegrationConnection } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { canManageSite } from '@/lib/permissions';
import { addDays, brusselsDay, canUseConnection, mycarwashCountersFor, type ConnectionLike } from '@/lib/integrations';

// GET /api/integrations/site/programs?siteId=&connectionId=&locationId= — program numbers
// MyCarwash reports for this location (looks back up to 7 days for a day with washes)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const sp = req.nextUrl.searchParams;
  const siteId = sp.get('siteId') ?? '';
  const connectionId = sp.get('connectionId') ?? '';
  const locationId = sp.get('locationId') ?? '';
  if (!session || !canManageSite(session, siteId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await dbConnect();
  if (!mongoose.isValidObjectId(connectionId) || !(await canUseConnection(session, connectionId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const conn = await IntegrationConnection.findById(connectionId).lean<ConnectionLike>();
  if (!conn || conn.provider !== 'mycarwash' || !locationId) return NextResponse.json({ error: 'Ongeldige gegevens' }, { status: 400 });
  try {
    const today = brusselsDay(new Date());
    for (let i = 0; i <= 7; i++) {
      const counters = await mycarwashCountersFor(conn, locationId, addDays(today, -i));
      if (counters.length) return NextResponse.json(counters.map((c) => ({ number: c.number, name: c.name })));
    }
    return NextResponse.json([]);
  } catch (err) {
    return NextResponse.json({ error: `Verbinding mislukt: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
  }
}
