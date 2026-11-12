import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { SiteIntegration } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { canManageSite } from '@/lib/permissions';
import { addDays, brusselsDay, syncDays, daysBetween } from '@/lib/integrations';

// POST /api/integrations/sync { siteId } — fetch the last 62 finished days again (overwrites)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const { siteId = '' } = (await req.json()) as { siteId?: string };
  if (!session || !canManageSite(session, siteId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await dbConnect();
  const yesterday = addDays(brusselsDay(new Date()), -1);
  const days = daysBetween(addDays(yesterday, -62), yesterday);
  const links = await SiteIntegration.find({ site_id: siteId, enabled: true, external_id: { $ne: '' } }).lean();
  const result: Record<string, string> = {};
  for (const l of links) {
    try {
      const n = await syncDays(l as never, days);
      result[l.provider as string] = `${n} dagen opgehaald`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await SiteIntegration.updateOne({ _id: l._id }, { $set: { last_error: msg } });
      result[l.provider as string] = `Mislukt: ${msg}`;
    }
  }
  return NextResponse.json(result);
}
