import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { MaintenanceTask, MaintenanceLog, WeeklyEntry, Site } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// POST /api/maintenance/[id]/undo-complete — reverts the most recent completion
// (removes last MaintenanceLog entry and restores previous last_done_at).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const task = await MaintenanceTask.findById(id).lean();
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Remove the most recent log entry for this task
  const lastLog = await MaintenanceLog.findOne({ task_id: id }).sort({ done_at: -1 }).lean();
  if (lastLog) {
    await MaintenanceLog.findByIdAndDelete(lastLog._id);
  }

  // Find the previous log entry (if any) to restore last_done_at
  const prevLog = await MaintenanceLog.findOne({ task_id: id }).sort({ done_at: -1 }).lean();

  // MaintenanceLog never recorded the tellerstand at completion time, so the
  // exact historical value can't be reconstructed — fall back to the same
  // "current tellerstand" formula used everywhere else (latest weekly
  // reading, else the site's baseline). A bare 0 here made the task look
  // instantly overdue again right after undoing.
  const [latestEntry, siteDoc] = await Promise.all([
    WeeklyEntry.findOne({ site_id: task.site_id }).sort({ week_start: -1 }).select('tellerstand').lean(),
    Site.findById(task.site_id).select('start_car_count').lean(),
  ]);
  const currentTellerstand = (latestEntry as { tellerstand?: number } | null)?.tellerstand
    ?? (siteDoc as { start_car_count?: number } | null)?.start_car_count
    ?? 0;

  await MaintenanceTask.findByIdAndUpdate(id, {
    $set: {
      last_done_at: prevLog ? prevLog.done_at : null,
      last_done_by_name: prevLog ? (prevLog as Record<string, unknown>).done_by_name ?? '' : '',
      washes_at_last_done: prevLog ? currentTellerstand : 0,
      is_overdue: true,
    },
  });

  return NextResponse.json({ ok: true });
}
