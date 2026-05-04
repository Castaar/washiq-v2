import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Opdracht } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// PATCH /api/opdrachten/[id]  — mark done or update (employees can mark done, owner can edit)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { is_done?: boolean; text?: string };

  await dbConnect();

  const update: Record<string, unknown> = {};

  if (typeof body.is_done === 'boolean') {
    update.is_done = body.is_done;
    if (body.is_done) {
      update.done_by_name = session.name;
      update.done_at = new Date();
    } else {
      update.done_by_name = '';
      update.done_at = null;
    }
  }

  if (typeof body.text === 'string' && body.text.trim() && (session.role === 'owner' || session.role === 'developer')) {
    update.text = body.text.trim();
  }

  const doc = await Opdracht.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/opdrachten/[id]  — remove (owner/developer only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();
  await Opdracht.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
