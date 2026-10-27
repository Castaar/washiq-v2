import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, Planning, ShiftReminderSent, User } from '@/lib/models';
import { sendPushToUser } from '@/lib/push';

// GET /api/cron/shift-reminder — called once daily in the evening by Vercel
// Cron (see vercel.json). Everyone who is planned to work tomorrow gets one
// push with their shift(s): site, hours and the planning note.
export async function GET(req: NextRequest) {
  // Fail closed: without CRON_SECRET configured, refuse every request.
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  // Planning dates are stored as UTC midnight of the (Brussels) day
  const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Brussels' }).slice(0, 10);
  const dayStart = new Date(`${todayStr}T00:00:00Z`);
  dayStart.setUTCDate(dayStart.getUTCDate() + 1);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const tomorrowStr = dayStart.toISOString().slice(0, 10);

  const shifts = await Planning.find({ date: { $gte: dayStart, $lt: dayEnd } })
    .select('site_id user_id start_time end_time note')
    .sort({ start_time: 1 })
    .lean();
  if (shifts.length === 0) return NextResponse.json({ ok: true, date: tomorrowStr, results: [] });

  const [sites, users] = await Promise.all([
    Site.find({ _id: { $in: [...new Set(shifts.map((s) => String(s.site_id)))] } }).select('_id name').lean(),
    User.find({ _id: { $in: [...new Set(shifts.map((s) => String(s.user_id)))] }, is_active: true }).select('_id name').lean(),
  ]);
  const siteName = new Map(sites.map((s) => [String(s._id), s.name as string]));
  const activeUsers = new Map(users.map((u) => [String(u._id), u.name as string]));

  // One push per person, even with shifts at two carwashes tomorrow
  const byUser = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const userId = String(shift.user_id);
    if (!activeUsers.has(userId)) continue;
    if (!byUser.has(userId)) byUser.set(userId, []);
    byUser.get(userId)!.push(shift);
  }

  const results: { user: string; sent: boolean; reason: string; message?: string }[] = [];

  for (const [userId, userShifts] of byUser) {
    const name = activeUsers.get(userId) ?? '';
    try {
      await ShiftReminderSent.create({ user_id: userId, date: tomorrowStr });
    } catch {
      // Unique index hit — already reminded for tomorrow (race-safe dedupe)
      results.push({ user: name, sent: false, reason: 'already sent' });
      continue;
    }

    const lines = userShifts.map((s) => {
      const hours = [s.start_time, s.end_time].filter(Boolean).join('–');
      const note = ((s.note as string) || '').trim();
      return [siteName.get(String(s.site_id)) ?? '', hours].filter(Boolean).join(', ') + (note ? ` · ${note}` : '');
    });

    await sendPushToUser(userId, {
      title: 'Morgen werk je',
      body: lines.join('\n'),
      url: `/planning?site=${String(userShifts[0].site_id)}&week=${tomorrowStr}`,
    }).catch(() => {});
    results.push({ user: name, sent: true, reason: `${userShifts.length} shift(s)`, message: lines.join(' / ') });
  }

  return NextResponse.json({ ok: true, date: tomorrowStr, results });
}
