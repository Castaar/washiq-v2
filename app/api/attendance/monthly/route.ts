import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { AttendanceLog, Site, User, WeeklyEntry } from '@/lib/models';
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
  // Ingaven from before a takeover (stats_from) belong to the previous owner
  const site = await Site.findById(siteId).select('stats_from').lean();
  const statsFrom = (site?.stats_from as string | null | undefined) ?? null;
  const start = statsFrom && new Date(`${statsFrom}T00:00:00Z`) > from ? new Date(`${statsFrom}T00:00:00Z`) : from;
  const entries = await WeeklyEntry.find({ site_id: siteId, week_start: { $gte: start, $lt: to } })
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
  hours: number;      // breaks excluded
  pauseMinutes: number;
  otherSite?: boolean; // check-in or check-out happened at another carwash
}

export interface EmployeeSummary {
  userId: string; // user id, or "js:<name>" for a jobstudent registered by name
  userName: string;
  isJobstudent?: boolean;
  contractHours?: number | null; // monthly contract; overtime is measured over all sites
  overtime?: number;
  totalHours: number;
  totalHoursAllSites: number;
  daysWorked: number;
  days: DayRecord[];
}

type LeanLog = { user_id: unknown; user_name?: string; person_type?: string; site_id: unknown; timestamp: unknown; type: unknown };

// A jobstudent is registered by name under the account of whoever registered
// them, so they're keyed by name — never mixed into that colleague's own hours.
function personKey(l: LeanLog): string {
  if (l.person_type === 'jobstudent') return `js:${(l.user_name ?? '').trim().toLowerCase()}`;
  return (l.user_id as { toString(): string }).toString();
}

function groupByPerson(logs: LeanLog[]): Map<string, LeanLog[]> {
  const m = new Map<string, LeanLog[]>();
  for (const l of logs) {
    const key = personKey(l);
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(l);
  }
  return m;
}

// All logs (any site) of the people who have a log at this site in the range
async function personLogsForSite(siteId: string, from: Date, to: Date): Promise<{ siteLogs: LeanLog[]; logsByPerson: Map<string, LeanLog[]> }> {
  const siteLogs = await AttendanceLog.find({
    site_id: siteId,
    timestamp: { $gte: from, $lt: to },
    person_type: { $ne: 'technician_extern' },
  }).select('user_id user_name person_type').lean() as LeanLog[];
  if (siteLogs.length === 0) return { siteLogs, logsByPerson: new Map() };
  const userIds = [...new Set(siteLogs.filter((l) => l.person_type !== 'jobstudent').map((l) => (l.user_id as { toString(): string }).toString()))];
  const allLogs = await AttendanceLog.find({
    timestamp: { $gte: from, $lt: to },
    $or: [
      { user_id: { $in: userIds }, person_type: { $nin: ['technician_extern', 'jobstudent'] } },
      { person_type: 'jobstudent' },
    ],
  }).select('user_id user_name person_type site_id timestamp type').lean() as LeanLog[];
  const keys = new Set(siteLogs.map(personKey));
  const logsByPerson = groupByPerson(allLogs);
  for (const key of logsByPerson.keys()) if (!keys.has(key)) logsByPerson.delete(key);
  return { siteLogs, logsByPerson };
}

// Hours worked per site for the people who have any log at that site in the range.
// A shift that starts at this site counts here, even when the check-out is elsewhere.
async function siteHoursForRange(siteId: string, from: Date, to: Date): Promise<number> {
  const { logsByPerson } = await personLogsForSite(siteId, from, to);
  let total = 0;
  for (const personLogs of logsByPerson.values()) {
    for (const sess of buildSessions(personLogs)) {
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

  const { siteLogs, logsByPerson } = await personLogsForSite(siteId, from, to);

  const names = new Map<string, string>();
  for (const l of siteLogs) {
    const key = personKey(l);
    if (!names.has(key)) names.set(key, (l.user_name ?? '').trim());
  }
  const userIds = [...names.keys()];
  const result: EmployeeSummary[] = [];

  for (const userId of userIds) {
    const sessions = buildSessions(logsByPerson.get(userId) ?? []);
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
        pauseMinutes: Math.round(daySessions.filter((x) => x.startSite === siteId).reduce((sum, x) => sum + x.pauseHours, 0) * 60),
        otherSite: daySessions.some((x) => x.startSite !== siteId || (x.endSite !== null && x.endSite !== siteId)) || undefined,
      });
    }
    days.sort((a, b) => a.date.localeCompare(b.date));

    // Sum unrounded session hours (same as the all-sites total) so both totals match.
    const totalHours = Math.round(sessions.filter((x) => x.startSite === siteId).reduce((sum, x) => sum + x.hours, 0) * 10) / 10;
    const totalHoursAllSites = Math.round(sessions.reduce((sum, x) => sum + x.hours, 0) * 10) / 10;
    const daysWorked = days.filter((d) => d.hours > 0).length;

    result.push({ userId, userName: names.get(userId) ?? '', ...(userId.startsWith('js:') ? { isJobstudent: true } : {}), totalHours, totalHoursAllSites, daysWorked, days });
  }

  const contracts = await User.find({ _id: { $in: result.filter((r) => !r.isJobstudent).map((r) => r.userId) }, contract_hours: { $gt: 0 } })
    .select('_id contract_hours').lean();
  for (const c of contracts) {
    const r = result.find((x) => x.userId === String(c._id));
    if (!r) continue;
    r.contractHours = c.contract_hours as number;
    r.overtime = Math.round(Math.max(0, r.totalHoursAllSites - r.contractHours) * 10) / 10;
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
