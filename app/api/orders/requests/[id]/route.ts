import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { OrderRequest } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { canModify } from '@/lib/permissions';

// PATCH /api/orders/requests/[id] — mark handled, owner/developer only
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || !['owner', 'developer', 'technician'].includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { is_handled: boolean };

  await dbConnect();
  await OrderRequest.findByIdAndUpdate(id, {
    $set: {
      is_handled: body.is_handled,
      handled_by_name: body.is_handled ? session.name : '',
      handled_at: body.is_handled ? new Date() : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/orders/requests/[id] — remove a wrong request (manager or requester)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const doc = await OrderRequest.findById(id).select('requested_by').lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canModify(session, (doc as { requested_by?: unknown }).requested_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await OrderRequest.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
