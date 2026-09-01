import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { OrderItem } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// PATCH /api/orders/items/[id] — edit catalog item, owner/developer only
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { name?: string; description?: string };

  await dbConnect();
  const update: Record<string, string> = {};
  if (typeof body.name === 'string') update.name = body.name.trim();
  if (typeof body.description === 'string') update.description = body.description.trim();

  await OrderItem.findByIdAndUpdate(id, { $set: update });
  return NextResponse.json({ ok: true });
}

// DELETE /api/orders/items/[id] — remove catalog item, owner/developer only
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
  await OrderItem.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
