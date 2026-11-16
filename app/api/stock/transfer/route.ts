import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db/mongoose';
import { ChemicalStock, Site, StockTransfer } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sameProductName } from '@/lib/product-name';

// POST /api/stock/transfer — move stock of one product from one site to another.
// Writes a StockTransfer record so the move is part of the ledger: it counts as
// outflow at the source and inflow at the target when consumption is derived.
// Anyone logged in may move stock (same as logging a delivery); undoing is manager-only.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  const body = await req.json() as {
    fromSiteId?: string;
    toSiteId?: string;
    name?: string;
    quantity?: number;
  };

  const { fromSiteId, toSiteId, name } = body;
  const quantity = Number(body.quantity);

  if (!fromSiteId || !toSiteId || !name || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'Ongeldige gegevens' }, { status: 400 });
  }
  if (fromSiteId === toSiteId) {
    return NextResponse.json({ error: 'Bron en bestemming zijn dezelfde carwash' }, { status: 400 });
  }

  await dbConnect();

  const fromStock = await ChemicalStock.findOne({ site_id: fromSiteId, name });
  if (!fromStock) return NextResponse.json({ error: 'Product niet gevonden bij bronsite' }, { status: 404 });

  const now = new Date();

  fromStock.current_stock = Math.max(0, (fromStock.current_stock ?? 0) - quantity);
  fromStock.last_updated = now;
  await fromStock.save();

  // Same product at the target, even when spelled with another capital/spacing there;
  // only when it really doesn't exist is it created (with the source's name).
  const targetNames = await ChemicalStock.find({ site_id: toSiteId }).select('name').lean();
  const targetName = (targetNames.find((s) => sameProductName(s.name as string, name))?.name as string | undefined) ?? name;
  const toStock = await ChemicalStock.findOneAndUpdate(
    { site_id: toSiteId, name: targetName },
    {
      $inc: { current_stock: quantity },
      $set: { last_updated: now },
      $setOnInsert: { site_id: toSiteId, name: targetName, unit: fromStock.unit, min_stock_alert: 0 },
    },
    { upsert: true, new: true },
  );

  const transfer = await StockTransfer.create({
    from_site_id: fromSiteId,
    to_site_id: toSiteId,
    from_chemical_id: fromStock._id,
    to_chemical_id: toStock._id,
    name,
    unit: fromStock.unit,
    quantity,
    transferred_at: now,
    logged_by: session.userId ? new mongoose.Types.ObjectId(session.userId) : undefined,
    logged_by_name: session.name ?? '',
  });

  const toSite = await Site.findById(toSiteId).select('name').lean();

  return NextResponse.json({
    ok: true,
    id: transfer._id.toString(),
    toSiteName: (toSite as { name?: string } | null)?.name ?? '',
    from: { id: fromStock._id.toString(), current_stock: fromStock.current_stock },
    to: { id: toStock._id.toString(), current_stock: toStock.current_stock },
  });
}

// GET /api/stock/transfer?siteId=xxx — transfers in or out of this site, newest first
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();

  const rows = await StockTransfer.find({ $or: [{ from_site_id: siteId }, { to_site_id: siteId }] })
    .sort({ transferred_at: -1 })
    .limit(200)
    .populate('from_site_id', 'name')
    .populate('to_site_id', 'name')
    .lean();

  return NextResponse.json(
    rows.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      unit: r.unit,
      quantity: r.quantity,
      fromSiteName: (r.from_site_id as unknown as { name?: string } | null)?.name ?? '',
      toSiteName: (r.to_site_id as unknown as { name?: string } | null)?.name ?? '',
      transferredAt: (r.transferred_at as Date).toISOString(),
      loggedByName: r.logged_by_name ?? '',
    })),
  );
}
