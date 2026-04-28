import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { WeeklyEntry } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

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

  await WeeklyEntry.findByIdAndUpdate(id, {
    water_liters: body.water_liters ?? 0,
    energy_kw: body.energy_kw ?? 0,
    salt_kg: body.salt_kg ?? 0,
    flock_kg: body.flock_kg ?? 0,
    cloth_units: body.cloth_units ?? 0,
    program_counts: body.program_counts ?? [],
    chemical_usages: body.chemical_usages ?? [],
  });

  return NextResponse.json({ ok: true });
}
