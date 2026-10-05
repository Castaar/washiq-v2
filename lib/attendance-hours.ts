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
  hours: number;
}

const MAX_SESSION_MS = 16 * 36e5;

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
export function buildSessions(logs: AttendanceLogLike[]): WorkSession[] {
  const sorted = [...logs].sort((a, b) => new Date(a.timestamp as Date).getTime() - new Date(b.timestamp as Date).getTime());
  const sessions: WorkSession[] = [];
  let open: { site: string; at: Date } | null = null;

  for (const l of sorted) {
    const at = new Date(l.timestamp as Date);
    if (l.type === 'opening') {
      if (open && brusselsDay(open.at) !== brusselsDay(at)) {
        sessions.push({ startSite: open.site, endSite: null, start: open.at, end: null, hours: 0 });
        open = null;
      }
      if (!open) open = { site: idOf(l.site_id), at };
    } else if (l.type === 'sluiting' && open) {
      const ms = at.getTime() - open.at.getTime();
      if (ms >= 0 && ms <= MAX_SESSION_MS) {
        sessions.push({ startSite: open.site, endSite: idOf(l.site_id), start: open.at, end: at, hours: ms / 36e5 });
      } else {
        sessions.push({ startSite: open.site, endSite: null, start: open.at, end: null, hours: 0 });
      }
      open = null;
    }
  }
  if (open) sessions.push({ startSite: open.site, endSite: null, start: open.at, end: null, hours: 0 });
  return sessions;
}

export { brusselsDay };
