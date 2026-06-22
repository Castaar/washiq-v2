import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { MaintenanceTask, MaintenanceLog, WeeklyEntry } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

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

  const latestEntry = await WeeklyEntry.findOne({ site_id: task.site_id })
    .sort({ week_start: -1 })
    .select('tellerstand')
    .lean();
  const currentTellerstand = (latestEntry as { tellerstand?: number } | null)?.tellerstand ?? 0;

  const now = new Date();
  await Promise.all([
    MaintenanceTask.findByIdAndUpdate(id, {
      $set: { last_done_at: now, washes_at_last_done: currentTellerstand, is_overdue: false },
    }),
    MaintenanceLog.create({
      task_id: id,
      site_id: task.site_id,
      done_by: session.userId,
      done_at: now,
      notes: body.notes?.trim() ?? '',
    }),
  ]);

  return NextResponse.json({ ok: true });
}
