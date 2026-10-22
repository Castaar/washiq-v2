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

  if (typeof body.start_water_count === 'number') {
    update.start_water_count = body.start_water_count;
  }

  // Machine counter set back to 0: keep a sorted list of {date, end_value}.
  const add = body.add_counter_reset as { date?: unknown; end_value?: unknown } | undefined;
  const remove = body.remove_counter_reset;
  if (add || typeof remove === 'string') {
    const current = await Site.findById(id).select('counter_resets').lean();
    if (!current) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
    let resets = ((current.counter_resets as { date: string; end_value: number }[]) ?? []).map((r) => ({ date: r.date, end_value: r.end_value }));
    if (add) {
      const date = typeof add.date === 'string' ? add.date : '';
      const endValue = Number(add.end_value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(endValue) || endValue <= 0) {
        return NextResponse.json({ error: 'Ongeldige datum of eindstand' }, { status: 400 });
      }
      resets = resets.filter((r) => r.date !== date).concat({ date, end_value: endValue });
    }
    if (typeof remove === 'string') resets = resets.filter((r) => r.date !== remove);
    update.counter_resets = resets.sort((a, b) => a.date.localeCompare(b.date));
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Geen geldige velden' }, { status: 400 });
  }

  const site = await Site.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!site) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
  if (update.counter_resets) return NextResponse.json({ ok: true, counter_resets: update.counter_resets });

  return NextResponse.json({ ok: true, start_car_count: site.start_car_count, start_water_count: site.start_water_count });
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
