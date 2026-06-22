import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { WashProgram, ChemicalStock, MaintenanceTask } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { id: sourceSiteId } = await params;
  const body = await req.json() as {
    targetSiteId: string;
    copyPrograms?: boolean;
    copyProducts?: boolean;
    copyMaintenance?: boolean;
  };

  const { targetSiteId, copyPrograms = true, copyProducts = true, copyMaintenance = true } = body;

  if (!targetSiteId) {
    return NextResponse.json({ error: 'targetSiteId is required' }, { status: 400 });
  }

  const results = { programs: 0, products: 0, maintenance: 0 };

  if (copyProducts) {
    const sourceProducts = await ChemicalStock.find({ site_id: sourceSiteId }).lean();
    const existingProducts = await ChemicalStock.find({ site_id: targetSiteId }).select('name').lean();
    const existingNames = new Set(existingProducts.map((p) => p.name as string));
    const toCreate = sourceProducts.filter((p) => !existingNames.has(p.name as string));
    if (toCreate.length > 0) {
      await ChemicalStock.insertMany(
        toCreate.map((p) => ({
          site_id: targetSiteId,
          name: p.name,
          current_stock: 0,
          min_stock_alert: p.min_stock_alert ?? 0,
          unit: p.unit,
          last_updated: new Date(),
        })),
      );
      results.products = toCreate.length;
    }
  }

  if (copyPrograms) {
    const sourcePrograms = await WashProgram.find({ site_id: sourceSiteId }).lean();
    const existingPrograms = await WashProgram.find({ site_id: targetSiteId }).select('name').lean();
    const existingNames = new Set(existingPrograms.map((p) => p.name as string));
    const toCreate = sourcePrograms.filter((p) => !existingNames.has(p.name as string));
    if (toCreate.length > 0) {
      await WashProgram.insertMany(
        toCreate.map((p) => ({
          site_id: targetSiteId,
          name: p.name,
          tier: p.tier,
          chemicals: p.chemicals ?? [],
          chemical_ids: [],
          includes_cloth: p.includes_cloth ?? false,
          cloth_cost: p.cloth_cost ?? 0,
        })),
      );
      results.programs = toCreate.length;
    }
  }

  if (copyMaintenance) {
    const sourceTasks = await MaintenanceTask.find({ site_id: sourceSiteId }).lean();
    const existingTasks = await MaintenanceTask.find({ site_id: targetSiteId }).select('description').lean();
    const existingDescs = new Set(existingTasks.map((t) => t.description as string));
    const toCreate = sourceTasks.filter((t) => !existingDescs.has(t.description as string));
    if (toCreate.length > 0) {
      await MaintenanceTask.insertMany(
        toCreate.map((t) => ({
          site_id: targetSiteId,
          description: t.description,
          trigger_type: t.trigger_type,
          trigger_value: t.trigger_value ?? 0,
          trigger_day: t.trigger_day ?? 0,
          trigger_month: t.trigger_month ?? 0,
          trigger_month_list: t.trigger_month_list ?? [],
          last_done_at: null,
          washes_at_last_done: 0,
          is_overdue: false,
        })),
      );
      results.maintenance = toCreate.length;
    }
  }

  return NextResponse.json({ ok: true, results });
}
