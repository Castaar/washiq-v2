import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IntegrationDay, Site, SiteIntegration } from '@/lib/models';
import { addDays, brusselsDay, syncDays } from '@/lib/integrations';
import { waterAnomaly, waterOverview } from '@/lib/water';
import { notifySiteManagersNow } from '@/lib/push';

// GET /api/cron/integrations-sync — daily at 13:00 UTC (vercel.json; Shayp only serves
// ranges that ended 12+ hours ago). Stores yesterday's figures for every active
// koppeling, re-fetches the day before in case it was late, then checks the water
// meters for a leak or unusual use outside opening hours (one push per day and site).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await dbConnect();
  const yesterday = addDays(brusselsDay(new Date()), -1);
  const days = [addDays(yesterday, -1), yesterday];
  const links = await SiteIntegration.find({ enabled: true, external_id: { $ne: '' } }).lean();
  const results: { site: string; provider: string; ok: boolean; error?: string; alerts?: number }[] = [];
  for (const l of links) {
    const site = String(l.site_id);
    try {
      await syncDays(l as never, days);
      const alerts = l.provider === 'shayp' ? await waterAlerts(site, days) : 0;
      results.push({ site, provider: l.provider as string, ok: true, alerts });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await SiteIntegration.updateOne({ _id: l._id }, { $set: { last_error: msg } });
      results.push({ site, provider: l.provider as string, ok: false, error: msg });
    }
  }
  return NextResponse.json({ ok: true, days, results });
}

async function waterAlerts(siteId: string, days: string[]): Promise<number> {
  const last = days[days.length - 1];
  const overview = await waterOverview(siteId, addDays(days[0], -14), last);
  const site = await Site.findById(siteId).select('name').lean();
  const name = (site?.name as string) ?? '';
  let sent = 0;
  for (const date of days) {
    const day = overview.days.find((d) => d.date === date);
    if (!day) continue;
    const already = await IntegrationDay.findOne({ site_id: siteId, provider: 'shayp', date, alert_sent_at: { $ne: null } }).select('_id').lean();
    if (already) continue;
    const previous = overview.days.filter((d) => d.date < date && d.date >= addDays(date, -14));
    const a = waterAnomaly(day, previous);
    if (!a) continue;
    const when = date.split('-').reverse().join('/');
    await notifySiteManagersNow(siteId, a.kind === 'leak'
      ? { title: `Mogelijk waterlek — ${name}`, body: `Shayp mat ${a.liters.toLocaleString('nl-BE')} L lekverlies op ${when}. Controleer kranen, kleppen en leidingen.`, url: `/water?site=${siteId}` }
      : { title: `Ongewoon waterverbruik buiten openingsuren — ${name}`, body: `${a.liters.toLocaleString('nl-BE')} L buiten de openingsuren op ${when}, meer dan normaal. Osmose, ontharder of een lek?`, url: `/water?site=${siteId}` });
    await IntegrationDay.updateOne({ site_id: siteId, provider: 'shayp', date }, { $set: { alert_sent_at: new Date() } });
    sent++;
  }
  return sent;
}
