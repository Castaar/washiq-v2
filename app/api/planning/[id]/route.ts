import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Planning } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// DELETE /api/planning/[id]  — remove shift (owner/developer only)
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
  await Planning.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
