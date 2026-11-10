// opening/sluiting = arrival/departure, pauze_start/pauze_einde = break (e.g. lunch)
export type AttendanceType = 'opening' | 'sluiting' | 'pauze_start' | 'pauze_einde';

export interface AttendanceLogLike {
  site_id: unknown;
  timestamp: unknown;
  type: unknown;
}

export interface WorkSession {
  startSite: string;
  endSite: string | null;
  start: Date;
  end: Date | null;
  hours: number; // worked hours, breaks excluded
  pauseHours: number;
}

const MAX_SESSION_MS = 16 * 36e5;

// Worked hours per session are rounded DOWN to a quarter hour (7h52 → 7.75).
// The small epsilon keeps an exact 7h45 from flooring to 7.5 through float error.
export function floorQuarter(hours: number): number {
  return Math.floor(hours * 4 + 1e-9) / 4;
}

// Hours as shown to people: up to 2 decimals in the Belgian locale (7,75 · 7,5 · 8)
export function formatHours(hours: number, locale: string = 'nl'): string {
  return hours.toLocaleString(locale === 'fr' ? 'fr-BE' : 'nl-BE', { maximumFractionDigits: 2 });
}

function idOf(v: unknown): string {
  return (v as { toString(): string }).toString();
}

function brusselsDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// Pair one person's arrival/departure logs into work sessions, regardless of site.
// Check-in at one carwash and check-out at another is one session, attributed to the
// carwash where it started. A forgotten check-out (new check-in on another day, or an
// implausibly long gap) is dropped instead of producing a huge bogus shift.
// Breaks inside a session are subtracted from its hours. A break that is never ended
// has no known length and is ignored (the owner can register its end afterwards).
export function buildSessions(logs: AttendanceLogLike[]): WorkSession[] {
  const sorted = [...logs].sort((a, b) => new Date(a.timestamp as Date).getTime() - new Date(b.timestamp as Date).getTime());
  const sessions: WorkSession[] = [];
  let open: { site: string; at: Date; pauseMs: number; pauseFrom: Date | null } | null = null;

  const dropOpen = () => {
    if (open) sessions.push({ startSite: open.site, endSite: null, start: open.at, end: null, hours: 0, pauseHours: 0 });
    open = null;
  };

  for (const l of sorted) {
    const at = new Date(l.timestamp as Date);
    if (l.type === 'opening') {
      if (open && brusselsDay(open.at) !== brusselsDay(at)) dropOpen();
      if (!open) open = { site: idOf(l.site_id), at, pauseMs: 0, pauseFrom: null };
    } else if (l.type === 'pauze_start' && open) {
      if (!open.pauseFrom) open.pauseFrom = at;
    } else if (l.type === 'pauze_einde' && open) {
      if (open.pauseFrom) open.pauseMs += at.getTime() - open.pauseFrom.getTime();
      open.pauseFrom = null;
    } else if (l.type === 'sluiting' && open) {
      const ms = at.getTime() - open.at.getTime();
      if (ms >= 0 && ms <= MAX_SESSION_MS) {
        const pauseMs = Math.min(ms, open.pauseMs);
        sessions.push({ startSite: open.site, endSite: idOf(l.site_id), start: open.at, end: at, hours: floorQuarter((ms - pauseMs) / 36e5), pauseHours: pauseMs / 36e5 });
        open = null;
      } else {
        dropOpen();
      }
    }
  }
  dropOpen();
  return sessions;
}

export { brusselsDay };
