import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { OrderItem } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// GET /api/orders/items?siteId=xxx — catalog for a site, all roles
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();
  const docs = await OrderItem.find({ site_id: siteId, is_active: true }).sort({ name: 1 }).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      name: d.name,
      description: d.description ?? '',
    })),
  );
}

// POST /api/orders/items — create catalog item, owner/developer only
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { siteId: string; name: string; description?: string };
  if (!body.siteId || !body.name?.trim()) {
    return NextResponse.json({ error: 'siteId and name required' }, { status: 400 });
  }

  await dbConnect();
  const doc = await OrderItem.create({
    site_id: body.siteId,
    name: body.name.trim(),
    description: body.description?.trim() ?? '',
  });

  return NextResponse.json({ id: (doc._id as Types.ObjectId).toString() }, { status: 201 });
}
