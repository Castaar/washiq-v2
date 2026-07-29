import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

export async function GET() {
  await dbConnect();
  const sites = await Site.find({}).select('_id name location').lean();
  return NextResponse.json(sites);
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'developer' && session.role !== 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as { name: string; location: string };
  if (!body.name || !body.location) {
    return NextResponse.json({ error: 'name and location are required' }, { status: 400 });
  }

  await dbConnect();
  const doc = await Site.create({
    name: body.name.trim(),
    location: body.location.trim(),
    created_at: new Date(),
  });

  if (session.role === 'owner') {
    await User.findByIdAndUpdate(session.userId, { $addToSet: { site_ids: doc._id } });
  }

  return NextResponse.json(
    { id: (doc._id as Types.ObjectId).toString(), name: doc.name, location: doc.location },
    { status: 201 },
  );
}
