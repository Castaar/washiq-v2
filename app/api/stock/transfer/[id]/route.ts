import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { ChemicalStock, StockTransfer } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { recomputeChemical } from '@/lib/stock-ledger';

// DELETE /api/stock/transfer/[id] — undo a transfer: stock returns to the source
// site, leaves the target site, and consumption of later counts is re-derived.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();
  const { id } = await params;

  const transfer = await StockTransfer.findById(id);
  if (!transfer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const qty = transfer.quantity as number;
  await ChemicalStock.updateOne(
    { _id: transfer.from_chemical_id },
    { $inc: { current_stock: qty }, $set: { last_updated: new Date() } },
  );
  const toStock = await ChemicalStock.findById(transfer.to_chemical_id);
  if (toStock) {
    toStock.current_stock = Math.max(0, (toStock.current_stock ?? 0) - qty);
    toStock.last_updated = new Date();
    await toStock.save();
  }

  const fromId = transfer.from_chemical_id.toString();
  const toId = transfer.to_chemical_id.toString();
  await transfer.deleteOne();

  await Promise.all([recomputeChemical(fromId), recomputeChemical(toId)]);

  return NextResponse.json({ success: true });
}
