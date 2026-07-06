import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { MaintenanceTask, MaintenanceLog } from '@/lib/models';
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
  await MaintenanceTask.findByIdAndUpdate(id, {
    $set: {
      last_done_at: prevLog ? prevLog.done_at : null,
      washes_at_last_done: prevLog ? (prevLog as Record<string, unknown>).washes_at_last_done ?? 0 : 0,
      is_overdue: true,
    },
  });

  return NextResponse.json({ ok: true });
}
