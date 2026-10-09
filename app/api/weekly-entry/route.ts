import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { WeeklyEntry, ChemicalStock, MaintenanceTask, PriceConfig } from '@/lib/models';
import { priceAt } from '@/lib/prices';
import { computeTotalCost } from '@/lib/weeklyEntryCost';
import { getSessionFromRequest } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role === 'employee') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();

  const body = await req.json();

  if (!body.site_id || !body.week_start) {
    return NextResponse.json({ error: 'site_id and week_start are required' }, { status: 400 });
  }

  const tellerstand: number = body.tellerstand ?? 0;

  // Calculate total cost using the latest PriceConfig for this site
  const priceConfig = priceAt(await PriceConfig.find({ site_id: body.site_id }).lean(), new Date(body.week_start));
  const total_cost = computeTotalCost(body, priceConfig as Record<string, unknown> | null);

  const entry = await WeeklyEntry.create({
    site_id: body.site_id,
    week_start: new Date(body.week_start),
    tellerstand,
    water_liters: body.water_liters ?? 0,
    water_tellerstand: body.water_tellerstand ?? 0,
    energy_kw: body.energy_kw ?? 0,
    salt_kg: body.salt_kg ?? 0,
    flock_kg: body.flock_kg ?? 0,
    cloth_units: body.cloth_units ?? 0,
    program_counts: body.program_counts ?? [],
    chemical_usages: body.chemical_usages ?? [],
    total_cost,
  });

  // Update is_overdue for all washes-based maintenance tasks for this site
  if (tellerstand > 0) {
    const washesTasks = await MaintenanceTask.find({ site_id: body.site_id, trigger_type: 'washes' }).lean();
    await Promise.all(
      washesTasks.map((t) => {
        const interval = (t.trigger_value as number) ?? 0;
        if (interval === 0) return;
        const isOverdue = tellerstand >= ((t.washes_at_last_done as number) ?? 0) + interval;
        return MaintenanceTask.updateOne({ _id: t._id }, { $set: { is_overdue: isOverdue } });
      }),
    );
  }

  // Deduct Ruitendoekjes from stock if used
  if (body.cloth_units > 0) {
    const clothStock = await ChemicalStock.findOne({ site_id: body.site_id, name: 'Ruitendoekjes' });
    if (clothStock) {
      clothStock.current_stock = Math.max(0, (clothStock.current_stock ?? 0) - body.cloth_units);
      clothStock.last_updated = new Date();
      await clothStock.save();
    }
  }

  return NextResponse.json({ id: entry._id.toString() }, { status: 201 });
}
