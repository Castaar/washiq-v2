import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Announcement, User } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sendPushToAll, sendPushToUser, afterResponse } from '@/lib/push';
import { announcementFilter, plannedRecipientIds } from '@/lib/announcements';
import type { Types } from 'mongoose';

// GET /api/announcements?siteId=xxx
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  await dbConnect();

  const filter = announcementFilter(session.role, session.userId, siteId);

  const limit = req.nextUrl.searchParams.get('limit');
  const docs = await Announcement.find(filter).sort({ created_at: -1 }).limit(limit ? parseInt(limit) : 10).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      text: d.text,
      text_fr: d.text_fr ?? '',
      kind: d.kind ?? 'general',
      created_by_name: d.created_by_name,
      is_all_sites: d.is_all_sites,
      created_at: (d.created_at as Date).toISOString(),
    })),
  );
}

// POST /api/announcements
// — birthday wishes: any logged-in user
// — general announcements (visible across filialen): owner/developer only
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { text: string; text_fr?: string; siteId?: string; is_all_sites?: boolean; kind?: 'general' | 'birthday' };
  if (!body.text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const kind = body.kind === 'birthday' ? 'birthday' : 'general';
  if (kind === 'general' && session.role !== 'owner' && session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const isAll = body.is_all_sites !== false;
  if (!isAll) {
    if (kind !== 'general' || !body.siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });
    if (session.role !== 'developer' && !session.siteIds.includes(body.siteId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  await dbConnect();

  const recipientIds = isAll ? undefined : await plannedRecipientIds(body.siteId!);
  const doc = await Announcement.create({
    text: body.text.trim(),
    text_fr: body.text_fr?.trim() || undefined,
    kind,
    created_by_name: session.name,
    is_all_sites: isAll,
    site_ids: isAll ? [] : [body.siteId],
    recipient_ids: recipientIds,
  });

  if (kind === 'general') {
    const pushPayload = { title: 'Nieuw bericht', body: body.text.trim(), url: `/diversen${isAll ? '' : `?site=${body.siteId}`}` };
    if (isAll) {
      afterResponse(sendPushToAll(pushPayload));
    } else {
      // The planned recipients plus the filiaal's owners — nobody else
      afterResponse(User.find({ is_active: true, $or: [{ _id: { $in: recipientIds } }, { role: 'owner', site_ids: body.siteId }] })
        .select('_id')
        .lean()
        .then((users) =>
          Promise.allSettled(
            users
              .map((u) => (u._id as Types.ObjectId).toString())
              .filter((id) => id !== session.userId)
              .map((id) => sendPushToUser(id, pushPayload)),
          ),
        )
        .catch(() => {}));
    }
  }

  return NextResponse.json({ id: (doc._id as Types.ObjectId).toString(), recipientCount: recipientIds?.length ?? null }, { status: 201 });
}

// DELETE /api/announcements?id=xxx — owner/developer only
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await dbConnect();
  await Announcement.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
