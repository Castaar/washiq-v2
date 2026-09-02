import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, Planning, DailyChecklist, ClosingReminderSent } from '@/lib/models';
import { sendPushToSite } from '@/lib/push';

// GET /api/cron/closing-checklist-reminder — called once daily by Vercel
// Cron (see vercel.json — Hobby plan only allows daily cron frequency, so
// this runs once in the evening after every site's shift has ended). For
// each site with a shift today, if the closing checklist (Dagfiche) hasn't
// been submitted yet, push a one-time reminder to that site's app users.
export async function GET(req: NextRequest) {
  // Fail closed: without CRON_SECRET configured, refuse every request.
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const nowParts = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Brussels' }); // "YYYY-MM-DD HH:MM:SS"
  const [dateStr, timeStr] = nowParts.split(' ');
  const [nowH, nowM] = timeStr.split(':').map(Number);
  const nowMinutes = nowH * 60 + nowM;

  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [sites, todaysShifts] = await Promise.all([
    Site.find({}).select('_id name').lean(),
    Planning.find({ date: { $gte: dayStart, $lt: dayEnd } }).select('site_id end_time').lean(),
  ]);

  // Latest shift end time per site, today
  const latestEndBySite = new Map<string, number>();
  for (const shift of todaysShifts) {
    const siteId = String(shift.site_id);
    const [h, m] = ((shift.end_time as string) || '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;
    const minutes = h * 60 + m;
    const prev = latestEndBySite.get(siteId);
    if (prev === undefined || minutes > prev) latestEndBySite.set(siteId, minutes);
  }

  const results: { site: string; sent: boolean; reason: string }[] = [];

  for (const [siteId, endMinutes] of latestEndBySite) {
    if (nowMinutes < endMinutes) {
      continue; // shift hasn't ended yet — nothing to remind about today
    }

    const siteName = sites.find((s) => String(s._id) === siteId)?.name ?? '';

    const alreadySubmitted = await DailyChecklist.exists({
      site_id: siteId,
      submitted_at: { $gte: dayStart, $lt: dayEnd },
    });
    if (alreadySubmitted) {
      results.push({ site: siteName, sent: false, reason: 'already submitted' });
      continue;
    }

    try {
      await ClosingReminderSent.create({ site_id: siteId, date: dateStr });
    } catch {
      // Unique index hit — already sent today (race-safe dedupe)
      results.push({ site: siteName, sent: false, reason: 'already sent' });
      continue;
    }

    await sendPushToSite(siteId, {
      title: 'Dagfiche nog niet ingevuld',
      body: `${siteName}: de shift is afgelopen — vergeet de afsluit-checklist niet in te vullen.`,
      url: `/dagfiche?site=${siteId}`,
    }).catch(() => {});

    results.push({ site: siteName, sent: true, reason: 'reminder sent' });
  }

  return NextResponse.json({ ok: true, results });
}
