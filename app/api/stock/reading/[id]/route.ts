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

// PATCH /api/stock/reading/[id] — correct the counted quantity, the date, or mark the count (in)valid
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await dbConnect();
  const { id } = await params;
  const body = await req.json() as { quantity?: number; recordedAt?: string; invalid?: boolean };

  const reading = await StockReading.findById(id);
  if (!reading) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return NextResponse.json({ error: 'Ongeldige hoeveelheid' }, { status: 400 });
    }
    reading.quantity = quantity;
  }
  if (body.recordedAt !== undefined) {
    const at = new Date(body.recordedAt);
    if (Number.isNaN(at.getTime()) || at.getTime() > Date.now()) {
      return NextResponse.json({ error: 'Ongeldige datum (niet in de toekomst)' }, { status: 400 });
    }
    reading.recorded_at = at;
  }

  if (typeof body.invalid === 'boolean') reading.is_invalid = body.invalid;

  await reading.save();
  await recomputeChemical(reading.chemical_id.toString());

  return NextResponse.json({ success: true });
}
