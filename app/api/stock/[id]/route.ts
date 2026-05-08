import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { ChemicalStock, StockDelivery } from '@/lib/models';
import { getSession } from '@/lib/session';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await dbConnect();

  const { id } = await params;
  const body = await req.json();

  const stock = await ChemicalStock.findById(id);
  if (!stock) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Direct stock override (used by initial setup flow — no delivery log)
  if (typeof body.set_stock === 'number') {
    stock.current_stock = body.set_stock;
    stock.last_updated = new Date();
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
  await StockDelivery.deleteMany({ chemical_id: id });

  return NextResponse.json({ success: true });
}
