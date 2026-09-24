import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { StockDelivery } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// POST /api/stock/delivery-note — log a "diverse" delivery as free text
// (e.g. "5 dozen doekjes geleverd") instead of a tracked chemical + quantity.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { siteId?: string; text?: string };
  if (!body.siteId || !body.text?.trim()) {
    return NextResponse.json({ error: 'siteId and text required' }, { status: 400 });
  }

  await dbConnect();

  const doc = await StockDelivery.create({
    site_id: body.siteId,
    chemical_id: null,
    quantity: 0,
    unit_price: 0,
    note: body.text.trim(),
    delivered_at: new Date(),
    logged_by: session.userId,
    logged_by_name: session.name,
  });

  return NextResponse.json({
    id: doc._id.toString(),
    note: doc.note,
    deliveredAt: (doc.delivered_at as Date).toISOString(),
    loggedByName: doc.logged_by_name,
  }, { status: 201 });
}
