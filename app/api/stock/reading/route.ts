import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { ChemicalStock, StockDelivery, StockReading, User } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sendPushToUser } from '@/lib/push';
import mongoose from 'mongoose';

// POST /api/stock/reading — record a physical stock count for one product.
// Consumption since the previous reading is derived automatically:
// previous.quantity + deliveries since then - new quantity.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { chemicalId?: string; quantity?: number };
  const chemicalId = body.chemicalId;
  const quantity = Number(body.quantity);
  if (!chemicalId || !Number.isFinite(quantity) || quantity < 0) {
    return NextResponse.json({ error: 'Ongeldige gegevens' }, { status: 400 });
  }

  await dbConnect();

  const stock = await ChemicalStock.findById(chemicalId);
  if (!stock) return NextResponse.json({ error: 'Product niet gevonden' }, { status: 404 });

  const previous = await StockReading.findOne({ chemical_id: chemicalId }).sort({ recorded_at: -1 });

  const now = new Date();
  let consumption = 0;
  let deliveredSince = 0;

  if (previous) {
    const deliveries = await StockDelivery.find({
      chemical_id: chemicalId,
      delivered_at: { $gt: previous.recorded_at, $lte: now },
    }).select('quantity').lean();
    deliveredSince = deliveries.reduce((s, d) => s + ((d.quantity as number) ?? 0), 0);
    consumption = previous.quantity + deliveredSince - quantity;
  }

  const reading = await StockReading.create({
    site_id: stock.site_id,
    chemical_id: stock._id,
    name: stock.name,
    unit: stock.unit,
    quantity,
    consumption,
    recorded_at: now,
    recorded_by: session.userId ? new mongoose.Types.ObjectId(session.userId) : undefined,
  });

  stock.current_stock = quantity;
  stock.last_updated = now;
  await stock.save();

  if (stock.min_stock_alert > 0 && quantity <= stock.min_stock_alert) {
    const siteId = (stock.site_id as mongoose.Types.ObjectId).toString();
    User.find({ site_ids: siteId, role: { $in: ['owner', 'developer'] }, is_active: true })
      .select('_id')
      .lean()
      .then((notifyUsers) =>
        Promise.allSettled(
          notifyUsers
            .filter((u) => (u._id as mongoose.Types.ObjectId).toString() !== session.userId)
            .map((u) =>
              sendPushToUser((u._id as mongoose.Types.ObjectId).toString(), {
                title: `Lage voorraad: ${stock.name}`,
                body: `Nog ${quantity} ${stock.unit} — controleer of een levering nodig is.`,
                url: `/instellingen?site=${siteId}`,
              }),
            ),
        ),
      )
      .catch(() => {});
  }

  return NextResponse.json({
    id: reading._id.toString(),
    quantity,
    consumption,
    deliveredSince,
    isFirstReading: !previous,
  });
}

// GET /api/stock/reading?siteId=xxx&chemicalId=xxx — reading history (most recent first)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  const chemicalId = req.nextUrl.searchParams.get('chemicalId');
  if (!siteId && !chemicalId) return NextResponse.json({ error: 'siteId or chemicalId required' }, { status: 400 });

  await dbConnect();

  const filter: Record<string, unknown> = {};
  if (siteId) filter.site_id = siteId;
  if (chemicalId) filter.chemical_id = chemicalId;

  const readings = await StockReading.find(filter).sort({ recorded_at: -1 }).limit(100).lean();

  return NextResponse.json(
    readings.map((r) => ({
      id: r._id.toString(),
      chemicalId: (r.chemical_id as mongoose.Types.ObjectId).toString(),
      name: r.name,
      unit: r.unit,
      quantity: r.quantity,
      consumption: r.consumption,
      recordedAt: (r.recorded_at as Date).toISOString(),
    })),
  );
}
