import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, MaintenanceTask, WeeklyEntry, User } from '@/lib/models';
import { computeIsOverdue } from '@/lib/maintenance';
import { sendPushToUser } from '@/lib/push';
import type { Types } from 'mongoose';

// GET /api/cron/maintenance-overdue-reminder — called once daily by Vercel
// Cron. For each site, finds overdue maintenance tasks and pushes a summary
// to that site's owner/developer — at most once a week per task, so the
// daily cron doesn't spam the same overdue task every day.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const now = new Date();
  const renotifyBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sites = await Site.find({}).select('_id name').lean();
  const results: { site: string; notified: number }[] = [];

  for (const site of sites) {
    const siteId = (site._id as Types.ObjectId).toString();

    const [tasks, latestEntry, notifyUsers] = await Promise.all([
      MaintenanceTask.find({ site_id: siteId }).lean(),
      WeeklyEntry.findOne({ site_id: siteId }).sort({ week_start: -1 }).select('tellerstand').lean(),
      User.find({ site_ids: siteId, role: { $in: ['owner', 'developer'] }, is_active: true }).select('_id').lean(),
    ]);

    const currentTellerstand = (latestEntry as { tellerstand?: number } | null)?.tellerstand ?? 0;

    const overdueDue = tasks.filter((t) => {
      const overdue = computeIsOverdue(t, now, t.trigger_type === 'washes' ? currentTellerstand : undefined);
      if (!overdue) return false;
      const notifiedAt = t.overdue_notified_at as Date | null;
      return !notifiedAt || notifiedAt < renotifyBefore;
    });

    if (overdueDue.length === 0 || notifyUsers.length === 0) {
      results.push({ site: site.name as string, notified: 0 });
      continue;
    }

    const summary = overdueDue.map((t) => t.description).join(', ');
    await Promise.allSettled(
      notifyUsers.map((u) =>
        sendPushToUser((u._id as Types.ObjectId).toString(), {
          title: overdueDue.length === 1 ? 'Onderhoudstaak achterstallig' : `${overdueDue.length} onderhoudstaken achterstallig`,
          body: `${site.name}: ${summary}`,
          url: overdueDue.length === 1
            ? `/instellingen?site=${siteId}&task=${(overdueDue[0]._id as Types.ObjectId).toString()}`
            : `/instellingen?site=${siteId}`,
        }),
      ),
    );

    await MaintenanceTask.updateMany(
      { _id: { $in: overdueDue.map((t) => t._id) } },
      { $set: { overdue_notified_at: now } },
    );

    results.push({ site: site.name as string, notified: overdueDue.length });
  }

  return NextResponse.json({ ok: true, results });
}
