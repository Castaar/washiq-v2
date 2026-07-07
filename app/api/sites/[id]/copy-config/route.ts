import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { WashProgram, ChemicalStock, MaintenanceTask, PriceConfig, User } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'developer' && session.role !== 'owner')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { id: sourceSiteId } = await params;
  const body = await req.json() as {
    targetSiteId: string;
    copyPrograms?: boolean;
    copyProducts?: boolean;
    copyMaintenance?: boolean;
    copyPrices?: boolean;
  };

  const { targetSiteId, copyPrograms = true, copyProducts = true, copyMaintenance = true, copyPrices = false } = body;

  // Owners may only copy between their own sites
  if (session.role === 'owner') {
    const userDoc = await User.findById(session.userId).select('site_ids').lean();
    const ownedSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
    if (!ownedSiteIds.includes(sourceSiteId) || !ownedSiteIds.includes(targetSiteId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (!targetSiteId) {
    return NextResponse.json({ error: 'targetSiteId is required' }, { status: 400 });
  }

  const results = { programs: 0, products: 0, maintenance: 0, prices: 0 };

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

  if (copyPrices) {
    const sourcePrice = await PriceConfig.findOne({ site_id: sourceSiteId }).sort({ valid_from: -1 }).lean();
    if (sourcePrice) {
      await PriceConfig.deleteMany({ site_id: targetSiteId });
      await PriceConfig.create({
        site_id: targetSiteId,
        valid_from: new Date(),
        water_per_liter: sourcePrice.water_per_liter ?? 0,
        salt_per_kg: sourcePrice.salt_per_kg ?? 0,
        flock_per_kg: sourcePrice.flock_per_kg ?? 0,
        cloth_per_unit: sourcePrice.cloth_per_unit ?? 0,
        energy_per_kw: (sourcePrice as Record<string, unknown>).energy_per_kw ?? 0,
        chemicals: (sourcePrice.chemicals ?? []) as { name: string; price_per_unit: number }[],
      });
      results.prices = 1;
    }
  }

  return NextResponse.json({ ok: true, results });
}
