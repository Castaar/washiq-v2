import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { EnergyBill } from '@/lib/models';

export async function GET(req: NextRequest) {
  await dbConnect();
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const bills = await EnergyBill.find({ site_id: siteId }).sort({ year: -1, month: -1 }).lean();
  return NextResponse.json(bills.map((b) => ({
    id: b._id.toString(),
    year: b.year,
    month: b.month,
    amount_euro: b.amount_euro,
  })));
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const body = await req.json();
  const { siteId, year, month, amount_euro } = body;

  if (!siteId || !year || !month || amount_euro === undefined) {
    return NextResponse.json({ error: 'siteId, year, month and amount_euro are required' }, { status: 400 });
  }

  // Upsert: one bill per site/year/month
  const bill = await EnergyBill.findOneAndUpdate(
    { site_id: siteId, year, month },
    { amount_euro: Number(amount_euro), created_at: new Date() },
    { upsert: true, new: true },
  );

  return NextResponse.json({ id: bill._id.toString(), year: bill.year, month: bill.month, amount_euro: bill.amount_euro }, { status: 201 });
}
