import mongoose from 'mongoose';
import { ChemicalStock, StockDelivery, StockReading, StockTransfer } from '@/lib/models';

type Oid = string | mongoose.Types.ObjectId;

// Net stock movement for one product between two instants (from exclusive, to inclusive):
// + deliveries, + transfers in from another site, - transfers out to another site.
export async function movementBetween(
  chemicalId: Oid,
  from: Date | null,
  to: Date,
): Promise<{ delivered: number; transferredIn: number; transferredOut: number }> {
  const range = (field: string) => ({ [field]: { ...(from ? { $gt: from } : {}), $lte: to } });

  const [deliveries, ins, outs] = await Promise.all([
    StockDelivery.find({ chemical_id: chemicalId, ...range('delivered_at') }).select('quantity').lean(),
    StockTransfer.find({ to_chemical_id: chemicalId, ...range('transferred_at') }).select('quantity').lean(),
    StockTransfer.find({ from_chemical_id: chemicalId, ...range('transferred_at') }).select('quantity').lean(),
  ]);
  const sum = (rows: { quantity?: number }[]) => rows.reduce((s, r) => s + (r.quantity ?? 0), 0);
  return { delivered: sum(deliveries), transferredIn: sum(ins), transferredOut: sum(outs) };
}

// Consumption between a previous count and a new count:
// previous + deliveries + transfers in - transfers out - new count.
export async function consumptionBetween(
  chemicalId: Oid,
  previous: { quantity: number; recorded_at: Date },
  newQuantity: number,
  at: Date,
): Promise<{ consumption: number; delivered: number; transferredIn: number; transferredOut: number }> {
  const m = await movementBetween(chemicalId, previous.recorded_at, at);
  const consumption = previous.quantity + m.delivered + m.transferredIn - m.transferredOut - newQuantity;
  return { consumption, ...m };
}

// Re-derive every reading's consumption and the product's current stock from the
// raw ledger (readings + deliveries + transfers). Call after any edit or delete of
// one of those records so the numbers always fall back to what the data implies.
export async function recomputeChemical(chemicalId: Oid): Promise<void> {
  const readings = await StockReading.find({ chemical_id: chemicalId }).sort({ recorded_at: 1 });
  if (readings.length === 0) return;

  for (let i = 0; i < readings.length; i++) {
    const cur = readings[i];
    let consumption = 0;
    if (i > 0) {
      const prev = readings[i - 1];
      ({ consumption } = await consumptionBetween(
        chemicalId,
        { quantity: prev.quantity as number, recorded_at: prev.recorded_at as Date },
        cur.quantity as number,
        cur.recorded_at as Date,
      ));
    }
    if (cur.consumption !== consumption) {
      cur.consumption = consumption;
      await cur.save();
    }
  }

  const last = readings[readings.length - 1];
  const m = await movementBetween(chemicalId, last.recorded_at as Date, new Date());
  const stock = await ChemicalStock.findById(chemicalId);
  if (stock) {
    stock.current_stock = Math.max(0, (last.quantity as number) + m.delivered + m.transferredIn - m.transferredOut);
    stock.last_updated = new Date();
    await stock.save();
  }
}
