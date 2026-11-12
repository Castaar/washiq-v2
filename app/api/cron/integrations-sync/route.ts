import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { SiteIntegration } from '@/lib/models';
import { addDays, brusselsDay, syncDays } from '@/lib/integrations';

// GET /api/cron/integrations-sync — daily at 13:00 UTC (vercel.json; Shayp only serves
// ranges that ended 12+ hours ago). Stores yesterday's figures
// for every active koppeling, and re-fetches the day before in case it was late.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbConnect();
  const yesterday = addDays(brusselsDay(new Date()), -1);
  const days = [addDays(yesterday, -1), yesterday];
  const links = await SiteIntegration.find({ enabled: true, external_id: { $ne: '' } }).lean();
  const results: { site: string; provider: string; ok: boolean; error?: string }[] = [];
  for (const l of links) {
    try {
      await syncDays(l as never, days);
      results.push({ site: String(l.site_id), provider: l.provider as string, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await SiteIntegration.updateOne({ _id: l._id }, { $set: { last_error: msg } });
      results.push({ site: String(l.site_id), provider: l.provider as string, ok: false, error: msg });
    }
  }
  return NextResponse.json({ ok: true, days, results });
}
