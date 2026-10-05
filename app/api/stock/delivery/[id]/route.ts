import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { ChemicalStock, StockDelivery } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { recomputeChemical } from '@/lib/stock-ledger';

async function guard(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) return null;
  return session;
}

// DELETE /api/stock/delivery/[id] — remove a wrong delivery; stock and later
// consumption fall back to what the remaining records imply.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await dbConnect();
  const { id } = await params;

  const delivery = await StockDelivery.findById(id);
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const chemicalId = delivery.chemical_id?.toString() ?? null;
  const qty = (delivery.quantity as number) ?? 0;
  await delivery.deleteOne();

  if (chemicalId && qty > 0) {
    const stock = await ChemicalStock.findById(chemicalId);
    if (stock) {
      stock.current_stock = Math.max(0, (stock.current_stock ?? 0) - qty);
      stock.last_updated = new Date();
      await stock.save();
    }
    await recomputeChemical(chemicalId);
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/stock/delivery/[id] — correct the quantity of a delivery (or the text of a "diverse" note)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await dbConnect();
  const { id } = await params;
  const body = await req.json() as { quantity?: number; note?: string };

  const delivery = await StockDelivery.findById(id);
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!delivery.chemical_id) {
    if (typeof body.note === 'string' && body.note.trim()) {
      delivery.note = body.note.trim();
      await delivery.save();
    }
    return NextResponse.json({ success: true });
  }

  const newQty = Number(body.quantity);
  if (!Number.isFinite(newQty) || newQty <= 0) {
    return NextResponse.json({ error: 'Ongeldige hoeveelheid' }, { status: 400 });
  }

  const diff = newQty - ((delivery.quantity as number) ?? 0);
  delivery.quantity = newQty;
  await delivery.save();

  const stock = await ChemicalStock.findById(delivery.chemical_id);
  if (stock) {
    stock.current_stock = Math.max(0, (stock.current_stock ?? 0) + diff);
    stock.last_updated = new Date();
    await stock.save();
  }
  await recomputeChemical(delivery.chemical_id.toString());

  return NextResponse.json({ success: true });
}
