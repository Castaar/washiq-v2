import type { Types } from 'mongoose';
import { AttendanceLog, IntegrationDay, PriceConfig, SiteIntegration, WeeklyEntry } from '@/lib/models';
import { priceAt } from '@/lib/prices';
import { addDays, brusselsDay } from '@/lib/integrations';

// Water overview from the Shayp meter (koppeling), split per day into what was used
// while the carwash was open and what ran outside opening hours.
//
// Outside opening hours nobody washes, so water there is installation use or loss:
// - the osmosis (reverse osmosis) unit refilling its storage tank for the spot-free
//   rinse — typically in the evening/night; it also sends a large share as reject
//   water (concentrate) to the drain,
// - the water softener's regeneration (rinse/backwash, usually at night),
// - leaks or a running valve.
// Opening hours per day come from the logboek (first arrival → last departure at that
// carwash); without logs that day, 08:00–19:00 is assumed.

export const DEFAULT_OPEN_HOUR = 8;
export const DEFAULT_CLOSE_HOUR = 19;

export interface WaterDay {
  date: string;
  total: number; // L
  open: number; // L during opening hours
  closed: number; // L outside opening hours
  leak: number; // L Shayp classified as leak
  openFrom: number; // hour 0..23
  openTo: number; // exclusive hour 1..24
  fromLogboek: boolean;
  hourly: number[];
  cost: number; // €
  washes: number | null; // wasbeurten that day (MyCarwash koppeling), null = not known
}

export interface WaterOverview {
  days: WaterDay[];
  firstMeasured: string | null; // first day the meter measured anything
  total: number;
  open: number;
  closed: number;
  leak: number;
  cost: number;
  pricePerM3: number;
  avgPerDay: number;
  measuredDays: number;
  avgHourly: number[]; // average liters per hour of the day over measured days
  peakDay: WaterDay | null;
  nightLiters: number[]; // per hour 0..23: total outside opening hours (where installations run)
  washes: number; // wasbeurten on the days where both water and washes are known
  litersPerWash: number | null; // water of those days / their wasbeurten
}

function hourOf(d: Date): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(d).split(':').map(Number);
  return (h % 24) + m / 60;
}

// Opening window per day from the logboek: [floor(first opening), ceil(last closing))
async function openingWindows(siteId: string, from: string, to: string): Promise<Map<string, { from: number; to: number }>> {
  const logs = await AttendanceLog.find({
    site_id: siteId,
    type: { $in: ['opening', 'sluiting'] },
    timestamp: { $gte: new Date(`${addDays(from, -1)}T00:00:00Z`), $lte: new Date(`${addDays(to, 1)}T23:59:59Z`) },
  }).select('type timestamp').lean();
  const perDay = new Map<string, { first: number | null; last: number | null }>();
  for (const l of logs) {
    const at = l.timestamp as Date;
    const day = brusselsDay(at);
    const cur = perDay.get(day) ?? { first: null, last: null };
    const h = hourOf(at);
    if (l.type === 'opening') cur.first = cur.first === null ? h : Math.min(cur.first, h);
    else cur.last = cur.last === null ? h : Math.max(cur.last, h);
    perDay.set(day, cur);
  }
  const out = new Map<string, { from: number; to: number }>();
  for (const [day, { first, last }] of perDay) {
    if (first === null || last === null || last <= first) continue;
    out.set(day, { from: Math.floor(first), to: Math.min(24, Math.ceil(last)) });
  }
  return out;
}

export async function hasWaterMeter(siteId: string): Promise<boolean> {
  return !!(await SiteIntegration.exists({ site_id: siteId, provider: 'shayp', enabled: true, external_id: { $ne: '' } }));
}

