import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { AgendaEvent } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// GET /api/agenda?siteId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  const fromParam = req.nextUrl.searchParams.get('from');
  const toParam = req.nextUrl.searchParams.get('to');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();

  const from = fromParam ? new Date(fromParam) : new Date();
  if (!fromParam) from.setDate(from.getDate() - 1);
  const to = toParam ? new Date(toParam) : new Date(from);
  if (!toParam) to.setDate(to.getDate() + 14);

  const docs = await AgendaEvent.find({ site_id: siteId, date: { $gte: from, $lte: to } })
    .sort({ date: 1, time: 1 })
    .lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      siteId: (d.site_id as Types.ObjectId).toString(),
      date: (d.date as Date).toISOString().slice(0, 10),
      time: d.time ?? '',
      text: d.text,
      createdByName: d.created_by_name ?? '',
    })),
  );
}

// POST /api/agenda  — add a day-note (owner/developer only)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as { siteId: string; date: string; time?: string; text: string };
  if (!body.siteId || !body.date || !body.text?.trim()) {
    return NextResponse.json({ error: 'siteId, date and text required' }, { status: 400 });
  }

  await dbConnect();

  const doc = await AgendaEvent.create({
    site_id: body.siteId,
    date: new Date(body.date),
    time: body.time?.trim() ?? '',
    text: body.text.trim(),
    created_by: session.userId,
    created_by_name: session.name,
  });

  return NextResponse.json({
    id: (doc._id as Types.ObjectId).toString(),
    siteId: body.siteId,
    date: body.date,
    time: doc.time,
    text: doc.text,
    createdByName: doc.created_by_name,
  }, { status: 201 });
}
