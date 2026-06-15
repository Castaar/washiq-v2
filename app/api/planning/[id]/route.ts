import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Planning } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sendPushToUser } from '@/lib/push';
import type { Types } from 'mongoose';

// PUT /api/planning/[id] — update shift (owner/developer only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    startTime?: string;
    endTime?: string;
    note?: string;
  };

  await dbConnect();

  const doc = await Planning.findByIdAndUpdate(
    id,
    {
      ...(body.startTime !== undefined && { start_time: body.startTime }),
      ...(body.endTime !== undefined && { end_time: body.endTime }),
      ...(body.note !== undefined && { note: body.note }),
    },
    { new: true },
  );

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Notify the employee their shift was changed
  sendPushToUser((doc.user_id as Types.ObjectId).toString(), {
    title: 'Planning gewijzigd',
    body: `${(doc.date as Date).toLocaleDateString('nl-BE')} van ${doc.start_time} tot ${doc.end_time}${doc.note ? ` — ${doc.note}` : ''}`,
    url: `/planning?site=${(doc.site_id as Types.ObjectId).toString()}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

// DELETE /api/planning/[id] — remove shift (owner/developer only)
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

  const doc = await Planning.findByIdAndDelete(id);

  if (doc) {
    sendPushToUser((doc.user_id as Types.ObjectId).toString(), {
      title: 'Shift verwijderd',
      body: `Je shift op ${(doc.date as Date).toLocaleDateString('nl-BE')} is verwijderd.`,
      url: `/planning?site=${(doc.site_id as Types.ObjectId).toString()}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
