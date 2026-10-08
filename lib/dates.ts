// UTC instant of a wall-clock time on a calendar day in Europe/Brussels
// (handles summer/winter time). dateStr: YYYY-MM-DD, time: HH:MM:SS.
export function brusselsInstant(dateStr: string, time = '12:00:00'): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asBrussels = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return new Date(guess - (asBrussels - guess));
}

// Count dated on an ingave: end of that day, never in the future.
export function countInstantForDay(dateStr: string): Date {
  const end = brusselsInstant(dateStr, '23:59:00');
  const now = new Date();
  return end.getTime() > now.getTime() ? now : end;
}

// Parse dd/mm/jjjj (or d-m-jjjj, jjjj-mm-dd) to YYYY-MM-DD, or null.
export function parseDayInput(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const be = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (be) { d = +be[1]; m = +be[2]; y = +be[3]; if (y < 100) y += 2000; }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
