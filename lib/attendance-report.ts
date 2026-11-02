import { AttendanceLog, Site, WeeklyEntry } from '@/lib/models';
import { buildSessions, brusselsDay } from '@/lib/attendance-hours';
import { brusselsInstant } from '@/lib/dates';

// Worked hours of everyone over all the owner's carwashes for one month — used
// by the Excel export and the printable report.

export interface ReportSession {
  date: string;        // YYYY-MM-DD (Brussels)
  site: string;        // carwash where the shift started
  endSite: string;     // carwash of the check-out ('' when it's missing)
  checkIn: string;     // HH:MM
  checkOut: string;    // HH:MM, '' when the departure is missing
  pauseMinutes: number;
  hours: number;       // breaks excluded, 0 when the departure is missing
}

export interface ReportPerson {
  key: string;
  name: string;
  isJobstudent: boolean;
  totalHours: number;
  pauseMinutes: number;
  daysWorked: number;
  perSite: { site: string; hours: number }[];
  sessions: ReportSession[];
}

// Worked hours vs. wasbeurten per carwash (wasbeurten come from the monthly
// ingave; a selfcarwash has none, so its ratio stays empty)
export interface ReportSiteStats {
  site: string;
  hours: number;
  washes: number;
  washesPerHour: number | null;
  minutesPerWash: number | null;
}

export interface MonthlyReport {
  year: number;
  month: number;
  sites: string[];
  totalHours: number;
  siteStats: ReportSiteStats[];
  // All carwashes together; only hours at carwashes with wasbeurten count
  washTotals: Omit<ReportSiteStats, 'site'>;
  people: ReportPerson[];
}

type LeanLog = { user_id: unknown; user_name?: string; person_type?: string; site_id: unknown; timestamp: unknown; type: unknown };

// A jobstudent is registered by name under the account of whoever registered
// them, so they're keyed by name — never mixed into that colleague's own hours.
function personKey(l: LeanLog): string {
  if (l.person_type === 'jobstudent') return `js:${(l.user_name ?? '').trim().toLowerCase()}`;
  return (l.user_id as { toString(): string }).toString();
}

function hhmm(d: Date): string {
  return new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function buildMonthlyReport(siteIds: string[], year: number, month: number): Promise<MonthlyReport> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const from = brusselsInstant(`${year}-${pad(month)}-01`, '00:00:00');
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  const to = brusselsInstant(next, '00:00:00');

  const siteDocs = await Site.find({ _id: { $in: siteIds } }).select('_id name').lean();
  const siteName = new Map(siteDocs.map((s) => [String(s._id), (s.name as string) ?? '']));

  const logs = await AttendanceLog.find({
    site_id: { $in: siteIds },
    timestamp: { $gte: from, $lt: to },
    person_type: { $ne: 'technician_extern' },
  }).select('user_id user_name person_type site_id timestamp type').lean() as LeanLog[];

  const byPerson = new Map<string, LeanLog[]>();
  const names = new Map<string, string>();
  logs.sort((a, b) => new Date(a.timestamp as Date).getTime() - new Date(b.timestamp as Date).getTime());
  for (const l of logs) {
    const key = personKey(l);
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key)!.push(l);
    if (l.user_name?.trim()) names.set(key, l.user_name.trim()); // latest spelling wins
  }

  const people: ReportPerson[] = [];
  for (const [key, personLogs] of byPerson) {
    const sessions: ReportSession[] = buildSessions(personLogs).map((s) => ({
      date: brusselsDay(s.start),
      site: siteName.get(s.startSite) ?? '',
      endSite: s.endSite ? (siteName.get(s.endSite) ?? '') : '',
      checkIn: hhmm(s.start),
      checkOut: s.end ? hhmm(s.end) : '',
      pauseMinutes: Math.round(s.pauseHours * 60),
      hours: round2(s.hours),
    }));
    const perSiteMap = new Map<string, number>();
    for (const s of sessions) perSiteMap.set(s.site, (perSiteMap.get(s.site) ?? 0) + s.hours);
    people.push({
      key,
      name: names.get(key) ?? '',
      isJobstudent: key.startsWith('js:'),
      totalHours: round2(sessions.reduce((sum, s) => sum + s.hours, 0)),
      pauseMinutes: sessions.reduce((sum, s) => sum + s.pauseMinutes, 0),
      daysWorked: new Set(sessions.filter((s) => s.hours > 0).map((s) => s.date)).size,
      perSite: [...perSiteMap].map(([site, hours]) => ({ site, hours: round2(hours) })).sort((a, b) => a.site.localeCompare(b.site)),
      sessions,
    });
  }

  // Employees first, then jobstudents, each alphabetically
  people.sort((a, b) => Number(a.isJobstudent) - Number(b.isJobstudent) || a.name.localeCompare(b.name));

  // Ingave dates are stored as UTC midnight of the chosen day
  const entries = await WeeklyEntry.find({
    site_id: { $in: siteIds },
    week_start: { $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) },
  }).select('site_id program_counts').lean();
  const washesBySite = new Map<string, number>();
  for (const e of entries) {
    const name = siteName.get(String(e.site_id)) ?? '';
    const count = ((e.program_counts ?? []) as { count?: number }[]).reduce((s, pc) => s + (pc.count ?? 0), 0);
    washesBySite.set(name, (washesBySite.get(name) ?? 0) + count);
  }

  const sites = [...new Set(people.flatMap((p) => p.perSite.map((s) => s.site)))].sort((a, b) => a.localeCompare(b));
  const ratio = (hours: number, washes: number): Pick<ReportSiteStats, 'washesPerHour' | 'minutesPerWash'> => ({
    washesPerHour: hours > 0 && washes > 0 ? round2(washes / hours) : null,
    minutesPerWash: hours > 0 && washes > 0 ? round2((hours * 60) / washes) : null,
  });
  const siteStats = sites.map((site) => {
    const hours = round2(people.reduce((sum, p) => sum + (p.perSite.find((x) => x.site === site)?.hours ?? 0), 0));
    const washes = washesBySite.get(site) ?? 0;
    return { site, hours, washes, ...ratio(hours, washes) };
  });
  const totalHours = round2(people.reduce((sum, p) => sum + p.totalHours, 0));
  const washHours = round2(siteStats.filter((s) => s.washes > 0).reduce((sum, s) => sum + s.hours, 0));
  const totalWashes = siteStats.reduce((sum, s) => sum + s.washes, 0);

  return {
    year,
    month,
    sites,
    totalHours,
    siteStats,
    washTotals: { hours: washHours, washes: totalWashes, ...ratio(washHours, totalWashes) },
    people,
  };
}
