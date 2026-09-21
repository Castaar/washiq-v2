import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { AgendaEvent } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// DELETE /api/agenda/[id] — remove a day-note. Owner/developer can remove
// any; anyone else only the one they created themselves.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const isOwner = session.role === 'owner' || session.role === 'developer';
  if (!isOwner) {
    const doc = await AgendaEvent.findById(id).select('created_by').lean();
    if (!doc || (doc.created_by as { toString(): string } | undefined)?.toString() !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  await AgendaEvent.findByIdAndDelete(id);

  return NextResponse.json({ ok: true });
}
