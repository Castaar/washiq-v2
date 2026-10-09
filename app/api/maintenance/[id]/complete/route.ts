import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { MaintenanceTask, MaintenanceLog, WeeklyEntry, Site } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { notifySiteManagers } from '@/lib/push';

// POST /api/maintenance/[id]/complete — any logged-in user (e.g. technician) checks off
// a maintenance task as done, with an optional note. Logs to MaintenanceLog.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { notes?: string };

  await dbConnect();

  const task = await MaintenanceTask.findById(id).lean();
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Must match the same "current tellerstand" formula used everywhere else
  // (dashboard, onderhouden page): latest weekly reading, falling back to
  // the site's baseline start_car_count when no reading exists yet. Using
  // a bare 0 fallback here reset washes_at_last_done to 0 on every
  // completion, which made a washes-type task look instantly overdue again
  // the moment it was marked done (baseline tellerstand >> 0 + interval).
  const [latestEntry, siteDoc] = await Promise.all([
    WeeklyEntry.findOne({ site_id: task.site_id }).sort({ week_start: -1 }).select('tellerstand').lean(),
    Site.findById(task.site_id).select('start_car_count').lean(),
  ]);
  const currentTellerstand = (latestEntry as { tellerstand?: number } | null)?.tellerstand
    ?? (siteDoc as { start_car_count?: number } | null)?.start_car_count
    ?? 0;

  const now = new Date();
  await Promise.all([
    MaintenanceTask.findByIdAndUpdate(id, {
      $set: { last_done_at: now, last_done_by_name: session.name, washes_at_last_done: currentTellerstand, is_overdue: false, overdue_notified_at: null },
    }),
    MaintenanceLog.create({
      task_id: id,
      site_id: task.site_id,
      done_by: session.userId,
      done_by_name: session.name,
      done_at: now,
      notes: body.notes?.trim() ?? '',
    }),
  ]);

  const siteId = String(task.site_id);
  notifySiteManagers(siteId, {
    title: 'Onderhoud uitgevoerd',
    body: `${session.name}: ${task.description}${body.notes?.trim() ? ` — ${body.notes.trim()}` : ''}`,
    url: `/onderhouden?site=${siteId}`,
  }, session.userId);

  return NextResponse.json({ ok: true });
}