// Days from..to inclusive (YYYY-MM-DD)
export async function waterOverview(siteId: string | Types.ObjectId, from: string, to: string): Promise<WaterOverview> {
  const sid = String(siteId);
  const [rows, first, windows, prices, washRows] = await Promise.all([
    IntegrationDay.find({ site_id: sid, provider: 'shayp', date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean(),
    IntegrationDay.findOne({ site_id: sid, provider: 'shayp', water_liters: { $gt: 0 } }).sort({ date: 1 }).select('date').lean(),
    openingWindows(sid, from, to),
    PriceConfig.find({ site_id: sid }).select('valid_from water_per_liter').lean(),
    IntegrationDay.find({ site_id: sid, provider: 'mycarwash', date: { $gte: from, $lte: to } }).select('date counters').lean(),
  ]);
  const washesByDay = new Map(washRows.map((w) => [w.date as string, washesOf(w.counters as Counter[])]));
  const firstMeasured = (first?.date as string | undefined) ?? null;

  const days: WaterDay[] = [];
  for (const r of rows) {
    const date = r.date as string;
    // Before the meter was installed Shayp reports 0: that is "not measured", leave it out
    if (!firstMeasured || date < firstMeasured) continue;
    const hourly = ((r.water_hourly as number[] | undefined)?.length === 24 ? (r.water_hourly as number[]) : null);
    const total = (r.water_liters as number) ?? 0;
    const w = windows.get(date);
    const openFrom = w?.from ?? DEFAULT_OPEN_HOUR;
    const openTo = w?.to ?? DEFAULT_CLOSE_HOUR;
    const open = hourly ? hourly.reduce((s, v, h) => s + (h >= openFrom && h < openTo ? v : 0), 0) : total;
    const price = (priceAt(prices as { valid_from?: Date; water_per_liter?: number }[], new Date(`${date}T12:00:00Z`))?.water_per_liter as number) ?? 0;
    days.push({
      date,
      total,
      open,
      closed: total - open,
      leak: (r.water_leak_liters as number) ?? 0,
      openFrom,
      openTo,
      fromLogboek: !!w,
      hourly: hourly ?? Array(24).fill(0),
      cost: Math.round((total / 1000) * price * 100) / 100,
      washes: washesByDay.get(date) ?? null,
    });
  }
  const washDays = days.filter((d) => d.washes !== null && d.washes > 0);
  const washes = washDays.reduce((s, d) => s + (d.washes ?? 0), 0);

  const sum = (f: (d: WaterDay) => number) => days.reduce((s, d) => s + f(d), 0);
  const withHourly = days.filter((d) => d.hourly.some((v) => v > 0));
  const avgHourly = Array.from({ length: 24 }, (_, h) =>
    withHourly.length ? Math.round(withHourly.reduce((s, d) => s + d.hourly[h], 0) / withHourly.length) : 0);
  const nightLiters = Array.from({ length: 24 }, (_, h) =>
    days.reduce((s, d) => s + (h >= d.openFrom && h < d.openTo ? 0 : d.hourly[h]), 0));
  const latestPrice = (priceAt(prices as { valid_from?: Date; water_per_liter?: number }[], new Date(`${to}T12:00:00Z`))?.water_per_liter as number) ?? 0;

  return {
    days,
    firstMeasured,
    total: sum((d) => d.total),
    open: sum((d) => d.open),
    closed: sum((d) => d.closed),
    leak: sum((d) => d.leak),
    cost: Math.round(sum((d) => d.cost) * 100) / 100,
    pricePerM3: latestPrice,
    avgPerDay: days.length ? Math.round(sum((d) => d.total) / days.length) : 0,
    measuredDays: days.length,
    avgHourly,
    peakDay: days.reduce<WaterDay | null>((m, d) => (!m || d.total > m.total ? d : m), null),
    nightLiters,
    washes,
    litersPerWash: washes > 0 ? Math.round(washDays.reduce((s, d) => s + d.total, 0) / washes) : null,
  };
}

type Counter = { controller?: number; pos?: number };
// All washes that day: the wash controller's count, or the till's when the controller reports 0
export function washesOf(counters: Counter[] | undefined): number {
  return (counters ?? []).reduce((s, c) => s + ((c.controller || c.pos) ?? 0), 0);
}

export interface IngavePeriod {
  from: string; // first day (inclusive)
  to: string; // ingave date (inclusive)
  wagens: number;
  liters: number | null; // null when the meter did not measure every day of the period
  litersPerWash: number | null;
}

// Water per wasbeurt per ingave period (wagens from the monthly ingave). Only periods the
// meter measured completely get a figure: a partial month would give a too low number.
export async function waterPerIngave(siteId: string, limit = 6): Promise<IngavePeriod[]> {
  const entries = await WeeklyEntry.find({ site_id: siteId }).sort({ week_start: -1 }).limit(limit + 1).select('week_start program_counts').lean();
  const first = await IntegrationDay.findOne({ site_id: siteId, provider: 'shayp', water_liters: { $gt: 0 } }).sort({ date: 1 }).select('date').lean();
  const firstMeasured = (first?.date as string | undefined) ?? null;
  const out: IngavePeriod[] = [];
  for (let i = 0; i < Math.min(limit, entries.length - 1); i++) {
    const to = new Date(entries[i].week_start as Date).toISOString().slice(0, 10);
    const from = addDays(new Date(entries[i + 1].week_start as Date).toISOString().slice(0, 10), 1);
    const wagens = ((entries[i].program_counts as { count?: number }[]) ?? []).reduce((s, p) => s + (p.count ?? 0), 0);
    let liters: number | null = null;
    if (firstMeasured && firstMeasured <= from) {
      const rows = await IntegrationDay.find({ site_id: siteId, provider: 'shayp', date: { $gte: from, $lte: to } }).select('water_liters').lean();
      const expected = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 864e5) + 1;
      if (rows.length === expected) liters = rows.reduce((s, r) => s + ((r.water_liters as number) ?? 0), 0);
    }
    out.push({ from, to, wagens, liters, litersPerWash: liters !== null && wagens > 0 ? Math.round(liters / wagens) : null });
  }
  return out;
}

// Leak / unusual use outside opening hours on `day`, compared with the 14 days before.
// Returns a message, or null when nothing stands out.
export function waterAnomaly(day: WaterDay, previous: WaterDay[]): { kind: 'leak' | 'night'; liters: number } | null {
  if (day.leak >= 50) return { kind: 'leak', liters: day.leak };
  const prev = previous.map((d) => d.closed).sort((a, b) => a - b);
  const median = prev.length ? prev[Math.floor(prev.length / 2)] : 0;
  // Osmosis/softener run every night: only alert when clearly above that usual level
  if (prev.length >= 5 && day.closed >= 150 && day.closed > Math.max(2 * median, median + 150)) {
    return { kind: 'night', liters: day.closed };
  }
  return null;
}

export const waterDayRange = (endDay: string, n: number) => ({ from: addDays(endDay, -(n - 1)), to: endDay });
