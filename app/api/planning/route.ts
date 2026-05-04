import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Planning } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// GET /api/planning?siteId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  const fromParam = req.nextUrl.searchParams.get('from');
  const toParam = req.nextUrl.searchParams.get('to');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();

  const filter: Record<string, unknown> = { site_id: siteId };

  const from = fromParam ? new Date(fromParam) : new Date();
  if (!fromParam) from.setDate(from.getDate() - 1);
  const to = toParam ? new Date(toParam) : new Date(from);
  if (!toParam) to.setDate(to.getDate() + 14);
  filter.date = { $gte: from, $lte: to };

  // Employees only see their own shifts
  if (session.role === 'employee') {
    filter.user_id = session.userId;
  }

  const docs = await Planning.find(filter).sort({ date: 1, start_time: 1 }).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      siteId: (d.site_id as Types.ObjectId).toString(),
      userId: (d.user_id as Types.ObjectId).toString(),
      userName: d.user_name,
      date: (d.date as Date).toISOString().slice(0, 10),
      startTime: d.start_time,
      endTime: d.end_time,
      note: d.note ?? '',
    })),
  );
}

// POST /api/planning  — create shift (owner/developer only)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as {
    siteId: string;
    userId: string;
    userName: string;
    date: string;
    startTime: string;
    endTime: string;
    note?: string;
  };

  if (!body.siteId || !body.userId || !body.date || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: 'siteId, userId, date, startTime and endTime required' }, { status: 400 });
  }

  await dbConnect();

  const doc = await Planning.create({
    site_id: body.siteId,
    user_id: body.userId,
    user_name: body.userName,
    date: new Date(body.date),
    start_time: body.startTime,
    end_time: body.endTime,
    note: body.note?.trim() ?? '',
    created_by: session.userId,
  });

  return NextResponse.json({
    id: (doc._id as Types.ObjectId).toString(),
    userId: body.userId,
    userName: body.userName,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    note: doc.note,
  }, { status: 201 });
}
