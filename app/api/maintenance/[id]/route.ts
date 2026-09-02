import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { MaintenanceTask } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// PATCH /api/maintenance/[id]  — update last_done_at (owner or developer)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  type Body = {
    description?: string;
    trigger_type?: 'washes' | 'months' | 'fixed_date' | 'fixed_months';
    trigger_value?: number;
    trigger_day?: number;
    trigger_month?: number;
    last_done_at?: string;
    washes_at_last_done?: number;
  };
  const body = (await req.json()) as Body;

  await dbConnect();
  const update: Record<string, unknown> = {};
  if (typeof body.description === 'string' && body.description.trim()) update.description = body.description.trim();
  if (body.trigger_type) update.trigger_type = body.trigger_type;
  if (typeof body.trigger_value === 'number') update.trigger_value = body.trigger_value;
  if (typeof body.trigger_day === 'number') update.trigger_day = body.trigger_day;
  if (typeof body.trigger_month === 'number') update.trigger_month = body.trigger_month;
  if (body.last_done_at) {
    update.last_done_at = new Date(body.last_done_at);
    update.is_overdue = false;
    update.overdue_notified_at = null;
  }
  if (typeof body.washes_at_last_done === 'number') update.washes_at_last_done = body.washes_at_last_done;

  const doc = await MaintenanceTask.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/maintenance/[id]  — remove a task (owner or developer)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'developer' && session.role !== 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();
  await MaintenanceTask.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
