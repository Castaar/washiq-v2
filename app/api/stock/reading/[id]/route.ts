import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { StockReading } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { recomputeChemical } from '@/lib/stock-ledger';

async function guard(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) return null;
  return session;
}

// DELETE /api/stock/reading/[id] — remove a wrong count. The product's stock returns
// to the previous count + movements since, and the next count's consumption is re-derived.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await dbConnect();
  const { id } = await params;

  const reading = await StockReading.findById(id);
  if (!reading) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const chemicalId = reading.chemical_id.toString();
  await reading.deleteOne();
  await recomputeChemical(chemicalId);

  return NextResponse.json({ success: true });
}

// PATCH /api/stock/reading/[id] — correct the counted quantity
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await dbConnect();
  const { id } = await params;
  const quantity = Number((await req.json() as { quantity?: number }).quantity);
  if (!Number.isFinite(quantity) || quantity < 0) {
    return NextResponse.json({ error: 'Ongeldige hoeveelheid' }, { status: 400 });
  }

  const reading = await StockReading.findById(id);
  if (!reading) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  reading.quantity = quantity;
  await reading.save();
  await recomputeChemical(reading.chemical_id.toString());

  return NextResponse.json({ success: true });
}
