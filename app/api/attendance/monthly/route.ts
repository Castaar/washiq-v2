import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { AttendanceLog } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

export interface DayRecord {
  date: string;       // YYYY-MM-DD
  checkIn: string;    // HH:MM
  checkOut: string;   // HH:MM or ''
  hours: number;
}

export interface EmployeeSummary {
  userId: string;
  userName: string;
  totalHours: number;
  daysWorked: number;
  days: DayRecord[];
}

// GET /api/attendance/monthly?siteId=xxx&year=2025&month=6
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { role } = session;
  if (role === 'employee') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  const yearParam = req.nextUrl.searchParams.get('year');
  const monthParam = req.nextUrl.searchParams.get('month');

  if (!siteId || !yearParam || !monthParam) {
    return NextResponse.json({ error: 'siteId, year and month required' }, { status: 400 });
  }

  const year = parseInt(yearParam);
  const month = parseInt(monthParam); // 1-12

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  await dbConnect();

  const logs = await AttendanceLog.find({
    site_id: siteId,
    timestamp: { $gte: from, $lt: to },
  }).sort({ timestamp: 1 }).lean();

  // Group by userId → dateStr → [logs]
  const byUser = new Map<string, { userName: string; byDate: Map<string, typeof logs> }>();

  for (const l of logs) {
    const uid = l.user_id.toString();
    if (!byUser.has(uid)) byUser.set(uid, { userName: l.user_name ?? '', byDate: new Map() });
    const userData = byUser.get(uid)!;

    const d = new Date(l.timestamp as Date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (!userData.byDate.has(dateStr)) userData.byDate.set(dateStr, []);
    userData.byDate.get(dateStr)!.push(l);
  }

  const result: EmployeeSummary[] = [];

  for (const [userId, { userName, byDate }] of byUser) {
    const days: DayRecord[] = [];

    for (const [date, dayLogs] of byDate) {
      const arrivals = dayLogs.filter((l) => l.type === 'opening').sort((a, b) =>
        (a.timestamp as Date).getTime() - (b.timestamp as Date).getTime(),
      );
      const departures = dayLogs.filter((l) => l.type === 'sluiting').sort((a, b) =>
        (b.timestamp as Date).getTime() - (a.timestamp as Date).getTime(),
      );

      const checkInTs = arrivals[0]?.timestamp as Date | undefined;
      const checkOutTs = departures[0]?.timestamp as Date | undefined;

      const fmt = (d: Date) =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      const hours = checkInTs && checkOutTs
        ? Math.max(0, Math.round(((checkOutTs.getTime() - checkInTs.getTime()) / 36e5) * 10) / 10)
        : 0;

      days.push({
        date,
        checkIn: checkInTs ? fmt(new Date(checkInTs)) : '',
        checkOut: checkOutTs ? fmt(new Date(checkOutTs)) : '',
        hours,
      });
    }

    days.sort((a, b) => a.date.localeCompare(b.date));

    const totalHours = Math.round(days.reduce((s, d) => s + d.hours, 0) * 10) / 10;
    const daysWorked = days.filter((d) => d.hours > 0).length;

    result.push({ userId, userName, totalHours, daysWorked, days });
  }

  result.sort((a, b) => a.userName.localeCompare(b.userName));

  return NextResponse.json(result);
}
