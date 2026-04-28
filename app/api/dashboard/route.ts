/**
 * GET /api/dashboard?siteId=...
 *
 * Returns all data needed by the carwash dashboard in one call:
 * - latest weekly entry (consumption, wagens, chemical usages)
 * - previous weekly entry (for deltas)
 * - wash programs
 * - active price config
 * - chemical stock (voorraad)
 * - overdue maintenance tasks (alerts)
 * - recent maintenance logs (onderhoud)
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import {
  WeeklyEntry,
  WashProgram,
  PriceConfig,
  ChemicalStock,
  MaintenanceTask,
  MaintenanceLog,
  Site,
} from '@/lib/models';
import type { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  await dbConnect();

  const siteId = req.nextUrl.searchParams.get('siteId');

  // If no siteId provided, use the first site in the database
  let resolvedSiteId: string;
  if (siteId) {
    resolvedSiteId = siteId;
  } else {
    const firstSite = await Site.findOne({}).select('_id').lean();
    if (!firstSite) {
      return NextResponse.json({ error: 'No sites found' }, { status: 404 });
    }
    resolvedSiteId = (firstSite._id as Types.ObjectId).toString();
  }

  const filter = { site_id: resolvedSiteId };

  const [entries, programs, priceConfig, stocks, alerts, maintenanceLogs] = await Promise.all([
    // Last 2 weekly entries sorted by week_start desc
    WeeklyEntry.find(filter).sort({ week_start: -1 }).limit(2).lean(),
    WashProgram.find(filter).sort({ tier: 1 }).lean(),
    PriceConfig.find(filter).sort({ valid_from: -1 }).limit(1).lean(),
    ChemicalStock.find(filter).sort({ name: 1 }).lean(),
    MaintenanceTask.find(filter).lean(),
    MaintenanceLog.find(filter).sort({ done_at: -1 }).limit(10).lean(),
  ]);

  const current = entries[0] ?? null;
  const previous = entries[1] ?? null;

  // ── Compute cost from consumption using price config ──────────
  const price = priceConfig[0];

  function cost(val: number, rate: number) {
    return price ? Math.round(val * rate * 100) / 100 : 0;
  }

  function delta(curr: number, prev: number | undefined) {
    if (prev === undefined || prev === null) return 0;
    return Math.round((curr - prev) * 100) / 100;
  }

  const consumption = current
    ? {
        water: {
          value: cost(current.water_liters, price?.water_per_liter ?? 0),
          delta: delta(
            cost(current.water_liters, price?.water_per_liter ?? 0),
            previous ? cost(previous.water_liters, price?.water_per_liter ?? 0) : undefined,
          ),
          raw: current.water_liters,
        },
        energy: {
          value: cost(current.energy_kw, price?.energy_per_kw ?? 0),
          delta: delta(
            cost(current.energy_kw, price?.energy_per_kw ?? 0),
            previous ? cost(previous.energy_kw, price?.energy_per_kw ?? 0) : undefined,
          ),
          raw: current.energy_kw,
        },
        salt: {
          value: cost(current.salt_kg, price?.salt_per_kg ?? 0),
          delta: delta(
            cost(current.salt_kg, price?.salt_per_kg ?? 0),
            previous ? cost(previous.salt_kg, price?.salt_per_kg ?? 0) : undefined,
          ),
          raw: current.salt_kg,
        },
        flock: {
          value: cost(current.flock_kg, price?.flock_per_kg ?? 0),
          delta: delta(
            cost(current.flock_kg, price?.flock_per_kg ?? 0),
            previous ? cost(previous.flock_kg, price?.flock_per_kg ?? 0) : undefined,
          ),
          raw: current.flock_kg,
        },
        cloth: {
          value: cost((current as Record<string, unknown>).cloth_units as number ?? 0, price?.cloth_per_unit ?? 0),
          delta: delta(
            cost((current as Record<string, unknown>).cloth_units as number ?? 0, price?.cloth_per_unit ?? 0),
            previous ? cost((previous as Record<string, unknown>).cloth_units as number ?? 0, price?.cloth_per_unit ?? 0) : undefined,
          ),
          raw: (current as Record<string, unknown>).cloth_units as number ?? 0,
        },
      }
    : null;

  // ── Total wagens ──────────────────────────────────────────────
  const wagensCount = current?.program_counts?.reduce((sum: number, p: { count?: number }) => sum + (p.count ?? 0), 0) ?? 0;
  const prevWagensCount = previous?.program_counts?.reduce((sum: number, p: { count?: number }) => sum + (p.count ?? 0), 0) ?? 0;

  // ── Chemical usages for ProgrammaCard ─────────────────────────
  const chemieRows = (current?.chemical_usages ?? []).map((cu: { chemical_id?: { toString(): string }; name: string; amount: number; unit: string }) => {
    const prevUsage = previous?.chemical_usages?.find(
      (p: { chemical_id?: { toString(): string }; amount: number }) => p.chemical_id?.toString() === cu.chemical_id?.toString(),
    );
    const priceEntry = price?.chemicals?.find(
      (c: { chemical_id?: { toString(): string }; price_per_unit: number }) => c.chemical_id?.toString() === cu.chemical_id?.toString(),
    );
    const rate = priceEntry?.price_per_unit ?? 0;
    const value = Math.round(cu.amount * rate * 100) / 100;
    const prevValue = prevUsage ? Math.round(prevUsage.amount * rate * 100) / 100 : 0;
    return {
      name: cu.name,
      value,
      delta: Math.round((value - prevValue) * 100) / 100,
      amount: cu.amount,
      unit: cu.unit,
    };
  });

  // ── Maintenance alerts ─────────────────────────────────────────
  const formattedAlerts = alerts.map((t) => ({
    id: t._id.toString(),
    description: t.description,
    is_overdue: t.is_overdue,
    trigger_type: t.trigger_type,
    trigger_value: t.trigger_value,
    last_done_at: t.last_done_at,
  }));

  const formattedLogs = maintenanceLogs.map((l) => ({
    id: l._id.toString(),
    task_id: l.task_id?.toString(),
    done_at: l.done_at,
    notes: l.notes,
  }));

  // ── Voorraad (stock) ───────────────────────────────────────────
  const voorraad = stocks.map((s) => ({
    id: s._id.toString(),
    name: s.name,
    current_stock: s.current_stock,
    min_stock_alert: s.min_stock_alert,
    unit: s.unit,
    last_updated: s.last_updated,
  }));

  return NextResponse.json({
    siteId: resolvedSiteId,
    weekStart: current?.week_start ?? null,
    programs: programs.map((p) => ({ id: p._id.toString(), name: p.name, tier: p.tier })),
    chemieRows,
    consumption,
    wagens: { count: wagensCount, delta: wagensCount - prevWagensCount },
    alerts: formattedAlerts,
    maintenanceLogs: formattedLogs,
    voorraad,
  });
}
