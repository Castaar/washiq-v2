import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, PriceConfig, MaintenanceTask } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// POST /api/setup — save initial setup for a site and mark it done
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    siteId: string;
    tellerstand: number;
    tellerstandDate?: string;
    waterTellerstand?: number;
    prices?: {
      water_per_liter: number;
      energy_per_kw: number;
      salt_per_kg: number;
      flock_per_kg: number;
      cloth_per_unit: number;
    };
    maintenanceTasks?: {
      description: string;
      trigger_type: 'washes' | 'months' | 'fixed_date' | 'fixed_months';
      trigger_value: number;
      trigger_day?: number;
      trigger_month?: number;
      trigger_month_list?: number[];
      last_done_at?: string;
      washes_at_last_done?: number;
    }[];
  };

  if (!body.siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();

  const ops: Promise<unknown>[] = [];

  // Update initial tellerstand on site
  ops.push(
    Site.findByIdAndUpdate(body.siteId, {
      start_car_count: body.tellerstand ?? 0,
      start_car_count_date: body.tellerstandDate ? new Date(body.tellerstandDate) : new Date(),
      start_water_count: body.waterTellerstand ?? 0,
      setup_done: true,
    }),
  );

  // Upsert price config
  if (body.prices) {
    ops.push(
      PriceConfig.findOneAndUpdate(
        { site_id: body.siteId },
        { ...body.prices, site_id: body.siteId, valid_from: new Date() },
        { upsert: true, new: true },
      ),
    );
  }

  // Create maintenance tasks (skip duplicates by checking description)
  if (body.maintenanceTasks?.length) {
    const existing = await MaintenanceTask.find({ site_id: body.siteId }).select('description').lean();
    const existingDescs = new Set(existing.map((t) => t.description));

    const newTasks = body.maintenanceTasks.filter((t) => !existingDescs.has(t.description));
    if (newTasks.length) {
      ops.push(
        MaintenanceTask.insertMany(
          newTasks.map((t) => ({
            site_id: body.siteId,
            description: t.description,
            trigger_type: t.trigger_type,
            trigger_value: t.trigger_value ?? 0,
            trigger_day: t.trigger_day ?? 0,
            trigger_month: t.trigger_month ?? 0,
            trigger_month_list: t.trigger_month_list ?? [],
            last_done_at: t.last_done_at ? new Date(t.last_done_at) : undefined,
            washes_at_last_done: t.washes_at_last_done ?? 0,
            is_overdue: false,
          })),
        ),
      );
    }
  }

  await Promise.all(ops);

  return NextResponse.json({ ok: true });
}
