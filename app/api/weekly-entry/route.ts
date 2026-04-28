import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { WeeklyEntry, ChemicalStock } from '@/lib/models';

export async function POST(req: NextRequest) {
  await dbConnect();

  const body = await req.json();

  if (!body.site_id || !body.week_start) {
    return NextResponse.json({ error: 'site_id and week_start are required' }, { status: 400 });
  }

  const entry = await WeeklyEntry.create({
    site_id: body.site_id,
    week_start: new Date(body.week_start),
    water_liters: body.water_liters ?? 0,
    energy_kw: body.energy_kw ?? 0,
    salt_kg: body.salt_kg ?? 0,
    flock_kg: body.flock_kg ?? 0,
    cloth_units: body.cloth_units ?? 0,
    program_counts: body.program_counts ?? [],
    chemical_usages: body.chemical_usages ?? [],
  });

  // Deduct Ruitendoekjes from stock if used
  if (body.cloth_units > 0) {
    const clothStock = await ChemicalStock.findOne({ site_id: body.site_id, name: 'Ruitendoekjes' });
    if (clothStock) {
      clothStock.current_stock = Math.max(0, (clothStock.current_stock ?? 0) - body.cloth_units);
      clothStock.last_updated = new Date();
      await clothStock.save();
    }
  }

  // Deduct chemical usages from ChemicalStock
  const usages: { name: string; amount: number }[] = body.chemical_usages ?? [];
  if (usages.length > 0) {
    const names = [...new Set(usages.map((u) => u.name))];
    const stocks = await ChemicalStock.find({ site_id: body.site_id, name: { $in: names } });

    // Aggregate amounts per chemical name (multiple programs may use the same chemical)
    const amountByName: Record<string, number> = {};
    for (const u of usages) {
      amountByName[u.name] = (amountByName[u.name] ?? 0) + (u.amount ?? 0);
    }

    await Promise.all(
      stocks.map((s) => {
        const used = amountByName[s.name] ?? 0;
        if (used > 0) {
          s.current_stock = Math.max(0, (s.current_stock ?? 0) - used);
          s.last_updated = new Date();
          return s.save();
        }
      }),
    );
  }

  return NextResponse.json({ id: entry._id.toString() }, { status: 201 });
}
