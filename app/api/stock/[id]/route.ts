import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { ChemicalStock, StockAdjustment, StockDelivery, StockReading } from '@/lib/models';
import { recomputeChemical } from '@/lib/stock-ledger';
import { getSession } from '@/lib/session';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authSession = await getSession();
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isManager = authSession.role === 'owner' || authSession.role === 'developer';

  await dbConnect();

  const { id } = await params;
  const body = await req.json();

  // Non-managers may only log deliveries, never override stock or product settings.
  if (!isManager && (typeof body.set_stock === 'number' || typeof body.min_stock_alert === 'number' || body.name || body.unit)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stock = await ChemicalStock.findById(id);
  if (!stock) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Stock override. Before the first count it seeds the baseline count; after that
  // it is recorded as a correction (+/- difference) so the ledger stays complete and
  // the corrected amount is not counted as consumption.
  let needsRecompute = false;
  if (typeof body.set_stock === 'number' && Number.isFinite(body.set_stock) && body.set_stock >= 0) {
    const hasReading = await StockReading.exists({ chemical_id: stock._id });
    if (!hasReading) {
      stock.current_stock = body.set_stock;
      stock.last_updated = new Date();
      await StockReading.create({
        site_id: stock.site_id,
        chemical_id: stock._id,
        name: stock.name,
        unit: stock.unit,
        quantity: body.set_stock,
        consumption: 0,
        recorded_at: new Date(),
        recorded_by: authSession.userId ? new mongoose.Types.ObjectId(authSession.userId) : undefined,
      });
    } else {
      // Compare against what the ledger says is in stock right now
      await recomputeChemical(stock._id);
      const derived = await ChemicalStock.findById(stock._id).select('current_stock').lean();
      stock.current_stock = (derived as { current_stock?: number } | null)?.current_stock ?? stock.current_stock ?? 0;
      const delta = body.set_stock - (stock.current_stock ?? 0);
      if (delta !== 0) {
        await StockAdjustment.create({
          site_id: stock.site_id,
          chemical_id: stock._id,
          quantity: delta,
          from_value: stock.current_stock ?? 0,
          to_value: body.set_stock,
          note: typeof body.note === 'string' ? body.note.trim() : '',
          adjusted_at: new Date(),
          logged_by: authSession.userId ? new mongoose.Types.ObjectId(authSession.userId) : undefined,
          logged_by_name: authSession.name ?? '',
        });
        needsRecompute = true;
      }
    }
  }

  // If a delivery quantity is provided, log it and increase current_stock
  if (typeof body.delivery_quantity === 'number' && body.delivery_quantity > 0) {
    const session = await getSession();

    await StockDelivery.create({
      site_id: stock.site_id,
      chemical_id: stock._id,
      quantity: body.delivery_quantity,
      unit_price: Number(body.unit_price) || 0,
      delivered_at: new Date(),
      logged_by: session?.userId ? new mongoose.Types.ObjectId(session.userId) : undefined,
      logged_by_name: session?.name ?? '',
    });

    stock.current_stock = (stock.current_stock ?? 0) + body.delivery_quantity;
    stock.last_updated = new Date();
  }

  // Allow updating metadata fields
  if (typeof body.min_stock_alert === 'number') {
    stock.min_stock_alert = body.min_stock_alert;
  }
  if (typeof body.name === 'string' && body.name.trim()) {
    stock.name = body.name.trim();
  }
  if (typeof body.unit === 'string' && body.unit.trim()) {
    stock.unit = body.unit.trim();
  }

  await stock.save();
  if (needsRecompute) {
    await recomputeChemical(stock._id);
    const fresh = await ChemicalStock.findById(stock._id).select('current_stock last_updated').lean();
    if (fresh) {
      stock.current_stock = (fresh as { current_stock: number }).current_stock;
      stock.last_updated = (fresh as { last_updated: Date }).last_updated;
    }
  }

  return NextResponse.json({
    id: stock._id.toString(),
    name: stock.name,
    current_stock: stock.current_stock,
    min_stock_alert: stock.min_stock_alert,
    unit: stock.unit,
    last_updated: stock.last_updated,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();

  const { id } = await params;

  const stock = await ChemicalStock.findByIdAndDelete(id);
  if (!stock) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Remove related deliveries too
  await Promise.all([StockDelivery.deleteMany({ chemical_id: id }), StockAdjustment.deleteMany({ chemical_id: id })]);

  return NextResponse.json({ success: true });
}
