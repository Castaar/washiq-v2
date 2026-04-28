import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import {
  Site,
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
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
  ]);

  await Site.findByIdAndDelete(id);

  return NextResponse.json({ ok: true });
}
