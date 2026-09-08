import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Brush } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// PATCH /api/brushes/[id] — rename, owner/developer only
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { label?: string };

  await dbConnect();
  const update: Record<string, string> = {};
  if (typeof body.label === 'string' && body.label.trim()) update.label = body.label.trim();

  await Brush.findByIdAndUpdate(id, { $set: update });
  return NextResponse.json({ ok: true });
}

// DELETE /api/brushes/[id] — owner/developer only
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
  await Brush.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
