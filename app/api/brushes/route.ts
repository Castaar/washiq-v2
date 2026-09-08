import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Brush } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// GET /api/brushes?siteId=xxx — list all brushes for a site, all roles
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();
  const docs = await Brush.find({ site_id: siteId }).sort({ category: 1, order: 1 }).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      category: d.category,
      label: d.label,
      order: d.order,
      washesAtLastReplacement: d.washes_at_last_replacement ?? 0,
      lastReplacedAt: d.last_replaced_at ? (d.last_replaced_at as Date).toISOString() : null,
    })),
  );
}

// POST /api/brushes — add a new brush, owner/developer only
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    siteId: string;
    category: 'verticaal_links' | 'verticaal_rechts' | 'horizontaal';
    label: string;
    currentTellerstand?: number;
  };
  if (!body.siteId || !body.category || !body.label?.trim()) {
    return NextResponse.json({ error: 'siteId, category and label required' }, { status: 400 });
  }

  await dbConnect();

  const count = await Brush.countDocuments({ site_id: body.siteId, category: body.category });

  const doc = await Brush.create({
    site_id: body.siteId,
    category: body.category,
    label: body.label.trim(),
    order: count,
    // A brush added today starts its wear count from today's tellerstand,
    // not from zero — otherwise it would look worn out immediately.
    washes_at_last_replacement: body.currentTellerstand ?? 0,
    last_replaced_at: new Date(),
  });

  return NextResponse.json({ id: (doc._id as Types.ObjectId).toString() }, { status: 201 });
}
