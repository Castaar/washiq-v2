import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Verlof } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// GET /api/verlof?from=YYYY-MM-DD&to=YYYY-MM-DD — leave overlapping the range
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fromParam = req.nextUrl.searchParams.get('from');
  const toParam = req.nextUrl.searchParams.get('to');

  await dbConnect();

  const filter: Record<string, unknown> = {};
  if (fromParam && toParam) {
    // Overlaps the range: starts before range end AND ends after range start.
    filter.start_date = { $lte: new Date(toParam) };
    filter.end_date = { $gte: new Date(fromParam) };
  }

  const docs = await Verlof.find(filter).sort({ start_date: 1 }).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      userId: (d.user_id as Types.ObjectId).toString(),
      userName: d.user_name,
      startDate: (d.start_date as Date).toISOString().slice(0, 10),
      endDate: (d.end_date as Date).toISOString().slice(0, 10),
      note: d.note ?? '',
    })),
  );
}

// POST /api/verlof — add a leave period (owner/developer only)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as {
    userId: string;
    userName: string;
    startDate: string;
    endDate: string;
    note?: string;
  };

  if (!body.userId || !body.startDate || !body.endDate) {
    return NextResponse.json({ error: 'userId, startDate and endDate required' }, { status: 400 });
  }
  if (body.endDate < body.startDate) {
    return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 });
  }

  await dbConnect();

  const doc = await Verlof.create({
    user_id: body.userId,
    user_name: body.userName,
    start_date: new Date(body.startDate),
    end_date: new Date(body.endDate),
    note: body.note?.trim() ?? '',
    created_by: session.userId,
    created_by_name: session.name,
  });

  return NextResponse.json({
    id: (doc._id as Types.ObjectId).toString(),
    userId: body.userId,
    userName: body.userName,
    startDate: body.startDate,
    endDate: body.endDate,
    note: doc.note,
  }, { status: 201 });
}
