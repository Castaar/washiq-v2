import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { WashProgram } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  await dbConnect();

  const query = siteId ? { site_id: siteId } : {};
  const docs = await WashProgram.find(query).select('_id site_id name tier chemicals').lean();

  const programs = docs.map((p) => ({
    id: (p._id as Types.ObjectId).toString(),
    siteId: (p.site_id as Types.ObjectId).toString(),
    name: (p.name as string) ?? '',
    tier: (p.tier as number) ?? 0,
    chemicals: (p.chemicals as string[]) ?? [],
  }));

  return NextResponse.json(programs);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as {
    siteId: string;
    name: string;
    tier: number;
    chemicals: string[];
  };

  if (!body.siteId || !body.name) {
    return NextResponse.json({ error: 'siteId and name are required' }, { status: 400 });
  }

  await dbConnect();

  const doc = await WashProgram.create({
    site_id: body.siteId,
    name: body.name.trim(),
    tier: body.tier ?? 1,
    chemicals: (body.chemicals ?? []).map((c: string) => c.trim()).filter(Boolean),
    chemical_ids: [],
    includes_cloth: false,
    cloth_cost: 0,
  });

  return NextResponse.json({ id: (doc._id as Types.ObjectId).toString() }, { status: 201 });
}
