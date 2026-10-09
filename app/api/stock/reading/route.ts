import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { ChemicalStock, StockReading, User } from '@/lib/models';
import { recomputeChemical } from '@/lib/stock-ledger';
import { brusselsInstant } from '@/lib/dates';
import { getSessionFromRequest } from '@/lib/session';
import { sendPushToUser, afterResponse } from '@/lib/push';
import mongoose from 'mongoose';

// POST /api/stock/reading — record a physical stock count for one product.
// Consumption since the previous reading is derived automatically:
// previous.quantity + deliveries + transfers in - transfers out since then - new quantity.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { chemicalId?: string; quantity?: number; recordedAt?: string };
  const chemicalId = body.chemicalId;
  const quantity = Number(body.quantity);
  if (!chemicalId || !Number.isFinite(quantity) || quantity < 0) {
    return NextResponse.json({ error: 'Ongeldige gegevens' }, { status: 400 });
  }

  await dbConnect();

  const stock = await ChemicalStock.findById(chemicalId);
  if (!stock) return NextResponse.json({ error: 'Product niet gevonden' }, { status: 404 });

  // A missing count can be filled in afterwards for the date it belongs to
  // (never in the future). The chain is then re-derived in date order.
  const now = new Date();
  let recordedAt = now;
  if (body.recordedAt) {
    const parsed = new Date(body.recordedAt);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() < now.getTime()) recordedAt = parsed;
  }
  // Only counts from an earlier day skip the low-stock push; today's count still alerts.
  const isBackdated = now.getTime() - recordedAt.getTime() > 12 * 36e5;

  // One count per product per day: a second count on the same (Brussels) day replaces
  // the first instead of creating a zero-length period with bogus consumption.
  const dayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(recordedAt);
  const sameDay = await StockReading.findOne({
    chemical_id: stock._id,
    recorded_at: { $gte: brusselsInstant(dayStr, '00:00:00'), $lte: brusselsInstant(dayStr, '23:59:59') },
  });
  if (sameDay) {
    sameDay.quantity = quantity;
    if (session.userId) sameDay.recorded_by = new mongoose.Types.ObjectId(session.userId);
    await sameDay.save();
  }

  const reading = sameDay ?? await StockReading.create({
    site_id: stock.site_id,
    chemical_id: stock._id,
    name: stock.name,
    unit: stock.unit,
    quantity,
    consumption: 0,
    recorded_at: recordedAt,
    recorded_by: session.userId ? new mongoose.Types.ObjectId(session.userId) : undefined,
  });

  await recomputeChemical(chemicalId);

  const saved = await StockReading.findById(reading._id).select('consumption').lean();
  const consumption = (saved?.consumption as number) ?? 0;
  const isFirstReading = (await StockReading.countDocuments({ chemical_id: chemicalId, recorded_at: { $lt: recordedAt } })) === 0;
  const current = await ChemicalStock.findById(chemicalId).select('current_stock').lean();
  const currentStock = (current?.current_stock as number) ?? quantity;

  if (!isBackdated && stock.min_stock_alert > 0 && currentStock <= stock.min_stock_alert) {
    const siteId = (stock.site_id as mongoose.Types.ObjectId).toString();
    // Developers see every site regardless of their assigned site_ids —
    // owners stay scoped to their own sites.
    afterResponse(User.find({ is_active: true, $or: [{ role: 'developer' }, { site_ids: siteId, role: { $in: ['owner', 'technician', 'employee'] } }] })
      .select('_id')
      .lean()
      .then((notifyUsers) =>
        Promise.allSettled(
          notifyUsers
            .filter((u) => (u._id as mongoose.Types.ObjectId).toString() !== session.userId)
            .map((u) =>
              sendPushToUser((u._id as mongoose.Types.ObjectId).toString(), {
                title: `Lage voorraad: ${stock.name}`,
                body: `Nog ${currentStock} ${stock.unit} — controleer of een levering nodig is.`,
                url: `/instellingen?site=${siteId}&product=${stock._id.toString()}`,
              }),
            ),
        ),
      )
      .catch(() => {}));
  }

  return NextResponse.json({
    id: reading._id.toString(),
    quantity,
    consumption,
    isFirstReading,
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
