import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { OrderRequest } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// PATCH /api/orders/requests/[id] — mark handled, owner/developer only
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
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
