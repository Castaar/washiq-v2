import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { OrderItem, OrderRequest, User, Site } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sendPushToUser } from '@/lib/push';
import type { Types } from 'mongoose';

// GET /api/orders/requests?siteId=xxx — open + recent requests, owner/developer only
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();
  const docs = await OrderRequest.find({ site_id: siteId }).sort({ requested_at: -1 }).limit(50).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      item_name: d.item_name,
      requested_by_name: d.requested_by_name,
      requested_at: (d.requested_at as Date).toISOString(),
      is_handled: d.is_handled,
      handled_by_name: d.handled_by_name ?? '',
    })),
  );
}

// POST /api/orders/requests — employee/owner/developer flags an item to (re)order
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { siteId: string; itemId: string };
  if (!body.siteId || !body.itemId) {
    return NextResponse.json({ error: 'siteId and itemId required' }, { status: 400 });
  }

  await dbConnect();
  const item = await OrderItem.findById(body.itemId);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const doc = await OrderRequest.create({
    site_id: body.siteId,
    item_id: item._id,
    item_name: item.name,
    requested_by: session.userId,
    requested_by_name: session.name,
  });

  const [siteDoc, notifyUsers] = await Promise.all([
    Site.findById(body.siteId).select('name').lean(),
    User.find({ site_ids: body.siteId, role: { $in: ['owner', 'developer'] }, is_active: true }).select('_id').lean(),
  ]);
  const siteName = (siteDoc as { name?: string } | null)?.name ?? '';

  await Promise.allSettled(
    notifyUsers.map((u) =>
      sendPushToUser((u._id as Types.ObjectId).toString(), {
        title: 'Nieuwe bestelling',
        body: `${item.name}${siteName ? ` — ${siteName}` : ''}`,
        url: `/orders?site=${body.siteId}&request=${(doc._id as Types.ObjectId).toString()}`,
      }),
    ),
  );

  return NextResponse.json({ id: (doc._id as Types.ObjectId).toString() }, { status: 201 });
}
