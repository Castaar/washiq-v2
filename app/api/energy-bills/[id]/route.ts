import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { EnergyBill } from '@/lib/models';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await dbConnect();
  const { id } = await params;
  const { amount_euro } = await req.json();

  const bill = await EnergyBill.findByIdAndUpdate(
    id,
    { amount_euro: Number(amount_euro) },
    { new: true },
  );
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ id: bill._id.toString(), year: bill.year, month: bill.month, amount_euro: bill.amount_euro });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await dbConnect();
  const { id } = await params;
  const bill = await EnergyBill.findByIdAndDelete(id);
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
