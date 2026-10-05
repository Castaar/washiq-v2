import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { AttendanceLog, WeeklyEntry } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { buildSessions, type WorkSession } from '@/lib/attendance-hours';

// Server runs in UTC (Vercel) — Date.getHours()/getDate() etc. would be 1-2h
// off from actual Belgian local time. Extract the Brussels-local date/time
// parts explicitly instead of relying on the server's own timezone.
function brusselsParts(d: Date): { y: number; m: number; day: number; h: number; min: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return { y: Number(get('year')), m: Number(get('month')), day: Number(get('day')), h: Number(get('hour')) % 24, min: Number(get('minute')) };
}

function brusselsDateStr(d: Date): string {
  const p = brusselsParts(d);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function brusselsTimeStr(d: Date): string {
  const p = brusselsParts(d);
  return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
}

async function washCountForRange(siteId: string, from: Date, to: Date): Promise<number> {
  const entries = await WeeklyEntry.find({ site_id: siteId, week_start: { $gte: from, $lt: to } })
    .select('program_counts')
    .lean();
  return entries.reduce((sum, e) => {
    const counts = (e.program_counts ?? []) as { count?: number }[];
    return sum + counts.reduce((s, pc) => s + (pc.count ?? 0), 0);
  }, 0);
}

export interface DayRecord {
  date: string;       // YYYY-MM-DD
  checkIn: string;    // HH:MM
  checkOut: string;   // HH:MM or ''
  hours: number;
  otherSite?: boolean; // check-in or check-out happened at another carwash
}

export interface EmployeeSummary {
  userId: string;
  userName: string;
  totalHours: number;
  totalHoursAllSites: number;
  daysWorked: number;
  days: DayRecord[];
}

type LeanLog = { user_id: unknown; user_name?: string; site_id: unknown; timestamp: unknown; type: unknown };

function groupByUser(logs: LeanLog[]): Map<string, LeanLog[]> {
  const m = new Map<string, LeanLog[]>();
  for (const l of logs) {
    const uid = (l.user_id as { toString(): string }).toString();
    if (!m.has(uid)) m.set(uid, []);
    m.get(uid)!.push(l);
  }
  return m;
}

// Hours worked per site for the people who have any log at that site in the range.
// A shift that starts at this site counts here, even when the check-out is elsewhere.
async function siteHoursForRange(siteId: string, from: Date, to: Date): Promise<number> {
  const siteLogs = await AttendanceLog.find({
    site_id: siteId,
    timestamp: { $gte: from, $lt: to },
    person_type: { $ne: 'technician_extern' },
  }).select('user_id').lean();
  const userIds = [...new Set(siteLogs.map((l) => (l.user_id as { toString(): string }).toString()))];
  if (userIds.length === 0) return 0;
  const allLogs = await AttendanceLog.find({
    user_id: { $in: userIds },
    timestamp: { $gte: from, $lt: to },
    person_type: { $ne: 'technician_extern' },
  }).select('user_id site_id timestamp type').lean();
  let total = 0;
  for (const userLogs of groupByUser(allLogs as LeanLog[]).values()) {
    for (const sess of buildSessions(userLogs)) {
      if (sess.startSite === siteId) total += sess.hours;
    }
  }
  return total;
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

  const siteLogs = await AttendanceLog.find({
    site_id: siteId,
    timestamp: { $gte: from, $lt: to },
    person_type: { $ne: 'technician_extern' },
  }).select('user_id user_name').lean();

  const names = new Map<string, string>();
  for (const l of siteLogs) {
    const uid = (l.user_id as { toString(): string }).toString();
    if (!names.has(uid)) names.set(uid, (l.user_name as string) ?? '');
  }
  const userIds = [...names.keys()];

  const allLogs = userIds.length === 0 ? [] : await AttendanceLog.find({
    user_id: { $in: userIds },
    timestamp: { $gte: from, $lt: to },
    person_type: { $ne: 'technician_extern' },
  }).select('user_id user_name site_id timestamp type').lean();

  const logsByUser = groupByUser(allLogs as LeanLog[]);
  const result: EmployeeSummary[] = [];

  for (const userId of userIds) {
    const sessions = buildSessions(logsByUser.get(userId) ?? []);
    const touchesSite = (s: WorkSession) => s.startSite === siteId || s.endSite === siteId;

    const byDate = new Map<string, WorkSession[]>();
    for (const sess of sessions.filter(touchesSite)) {
      const date = brusselsDateStr(sess.start);
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(sess);
    }

    const days: DayRecord[] = [];
    for (const [date, daySessions] of byDate) {
      const starts = daySessions.map((x) => x.start.getTime());
      const ends = daySessions.map((x) => x.end?.getTime()).filter((x): x is number => x !== undefined);
      const hours = daySessions.filter((x) => x.startSite === siteId).reduce((sum, x) => sum + x.hours, 0);
      days.push({
        date,
        checkIn: brusselsTimeStr(new Date(Math.min(...starts))),
        checkOut: ends.length > 0 ? brusselsTimeStr(new Date(Math.max(...ends))) : '',
        hours: Math.round(hours * 10) / 10,
        otherSite: daySessions.some((x) => x.startSite !== siteId || (x.endSite !== null && x.endSite !== siteId)) || undefined,
      });
    }
    days.sort((a, b) => a.date.localeCompare(b.date));

    const totalHours = Math.round(days.reduce((sum, d) => sum + d.hours, 0) * 10) / 10;
    const totalHoursAllSites = Math.round(sessions.reduce((sum, x) => sum + x.hours, 0) * 10) / 10;
    const daysWorked = days.filter((d) => d.hours > 0).length;

    result.push({ userId, userName: names.get(userId) ?? '', totalHours, totalHoursAllSites, daysWorked, days });
  }

  result.sort((a, b) => a.userName.localeCompare(b.userName));

  const totalWashes = await washCountForRange(siteId, from, to);

  // Last 6 months (including the requested one) — hours + wasbeurten trend,
  // so an owner can see history at a glance instead of switching month by month.
  const history = await Promise.all(
    [5, 4, 3, 2, 1, 0].map(async (i) => {
      const hFrom = new Date(year, month - 1 - i, 1);
      const hTo = new Date(year, month - i, 1);
      const [hours, hWashes] = await Promise.all([siteHoursForRange(siteId, hFrom, hTo), washCountForRange(siteId, hFrom, hTo)]);
      return { year: hFrom.getFullYear(), month: hFrom.getMonth() + 1, totalHours: Math.round(hours * 10) / 10, totalWashes: hWashes };
    }),
  );

  return NextResponse.json({ employees: result, totalWashes, history });
}
