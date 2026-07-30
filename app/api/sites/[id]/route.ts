import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import {
  Site,
  User,
  WashProgram,
  WeeklyEntry,
  ChemicalStock,
  StockDelivery,
  MaintenanceTask,
  MaintenanceLog,
  DailyChecklist,
  PriceConfig,
} from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'developer' && session.role !== 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (typeof body.start_car_count === 'number') {
    update.start_car_count = body.start_car_count;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Geen geldige velden' }, { status: 400 });
  }

  const site = await Site.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!site) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });

  return NextResponse.json({ ok: true, start_car_count: site.start_car_count });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'developer' && session.role !== 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();

  // Cascade delete all site-related data
  await Promise.all([
    WashProgram.deleteMany({ site_id: id }),
    WeeklyEntry.deleteMany({ site_id: id }),
    ChemicalStock.deleteMany({ site_id: id }),
    StockDelivery.deleteMany({ site_id: id }),
    MaintenanceTask.deleteMany({ site_id: id }),
    MaintenanceLog.deleteMany({ site_id: id }),
    DailyChecklist.deleteMany({ site_id: id }),
    PriceConfig.deleteMany({ site_id: id }),
    User.updateMany({}, { $pull: { site_ids: id } }),
  ]);

  await Site.findByIdAndDelete(id);

  return NextResponse.json({ ok: true });
}
