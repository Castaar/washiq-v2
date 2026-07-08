import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { PriceConfig } from '@/lib/models';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  await dbConnect();
  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const config = await PriceConfig.findOne({ site_id: siteId }).sort({ valid_from: -1 }).lean();
  if (!config) return NextResponse.json(null);

  return NextResponse.json({
    id: config._id.toString(),
    water_per_liter: config.water_per_liter ?? 0,
    energy_per_kw: (config.energy_per_kw as number) ?? 0,
    salt_per_kg: config.salt_per_kg ?? 0,
    flock_per_kg: config.flock_per_kg ?? 0,
    cloth_per_unit: (config.cloth_per_unit as number) ?? 0,
    chemicals: ((config.chemicals as { name: string; price_per_unit: number }[]) ?? []).map((c) => ({
      name: c.name,
      price_per_unit: c.price_per_unit,
    })),
  });
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const session = await getSession();
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { siteId, water_per_liter, energy_per_kw, salt_per_kg, flock_per_kg, cloth_per_unit, chemicals } = body;
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  const config = await PriceConfig.findOneAndUpdate(
    { site_id: siteId },
    {
      site_id: siteId,
      water_per_liter: Number(water_per_liter) || 0,
      energy_per_kw: Number(energy_per_kw) || 0,
      salt_per_kg: Number(salt_per_kg) || 0,
      flock_per_kg: Number(flock_per_kg) || 0,
      cloth_per_unit: Number(cloth_per_unit) || 0,
      chemicals: (chemicals ?? []).map((c: { name: string; price_per_unit: string | number }) => ({
        name: c.name,
        price_per_unit: Number(c.price_per_unit) || 0,
      })),
      valid_from: new Date(),
    },
    { upsert: true, new: true },
  );

  return NextResponse.json({ id: config._id.toString() }, { status: 200 });
}
