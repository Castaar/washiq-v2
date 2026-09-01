import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { AttendanceLog } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// DELETE /api/attendance/[id] — undo a wrongly logged check-in/check-out.
// Owner/developer can remove any entry; anyone else only their own.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { id } = await params;

  const log = await AttendanceLog.findById(id);
  if (!log) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  const isOwner = session.role === 'owner' || session.role === 'developer';
  if (!isOwner && log.user_id.toString() !== session.userId) {
    return NextResponse.json({ error: 'Je kan enkel je eigen registraties verwijderen.' }, { status: 403 });
  }

  await AttendanceLog.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
