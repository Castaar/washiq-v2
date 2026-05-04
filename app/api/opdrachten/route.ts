import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Opdracht } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// GET /api/opdrachten?siteId=xxx&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  const dateParam = req.nextUrl.searchParams.get('date');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();

  const filter: Record<string, unknown> = { site_id: siteId };

  if (dateParam) {
    const from = new Date(dateParam);
    const to = new Date(dateParam);
    to.setDate(to.getDate() + 1);
    filter.date = { $gte: from, $lt: to };
  } else {
    // Default: today + next 7 days
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    filter.date = { $gte: from, $lt: to };
  }

  // Employees only see their own assignments (or all-staff assignments with empty assigned_to_ids)
  if (session.role === 'employee') {
    filter.$or = [
      { assigned_to_ids: { $size: 0 } },
      { assigned_to_ids: session.userId },
    ];
  }

  const docs = await Opdracht.find(filter).sort({ date: 1, created_at: 1 }).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      siteId: (d.site_id as Types.ObjectId).toString(),
      date: (d.date as Date).toISOString().slice(0, 10),
      text: d.text,
      createdByName: d.created_by_name,
      assignedToIds: ((d.assigned_to_ids as Types.ObjectId[]) ?? []).map((id) => id.toString()),
      isDone: d.is_done,
      doneByName: d.done_by_name ?? '',
      doneAt: d.done_at ? (d.done_at as Date).toISOString() : null,
      createdAt: (d.created_at as Date).toISOString(),
    })),
  );
}

// POST /api/opdrachten  — create assignment (owner/developer only)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as {
    siteId: string;
    date: string;
    text: string;
    assignedToIds?: string[];
  };

  if (!body.siteId || !body.date || !body.text?.trim()) {
    return NextResponse.json({ error: 'siteId, date and text required' }, { status: 400 });
  }

  await dbConnect();

  const doc = await Opdracht.create({
    site_id: body.siteId,
    date: new Date(body.date),
    text: body.text.trim(),
    created_by: session.userId,
    created_by_name: session.name,
    assigned_to_ids: body.assignedToIds ?? [],
    is_done: false,
  });

  return NextResponse.json({
    id: (doc._id as Types.ObjectId).toString(),
    date: (doc.date as Date).toISOString().slice(0, 10),
    text: doc.text,
    createdByName: doc.created_by_name,
    assignedToIds: [],
    isDone: false,
    doneByName: '',
    doneAt: null,
    createdAt: (doc.created_at as Date).toISOString(),
  }, { status: 201 });
}
