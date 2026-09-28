import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { AttendanceLog, WeeklyEntry } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

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
}

export interface EmployeeSummary {
  userId: string;
  userName: string;
  totalHours: number;
  totalHoursAllSites: number;
  daysWorked: number;
  days: DayRecord[];
}

// Sum worked hours from a list of attendance logs, grouping by (site, day)
// so a check-in at one carwash is never paired with a check-out at another.
function sumHoursBySiteAndDay(logs: { user_id: unknown; site_id: unknown; timestamp: unknown; type: unknown }[]): number {
  const byKey = new Map<string, typeof logs>();
  for (const l of logs) {
    const key = `${(l.site_id as { toString(): string }).toString()}_${brusselsDateStr(new Date(l.timestamp as Date))}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(l);
  }
  let total = 0;
  for (const dayLogs of byKey.values()) {
    const arrivals = dayLogs.filter((l) => l.type === 'opening').sort((a, b) => (new Date(a.timestamp as Date)).getTime() - (new Date(b.timestamp as Date)).getTime());
    const departures = dayLogs.filter((l) => l.type === 'sluiting').sort((a, b) => (new Date(b.timestamp as Date)).getTime() - (new Date(a.timestamp as Date)).getTime());
    const inTs = arrivals[0]?.timestamp as Date | undefined;
    const outTs = departures[0]?.timestamp as Date | undefined;
    if (inTs && outTs) total += Math.max(0, (new Date(outTs).getTime() - new Date(inTs).getTime()) / 36e5);
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

  const logs = await AttendanceLog.find({
    site_id: siteId,
    timestamp: { $gte: from, $lt: to },
    person_type: { $ne: 'technician_extern' },
  }).sort({ timestamp: 1 }).lean();

  // Group by userId → dateStr → [logs]
  const byUser = new Map<string, { userName: string; byDate: Map<string, typeof logs> }>();

  for (const l of logs) {
    const uid = l.user_id.toString();
    if (!byUser.has(uid)) byUser.set(uid, { userName: l.user_name ?? '', byDate: new Map() });
    const userData = byUser.get(uid)!;

    const dateStr = brusselsDateStr(new Date(l.timestamp as Date));

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

      const hours = checkInTs && checkOutTs
        ? Math.max(0, Math.round(((checkOutTs.getTime() - checkInTs.getTime()) / 36e5) * 10) / 10)
        : 0;

      days.push({
        date,
        checkIn: checkInTs ? brusselsTimeStr(new Date(checkInTs)) : '',
        checkOut: checkOutTs ? brusselsTimeStr(new Date(checkOutTs)) : '',
        hours,
      });
    }

    days.sort((a, b) => a.date.localeCompare(b.date));

    const totalHours = Math.round(days.reduce((s, d) => s + d.hours, 0) * 10) / 10;
    const daysWorked = days.filter((d) => d.hours > 0).length;

    result.push({ userId, userName, totalHours, totalHoursAllSites: totalHours, daysWorked, days });
  }

  // Cross-site total per employee — "hoeveel heeft deze persoon deze maand
  // in totaal gewerkt, over alle carwashes heen" — not just at this site.
  if (result.length > 0) {
    const userIds = result.map((r) => r.userId);
    const allSiteLogs = await AttendanceLog.find({
      user_id: { $in: userIds },
      timestamp: { $gte: from, $lt: to },
      person_type: { $ne: 'technician_extern' },
    }).select('user_id site_id timestamp type').lean();

    const byUserAllSites = new Map<string, typeof allSiteLogs>();
    for (const l of allSiteLogs) {
      const uid = (l.user_id as { toString(): string }).toString();
      if (!byUserAllSites.has(uid)) byUserAllSites.set(uid, []);
      byUserAllSites.get(uid)!.push(l);
    }
    for (const r of result) {
      const logsForUser = byUserAllSites.get(r.userId) ?? [];
      r.totalHoursAllSites = Math.round(sumHoursBySiteAndDay(logsForUser) * 10) / 10;
    }
  }

  result.sort((a, b) => a.userName.localeCompare(b.userName));

  const totalWashes = await washCountForRange(siteId, from, to);

  // Last 6 months (including the requested one) — hours + wasbeurten trend,
  // so an owner can see history at a glance instead of switching month by month.
  const history: { year: number; month: number; totalHours: number; totalWashes: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const hFrom = new Date(year, month - 1 - i, 1);
    const hTo = new Date(year, month - i, 1);
    const [hLogs, hWashes] = await Promise.all([
      AttendanceLog.find({
        site_id: siteId,
        timestamp: { $gte: hFrom, $lt: hTo },
        person_type: { $ne: 'technician_extern' },
      }).select('user_id timestamp type').lean(),
      washCountForRange(siteId, hFrom, hTo),
    ]);
    const byUserDate = new Map<string, Map<string, typeof hLogs>>();
    for (const l of hLogs) {
      const uid = l.user_id.toString();
      const dateStr = brusselsDateStr(new Date(l.timestamp as Date));
      if (!byUserDate.has(uid)) byUserDate.set(uid, new Map());
      const byDate = byUserDate.get(uid)!;
      if (!byDate.has(dateStr)) byDate.set(dateStr, []);
      byDate.get(dateStr)!.push(l);
    }
    let hTotalHours = 0;
    for (const byDate of byUserDate.values()) {
      for (const dayLogs of byDate.values()) {
        const arrivals = dayLogs.filter((l) => l.type === 'opening').sort((a, b) => (a.timestamp as Date).getTime() - (b.timestamp as Date).getTime());
        const departures = dayLogs.filter((l) => l.type === 'sluiting').sort((a, b) => (b.timestamp as Date).getTime() - (a.timestamp as Date).getTime());
        const inTs = arrivals[0]?.timestamp as Date | undefined;
        const outTs = departures[0]?.timestamp as Date | undefined;
        if (inTs && outTs) hTotalHours += Math.max(0, (outTs.getTime() - inTs.getTime()) / 36e5);
      }
    }
    history.push({ year: hFrom.getFullYear(), month: hFrom.getMonth() + 1, totalHours: Math.round(hTotalHours * 10) / 10, totalWashes: hWashes });
  }

  return NextResponse.json({ employees: result, totalWashes, history });
}
