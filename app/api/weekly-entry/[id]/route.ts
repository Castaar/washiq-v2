import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { WeeklyEntry, PriceConfig } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { computeTotalCost } from '@/lib/weeklyEntryCost';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await dbConnect();
  const entry = await WeeklyEntry.findById(id).lean();
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  await dbConnect();

  const entry = await WeeklyEntry.findById(id).lean();
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const priceConfig = await PriceConfig.findOne({ site_id: entry.site_id }).sort({ valid_from: -1 }).lean();
  const total_cost = computeTotalCost(body, priceConfig as Record<string, unknown> | null);

  const update: Record<string, unknown> = {
    water_liters: body.water_liters ?? 0,
    water_tellerstand: body.water_tellerstand ?? 0,
    energy_kw: body.energy_kw ?? 0,
    salt_kg: body.salt_kg ?? 0,
    flock_kg: body.flock_kg ?? 0,
    cloth_units: body.cloth_units ?? 0,
    blob_liters: body.blob_liters ?? 0,
    program_counts: body.program_counts ?? [],
    chemical_usages: body.chemical_usages ?? [],
    total_cost,
  };
  if (body.tellerstand !== undefined) update.tellerstand = body.tellerstand;
  if (body.week_start) update.week_start = new Date(body.week_start);

  await WeeklyEntry.findByIdAndUpdate(id, update);

  return NextResponse.json({ ok: true });
}
