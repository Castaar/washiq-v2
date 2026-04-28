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
  type Body = { last_done_at?: string; washes_at_last_done?: number };
  const body = (await req.json()) as Body;

  await dbConnect();
  const update: Record<string, unknown> = {};
  if (body.last_done_at) update.last_done_at = new Date(body.last_done_at);
  if (typeof body.washes_at_last_done === 'number') update.washes_at_last_done = body.washes_at_last_done;

  const doc = await MaintenanceTask.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/maintenance/[id]  — remove a task (developer only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();
  await MaintenanceTask.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
