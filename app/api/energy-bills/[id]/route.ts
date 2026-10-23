import { NextRequest, NextResponse } from 'next/server';
import type { Types } from 'mongoose';
import { dbConnect } from '@/lib/db/mongoose';
import { EnergyBill } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { canManageSite } from '@/lib/permissions';

async function findManageableBill(req: NextRequest, id: string) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  await dbConnect();
  const bill = await EnergyBill.findById(id);
  if (!bill) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!canManageSite(session, (bill.site_id as Types.ObjectId).toString())) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { bill };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { bill, error } = await findManageableBill(req, id);
  if (error) return error;

  const { amount_euro } = await req.json();
  bill.amount_euro = Number(amount_euro);
  await bill.save();

  return NextResponse.json({ id: bill._id.toString(), year: bill.year, month: bill.month, amount_euro: bill.amount_euro });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { bill, error } = await findManageableBill(req, id);
  if (error) return error;

  await bill.deleteOne();
  return NextResponse.json({ success: true });
}
