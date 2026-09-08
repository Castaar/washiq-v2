import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { OrderItem, User } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// POST /api/orders/items/copy — copy the Orders catalog from one site into
// another (skips products that already exist there by name).
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { fromSiteId: string; toSiteId: string };
  if (!body.fromSiteId || !body.toSiteId) {
    return NextResponse.json({ error: 'fromSiteId and toSiteId required' }, { status: 400 });
  }
  if (body.fromSiteId === body.toSiteId) {
    return NextResponse.json({ error: 'Bron en doel zijn dezelfde site' }, { status: 400 });
  }

  // Owners may only copy between their own sites
  if (session.role === 'owner') {
    const userDoc = await User.findById(session.userId).select('site_ids').lean();
    const ownedSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
    if (!ownedSiteIds.includes(body.fromSiteId) || !ownedSiteIds.includes(body.toSiteId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  await dbConnect();

  const [sourceItems, existingItems] = await Promise.all([
    OrderItem.find({ site_id: body.fromSiteId, is_active: true }).lean(),
    OrderItem.find({ site_id: body.toSiteId, is_active: true }).select('name').lean(),
  ]);
  const existingNames = new Set(existingItems.map((i) => i.name as string));
  const toCreate = sourceItems.filter((i) => !existingNames.has(i.name as string));

  if (toCreate.length > 0) {
    await OrderItem.insertMany(
      toCreate.map((i) => ({
        site_id: body.toSiteId,
        name: i.name,
        description: i.description ?? '',
        category: i.category ?? 'algemeen',
      })),
    );
  }

  return NextResponse.json({ copied: toCreate.length });
}
