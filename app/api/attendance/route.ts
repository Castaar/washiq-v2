import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { AttendanceLog } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// GET /api/attendance?siteId=xxx&date=YYYY-MM-DD
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
    filter.timestamp = { $gte: from, $lt: to };
  } else {
    // Default: last 30 days
    const from = new Date();
    from.setDate(from.getDate() - 30);
    filter.timestamp = { $gte: from };
  }

  const logs = await AttendanceLog.find(filter).sort({ timestamp: -1 }).limit(200).lean();

  return NextResponse.json(
    logs.map((l) => ({
      id: (l._id as Types.ObjectId).toString(),
      siteId: (l.site_id as Types.ObjectId).toString(),
      userId: (l.user_id as Types.ObjectId).toString(),
      userName: l.user_name,
      type: l.type,
      personType: l.person_type ?? 'employee',
      registeredByName: l.registered_by_name ?? '',
      timestamp: (l.timestamp as Date).toISOString(),
      note: l.note ?? '',
    })),
  );
}

// POST /api/attendance  — log arrival or departure (employee, or an external
// technician registered on their behalf since technicians have no app account)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    siteId: string;
    type: 'opening' | 'sluiting';
    note?: string;
    personType?: 'employee' | 'technician_extern';
    personName?: string;
  };
  if (!body.siteId || !body.type) {
    return NextResponse.json({ error: 'siteId and type required' }, { status: 400 });
  }

  const isTechnician = body.personType === 'technician_extern';
  if (isTechnician && !body.personName?.trim()) {
    return NextResponse.json({ error: 'personName required for technician_extern' }, { status: 400 });
  }

  await dbConnect();

  const log = await AttendanceLog.create({
    site_id: body.siteId,
    user_id: session.userId,
    user_name: isTechnician ? body.personName!.trim() : session.name,
    type: body.type,
    person_type: isTechnician ? 'technician_extern' : 'employee',
    registered_by_name: isTechnician ? session.name : '',
    timestamp: new Date(),
    note: body.note?.trim() ?? '',
  });

  return NextResponse.json({
    id: (log._id as Types.ObjectId).toString(),
    userName: log.user_name,
    type: log.type,
    personType: log.person_type,
    registeredByName: log.registered_by_name,
    timestamp: (log.timestamp as Date).toISOString(),
  }, { status: 201 });
}
