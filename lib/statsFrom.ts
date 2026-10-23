// Site.stats_from (YYYY-MM-DD): first day of the current owner's figures, e.g. after
// a takeover. Ingaven, stock-count periods and energy bills before it belong to the
// previous owner — they stay in the database but are left out of the dashboard,
// historiek, ranking and logboek totals. The wash counter itself keeps running
// (see lib/counter.ts), so maintenance and brushes are not affected.
import { brusselsInstant } from '@/lib/dates';

export type StatsFrom = string | null | undefined;

function valid(day: StatsFrom): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
}

// Ingaven store their day as UTC midnight (week_start)
export function entryDateFilter(day: StatsFrom): Record<string, unknown> {
  return valid(day) ? { week_start: { $gte: new Date(`${day}T00:00:00Z`) } } : {};
}

// Instant-based records (stock counts): from the start of that Brussels day
export function statsFromInstant(day: StatsFrom): Date | null {
  return valid(day) ? brusselsInstant(day, '00:00:00') : null;
}

export function isBeforeStatsFrom(dayStr: string, day: StatsFrom): boolean {
  return valid(day) && dayStr < day;
}

// Energy bills are monthly: hide months that ended before the start day
export function billBeforeStatsFrom(year: number, month: number, day: StatsFrom): boolean {
  if (!valid(day)) return false;
  return `${year}-${String(month).padStart(2, '0')}` < day.slice(0, 7);
}
