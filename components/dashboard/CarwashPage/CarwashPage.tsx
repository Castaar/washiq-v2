import { Suspense } from 'react';
import Link from 'next/link';
import { dbConnect } from '@/lib/db/mongoose';
import {
  WeeklyEntry,
  WashProgram,
  ChemicalStock,
  MaintenanceTask,
  MaintenanceLog,
  PriceConfig,
  Site,
  User,
  DailyChecklist,
  IncidentSchade,
  IncidentEhbo,
  Defect,
  EnergyBill,
  AttendanceLog,
} from '@/lib/models';
import { ProgrammaCard } from '@/components/dashboard/ProgrammaCard/ProgrammaCard';
import type { ProgramOption } from '@/components/dashboard/ProgrammaCard/ProgrammaCard';
import { ConsumptionCard } from '@/components/dashboard/ConsumptionCard/ConsumptionCard';
import { WagensCard } from '@/components/dashboard/WagensCard/WagensCard';
import { RankingWidget } from '@/components/dashboard/RankingWidget/RankingWidget';
import { CarwashHero } from '@/components/dashboard/CarwashHero/CarwashHero';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel/AlertsPanel';
import { VoorraadPanel } from '@/components/dashboard/VoorraadPanel/VoorraadPanel';
import { LogboekPanel } from '@/components/logboek/LogboekPanel/LogboekPanel';
import type { LogEntry } from '@/components/logboek/LogboekPanel/LogboekPanel';
import { ParamSelector } from '@/components/layout/NavBar/ParamSelector';
import { DatePicker } from '@/components/layout/NavBar/DatePicker';
import { SiteSelector } from '@/components/layout/NavBar/SiteSelector';
import type { AlertItem, AlertsPanelData, VoorraadItem, ChemieRow, ConsumptionData, DagfichePayload, IncidentSchadePayload, IncidentEhboPayload, DefectPayload, MaintenanceTaskPayload } from '@/lib/types/dashboard';
import { computeIsOverdue, computeIsApproaching, washesRemaining } from '@/lib/maintenance';
import styles from './CarwashPage.module.scss';
import type { Types } from 'mongoose';

// Monday (00:00 UTC) of the ISO week containing the given date
function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() || 7; // Sunday -> 7
  d.setUTCDate(d.getUTCDate() - (dayOfWeek - 1));
  return d;
}

export async function CarwashPage({
  siteId: propSiteId,
  period = 'month',
  view = 'prijs',
  usage = 'totaal',
  refDate,
  sites,
  addHref,
  addLabel,
  userRole = 'employee',
  recentLogs = [],
  userName = '',
}: {
  siteId?: string;
  period?: 'week' | 'month';
  view?: 'prijs' | 'liter';
  usage?: 'totaal' | 'wagen';
  refDate?: string;
  sites?: { id: string; name: string; location: string }[];
  addHref?: string;
  addLabel?: string;
  userRole?: string;
  recentLogs?: LogEntry[];
  userName?: string;
}) {
  await dbConnect();

  // ── Resolve site ─────────────────────────────────────────────
  const resolvedSite = propSiteId
    ? await Site.findById(propSiteId).select('_id owner_id start_car_count').lean()
    : await Site.findOne({}).select('_id owner_id start_car_count').lean();
  const siteId = resolvedSite ? (resolvedSite._id as Types.ObjectId).toString() : null;
  const filter = siteId ? { site_id: siteId } : {};

  // ── Reference date: which period the owner is currently viewing ──
  const viewedDate = refDate && /^\d{4}-\d{2}-\d{2}$/.test(refDate) ? new Date(`${refDate}T00:00:00Z`) : new Date();
  const curYear = viewedDate.getUTCFullYear();
  const curMonth = viewedDate.getUTCMonth() + 1;
  const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
  const prevYear  = curMonth === 1 ? curYear - 1 : curYear;

  // Calendar-month boundaries for the viewed month and the one before it
  const curMonthStart  = new Date(Date.UTC(curYear, curMonth - 1, 1));
  const curMonthEnd    = new Date(Date.UTC(curYear, curMonth, 1));
  const prevMonthStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
  const prevMonthEnd   = curMonthStart;

  // ISO-week boundaries for the viewed week and the one before it
  const curWeekStart  = mondayOf(viewedDate);
  const prevWeekStart = new Date(curWeekStart); prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

  // ── Fetch all data in parallel ───────────────────────────────
  const today = new Date();

  const [entries, monthEntries, prevMonthEntries, lastTwoEntries, programs, priceConfigs, stocks, tasks, logs, checklists, incSchades, incEhbos, defects, energyBillCur, energyBillPrev, attendanceLogs] = await Promise.all([
    period === 'week'
      ? WeeklyEntry.find({ ...filter, week_start: { $in: [curWeekStart, prevWeekStart] } }).lean()
      : Promise.resolve([]),
    period === 'month' ? WeeklyEntry.find({ ...filter, week_start: { $gte: curMonthStart, $lt: curMonthEnd } }).lean() : Promise.resolve([]),
    period === 'month' ? WeeklyEntry.find({ ...filter, week_start: { $gte: prevMonthStart, $lt: prevMonthEnd } }).lean() : Promise.resolve([]),
    WeeklyEntry.find(filter).sort({ week_start: -1 }).limit(2).lean(),
    WashProgram.find(filter).sort({ tier: 1 }).lean(),
    PriceConfig.find(filter).sort({ valid_from: -1 }).limit(1).lean(),
    ChemicalStock.find(filter).sort({ name: 1 }).lean(),
    MaintenanceTask.find(filter).lean(),
    MaintenanceLog.find(filter).sort({ done_at: -1 }).limit(10).lean(),
    DailyChecklist.find(filter).sort({ submitted_at: -1 }).limit(7).lean(),
    IncidentSchade.find({ ...filter, $or: [{ is_resolved: false }, { is_resolved: { $exists: false } }] }).sort({ created_at: -1 }).limit(8).lean(),
    IncidentEhbo.find(filter).sort({ created_at: -1 }).limit(8).lean(),
    Defect.find({ ...filter, $or: [{ is_resolved: false }, { is_resolved: { $exists: false } }] }).sort({ created_at: -1 }).limit(8).lean(),
    siteId ? EnergyBill.findOne({ site_id: siteId, year: curYear,  month: curMonth  }).lean() : null,
    siteId ? EnergyBill.findOne({ site_id: siteId, year: prevYear, month: prevMonth }).lean() : null,
    AttendanceLog.find(filter).sort({ timestamp: -1 }).limit(15).lean(),
  ]);

  const latestEntry = lastTwoEntries[0] ?? null;
  const prevIngave  = lastTwoEntries[1] ?? null;

  // ── Per-wagen cost helper ─────────────────────────────────────
  type CostRow = { label: string; euroPerWagen: number; rawPerWagen?: number; unit?: string; isChemical?: boolean };
  function costPerWagen(entry: typeof latestEntry, energyBill: number): CostRow[] {
    if (!entry) return [];
    const p = priceConfigs[0] ?? null;
    const wagens = (entry.program_counts ?? []).reduce((s: number, pc: { count?: number }) => s + (pc.count ?? 0), 0);
    if (wagens === 0) return [];
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const rows: CostRow[] = [
      { label: 'Water',   euroPerWagen: r2((entry.water_liters ?? 0) * (p?.water_per_liter ?? 0) / wagens), rawPerWagen: r3((entry.water_liters ?? 0) / wagens), unit: 'm³' },
      { label: 'Energie', euroPerWagen: r2(energyBill / wagens) },
      { label: 'Zout',    euroPerWagen: r2((entry.salt_kg ?? 0) * (p?.salt_per_kg ?? 0) / wagens), rawPerWagen: r3((entry.salt_kg ?? 0) / wagens), unit: 'kg' },
      { label: 'Blob',    euroPerWagen: r2(((entry as Record<string,unknown>).blob_liters as number ?? 0) / wagens), rawPerWagen: r3(((entry as Record<string,unknown>).blob_liters as number ?? 0) / wagens), unit: 'L' },
    ];
    for (const cu of (entry.chemical_usages ?? []) as { name: string; amount: number; unit: string }[]) {
      const chemPrice = (p?.chemicals as { name: string; price_per_unit: number }[] | undefined)?.find((c) => c.name === cu.name);
      rows.push({ label: cu.name, euroPerWagen: r2((cu.amount ?? 0) * (chemPrice?.price_per_unit ?? 0) / wagens), rawPerWagen: r3((cu.amount ?? 0) / wagens), unit: cu.unit, isChemical: true });
    }
    return rows;
  }

  // ── Aggregate helper for month view ──────────────────────────
  type EntryLike = {
    water_liters?: number; energy_kw?: number; salt_kg?: number; flock_kg?: number; cloth_units?: number;
    program_counts?: { program_id?: { toString(): string }; name?: string; count?: number }[];
    chemical_usages?: { chemical_id?: { toString(): string }; name?: string; amount?: number; unit?: string }[];
  };

  function aggregateEntries(bucket: typeof entries): EntryLike | null {
    if (bucket.length === 0) return null;
    const r: Required<EntryLike> = {
      water_liters: 0, energy_kw: 0, salt_kg: 0, flock_kg: 0, cloth_units: 0,
      program_counts: [], chemical_usages: [],
    };
    for (const e of bucket) {
      r.water_liters += e.water_liters ?? 0;
      r.energy_kw    += e.energy_kw    ?? 0;
      r.salt_kg      += e.salt_kg      ?? 0;
      r.flock_kg     += e.flock_kg     ?? 0;
      r.cloth_units  += (e as Record<string, unknown>).cloth_units as number ?? 0;
      for (const pc of e.program_counts ?? []) {
        const pid = pc.program_id?.toString() ?? '';
        const ex = r.program_counts.find((x) => x.program_id?.toString() === pid);
        if (ex) { ex.count = (ex.count ?? 0) + (pc.count ?? 0); }
        else r.program_counts.push({ program_id: pc.program_id, name: pc.name ?? '', count: pc.count ?? 0 });
      }
      for (const cu of e.chemical_usages ?? []) {
        const cid = cu.chemical_id?.toString() ?? '';
        const ex = r.chemical_usages.find((x) => x.chemical_id?.toString() === cid);
        if (ex) { ex.amount = (ex.amount ?? 0) + (cu.amount ?? 0); }
        else r.chemical_usages.push({ chemical_id: cu.chemical_id, name: cu.name ?? '', amount: cu.amount ?? 0, unit: cu.unit ?? '' });
      }
    }
    return r;
  }

  // ── Divide aggregate by N (for per-week averaging) ───────────
  function divideAggregate(entry: EntryLike, n: number): EntryLike {
    if (n <= 1) return entry;
    return {
      water_liters: (entry.water_liters ?? 0) / n,
      energy_kw:    (entry.energy_kw    ?? 0) / n,
      salt_kg:      (entry.salt_kg      ?? 0) / n,
      flock_kg:     (entry.flock_kg     ?? 0) / n,
      cloth_units:  (entry.cloth_units  ?? 0) / n,
      program_counts: (entry.program_counts ?? []).map((pc) => ({
        ...pc, count: (pc.count ?? 0) / n,
      })),
      chemical_usages: (entry.chemical_usages ?? []).map((cu) => ({
        ...cu, amount: (cu.amount ?? 0) / n,
      })),
    };
  }

  // ── Build current / previous aggregates ──────────────────────
  // Week:  the viewed week's entry vs the week before it
  // Month: sum of all weeks within the viewed calendar month vs the month before it
  const curWeekStartMs = curWeekStart.getTime();
  const prevWeekStartMs = prevWeekStart.getTime();
  const monthAggregate = period === 'month' ? aggregateEntries(monthEntries) : null;
  // If the current period has no entries, fall back to the latest entry so cards show real data
  const noCurrentData = period === 'month' ? monthEntries.length === 0 : !entries.find((e) => new Date(e.week_start as Date).getTime() === curWeekStartMs);
  const current  = period === 'month'
    ? (monthAggregate ?? latestEntry ?? null)
    : (entries.find((e) => new Date(e.week_start as Date).getTime() === curWeekStartMs) ?? latestEntry ?? null);
  // When falling back to latestEntry, suppress deltas (previous = null)
  const previous = noCurrentData ? null : (period === 'month'
    ? aggregateEntries(prevMonthEntries)
    : (entries.find((e) => new Date(e.week_start as Date).getTime() === prevWeekStartMs) ?? null));
  const price = priceConfigs[0] ?? null;

  // ── Wagens (needed before consumption cards for per-car division) ─
  const wagensCount = current?.program_counts?.reduce((s: number, p: { count?: number }) => s + (p.count ?? 0), 0) ?? 0;
  const wagensPrev  = previous?.program_counts?.reduce((s: number, p: { count?: number }) => s + (p.count ?? 0), 0) ?? 0;
  const divisor     = usage === 'wagen' && wagensCount > 0 ? wagensCount : 1;
  const prevDivisor = usage === 'wagen' && wagensPrev  > 0 ? wagensPrev  : 1;

  // ── Helper: cost & delta ────────────────────────────────────
  const calcCost = (val: number, rate: number) =>
    price ? Math.round(val * rate * 100) / 100 : val;
  const calcDelta = (curr: number, prev: number) =>
    Math.round((curr - prev) * 100) / 100;

  // ── View helpers ─────────────────────────────────────────────
  const getVal = (raw: number, rate: number, div = divisor) =>
    view === 'prijs' ? calcCost(raw / div, rate) : Math.round((raw / div) * 1000) / 1000;
  const getPrev = (raw: number, rate: number) => getVal(raw, rate, prevDivisor);
  const cardPrefix = view === 'prijs' ? '€' : undefined;
  const perCar     = usage === 'wagen' ? '/wagen' : undefined;

  // ── Consumption cards ────────────────────────────────────────
  const saltRaw  = current?.salt_kg      ?? 0;
  const waterRaw = current?.water_liters ?? 0;
  const blobRaw  = (current as Record<string, unknown>)?.blob_liters as number ?? 0;

  const saltPrevRaw  = previous?.salt_kg      ?? 0;
  const waterPrevRaw = previous?.water_liters ?? 0;
  const blobPrevRaw  = (previous as Record<string, unknown>)?.blob_liters as number ?? 0;

  const saltVal  = getVal(saltRaw,  price?.salt_per_kg     ?? 0);
  const waterVal = getVal(waterRaw, price?.water_per_liter ?? 0);
  const blobVal  = getVal(blobRaw,  0);
  const curBillAmount  = (energyBillCur?.amount_euro  as number | undefined) ?? 0;
  const prevBillAmount = (energyBillPrev?.amount_euro as number | undefined) ?? 0;
  // In fallback mode the displayed data is from the previous period, so use its energy bill
  const effectiveBillAmount = noCurrentData ? prevBillAmount : curBillAmount;
  const energyVal  = wagensCount > 0 ? Math.round((effectiveBillAmount / wagensCount) * 100) / 100 : effectiveBillAmount;

  const saltPrev  = getPrev(saltPrevRaw,  price?.salt_per_kg     ?? 0);
  const waterPrev = getPrev(waterPrevRaw, price?.water_per_liter ?? 0);
  const blobPrev  = getPrev(blobPrevRaw,  0);
  const energyPrev = wagensPrev > 0 && usage === 'wagen' ? Math.round((prevBillAmount / wagensPrev) * 100) / 100 : prevBillAmount;

  const zoutData: ConsumptionData    = { label: 'Zout',    value: saltVal,  delta: calcDelta(saltVal, saltPrev),   prefix: cardPrefix, suffix: view === 'liter' ? 'kg' : undefined, lowerIsBetter: true };
  const blobData: ConsumptionData    = { label: 'Blob',    value: blobVal,  delta: calcDelta(blobVal, blobPrev),   prefix: cardPrefix, suffix: view === 'liter' ? 'L'  : undefined, lowerIsBetter: true };
  const waterData: ConsumptionData   = { label: 'Water',   value: waterVal, delta: calcDelta(waterVal, waterPrev), prefix: cardPrefix, suffix: view === 'liter' ? 'm³' : undefined, lowerIsBetter: true };
  const energieData: ConsumptionData = { label: 'Energie', value: energyVal, delta: calcDelta(energyVal, energyPrev), prefix: '€', lowerIsBetter: true };

  // ── Wagens is already calculated above ───────────────────────

  // ── ProgrammaCard: programOptions ────────────────────────────────
  const chemieRows: ChemieRow[] = (current?.chemical_usages ?? []).map((cu: { chemical_id?: { toString(): string }; name: string; amount: number; unit: string }, i: number) => {
    const priceEntry = price?.chemicals?.find(
      (c: { name?: string; price_per_unit: number }) => c.name === cu.name,
    );
    const rate = priceEntry?.price_per_unit ?? 0;
    const rawAmount = cu.amount / divisor;
    const val  = Math.round(rawAmount * rate * 100) / 100;
    const prev = previous?.chemical_usages?.find(
      (p: { name?: string; amount: number }) => p.name === cu.name,
    );
    const prevRawAmount = prev ? (prev.amount / prevDivisor) : 0;
    const prevVal = prev ? Math.round(prevRawAmount * rate * 100) / 100 : 0;
    return { id: cu.chemical_id?.toString() ?? String(i), label: cu.name, value: val, delta: calcDelta(val, prevVal), rawAmount: Math.round(rawAmount * 1000) / 1000, unit: cu.unit };
  });

  const programOptions: ProgramOption[] = programs.map((p) => {
    const pid = (p._id as Types.ObjectId).toString();
    const curr = (latestEntry?.program_counts ?? []).find(
      (c: { program_id?: { toString(): string }; count: number }) => c.program_id?.toString() === pid,
    );
    const prev = (prevIngave?.program_counts ?? []).find(
      (c: { program_id?: { toString(): string }; count: number }) => c.program_id?.toString() === pid,
    );
    return {
      id: pid,
      name: p.name as string,
      count: curr?.count ?? 0,
      prevCount: prev?.count ?? 0,
      chemicals: (p.chemicals as string[]) ?? [],
    };
  });

  // ── Alerts panel ─────────────────────────────────────────────
  function fmtDate(d: Date) {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  function fmtTime(d: Date) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  function fmtDuration(ms: number) {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}u${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
  }

  // Current tellerstand from the latest weekly entry, or fall back to start_car_count
  const startCarCount = (resolvedSite as Record<string, unknown>)?.start_car_count as number ?? 0;
  const currentTellerstand = (latestEntry as Record<string, unknown>)?.tellerstand as number ?? startCarCount;

  // Previous period's tellerstand for WagensCard delta
  const prevTellerstand = (prevIngave as Record<string, unknown> | null)?.tellerstand as number ?? startCarCount;
  const tellerstandDelta = latestEntry ? currentTellerstand - prevTellerstand : 0;

  // Energy bills for the two most recent ingave months
  const latestMonth = latestEntry ? new Date(latestEntry.week_start as Date).getUTCMonth() + 1 : curMonth;
  const latestYear  = latestEntry ? new Date(latestEntry.week_start as Date).getUTCFullYear() : curYear;
  const prevMonth2  = prevIngave  ? new Date(prevIngave.week_start  as Date).getUTCMonth() + 1 : prevMonth;
  const prevYear2   = prevIngave  ? new Date(prevIngave.week_start  as Date).getUTCFullYear() : prevYear;
  const [latestBillDoc, prevBillDoc] = siteId
    ? await Promise.all([
        EnergyBill.findOne({ site_id: siteId, year: latestYear, month: latestMonth }).lean(),
        EnergyBill.findOne({ site_id: siteId, year: prevYear2,  month: prevMonth2  }).lean(),
      ])
    : [null, null];
  const latestBillAmount = (latestBillDoc as Record<string,unknown> | null)?.amount_euro as number ?? 0;
  const prevBillAmount2  = (prevBillDoc  as Record<string,unknown> | null)?.amount_euro as number ?? effectiveBillAmount;

  // Cost breakdown per wagen for latest and previous ingave
  const latestCostRows = costPerWagen(latestEntry, latestBillAmount);
  const prevCostRows   = costPerWagen(prevIngave,  prevBillAmount2);

  const now = new Date();
  const alertItems: AlertItem[] = tasks
    // A washes-based task can't be "overdue" before any wagens have ever been recorded —
    // without that guard it falls back to a stale is_overdue flag and fires on day one.
    .filter((t) => !(t.trigger_type === 'washes' && currentTellerstand <= 0))
    .filter((t) => computeIsOverdue(t, now, currentTellerstand > 0 ? currentTellerstand : undefined))
    .map((t) => {
      const remaining = currentTellerstand > 0 ? washesRemaining(t, currentTellerstand) : null;
      const payload: MaintenanceTaskPayload = {
        type: 'maintenance_task',
        description: t.description,
        triggerType: t.trigger_type,
        triggerValue: t.trigger_value,
        triggerDay: t.trigger_day,
        triggerMonth: t.trigger_month,
        triggerMonthList: t.trigger_month_list,
        lastDoneAt: t.last_done_at ? fmtDate(new Date(t.last_done_at)) : undefined,
        washesAtLastDone: t.washes_at_last_done,
        washesRemaining: remaining ?? undefined,
        currentTellerstand: currentTellerstand > 0 ? currentTellerstand : undefined,
      };
      return {
        id:       t._id.toString(),
        refId:    t._id.toString(),
        refType:  'maintenance_task' as const,
        siteId:   siteId ?? '',
        title:    t.description,
        severity: 'high' as const,
        iconName: 'wrench',
        payload,
      };
    });

  // Approaching maintenance (within warning window, not yet overdue)
  const approachingItems: AlertItem[] = currentTellerstand > 0
    ? tasks
        .filter((t) => !computeIsOverdue(t, now, currentTellerstand) && computeIsApproaching(t, currentTellerstand))
        .map((t) => {
          const remaining = washesRemaining(t, currentTellerstand);
          const payload: MaintenanceTaskPayload = {
            type: 'maintenance_task',
            description: t.description,
            triggerType: t.trigger_type,
            triggerValue: t.trigger_value,
            triggerDay: t.trigger_day,
            triggerMonth: t.trigger_month,
            triggerMonthList: t.trigger_month_list,
            lastDoneAt: t.last_done_at ? fmtDate(new Date(t.last_done_at)) : undefined,
            washesAtLastDone: t.washes_at_last_done,
            washesRemaining: remaining ?? undefined,
            currentTellerstand,
          };
          return {
            id:       `approaching-${t._id.toString()}`,
            refId:    t._id.toString(),
            refType:  'maintenance_task' as const,
            siteId:   siteId ?? '',
            title:    t.description,
            subtitle: remaining !== null ? `Nog ${remaining.toLocaleString('nl-BE')} wagens` : undefined,
            severity: 'medium' as const,
            iconName: 'wrench',
            payload,
          };
        })
    : [];

  // Dagfiche alerts: unchecked items, items with remarks, and defect notes
  const dagficheAlerts: AlertItem[] = [];
  for (const cl of checklists) {
    const clDate = fmtDate(new Date(cl.submitted_at as Date ?? cl.date as Date));
    const clItems = (cl.items as { label: string; checked: boolean; opmerking?: string }[]) ?? [];
    for (const it of clItems) {
      const hasOpmerking = it.opmerking && String(it.opmerking).trim();
      if (!it.checked || hasOpmerking) {
        dagficheAlerts.push({
          id:      `${(cl._id as Types.ObjectId).toString()}-${it.label}`,
          refId:   (cl._id as Types.ObjectId).toString(),
          refType: 'daily_checklist' as const,
          siteId:  siteId ?? '',
          title: it.label,
          subtitle: hasOpmerking
            ? String(it.opmerking).trim()
            : 'Niet afgevinkt',
          date: clDate,
          severity: (!it.checked ? 'high' : 'medium') as 'high' | 'medium',
          iconName: 'clipboard',
        });
      }
    }
  }

  // Resolve user names for checklists
  const checklistUserIds = [...new Set(checklists.map((cl) => cl.user_id?.toString()).filter(Boolean))];
  const checklistUsers = checklistUserIds.length
    ? await User.find({ _id: { $in: checklistUserIds } }).select('_id name').lean()
    : [];
  const userNameMap = Object.fromEntries(checklistUsers.map((u) => [(u._id as Types.ObjectId).toString(), u.name as string]));

  const onderhoudItems: AlertItem[] = [
    ...checklists.map((cl) => {
      const submittedDate = new Date(cl.submitted_at as Date ?? cl.date as Date);
      const payload: DagfichePayload = {
        type: 'dagfiche',
        submittedBy: userNameMap[cl.user_id?.toString() ?? ''] ?? 'Onbekend',
        submittedAt: submittedDate.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        items: (cl.items as { label: string; checked: boolean; opmerking?: string }[]).map(
          ({ label, checked, opmerking }) => ({ label, checked, opmerking }),
        ),
        defectNote: cl.defect_note ? String(cl.defect_note) : undefined,
      };
      return {
        id:      (cl._id as Types.ObjectId).toString(),
        refType: 'daily_checklist' as const,
        siteId:  siteId ?? '',
        title:   'Dagfiche ingediend',
        subtitle: userNameMap[cl.user_id?.toString() ?? ''] ?? undefined,
        date:    fmtDate(submittedDate),
        severity: 'low' as const,
        iconName: 'check',
        payload,
      };
    }),
    ...logs.map((l) => ({
      id:      l._id.toString(),
      refType: 'maintenance_log' as const,
      siteId:  siteId ?? '',
      title:   l.notes || 'Onderhoud uitgevoerd',
      severity: 'low' as const,
      iconName: 'check',
    })),
  ];

  const incidentItems: AlertItem[] = [
    ...incSchades.map((s) => {
      const id = (s._id as Types.ObjectId).toString();
      const payload: IncidentSchadePayload = {
        type:                   'schade',
        reportedBy:             (s.reported_by_name as string) || '',
        date:                   fmtDate(new Date(s.created_at as Date)),
        typeVoertuig:           (s.type_voertuig as string) || '',
        merkModel:              (s.merk_model as string) || '',
        nummerplaat:            (s.nummerplaat as string) || '',
        naamEigenaar:           (s.naam_eigenaar as string) || '',
        telGsm:                 (s.tel_gsm as string) || '',
        email:                  (s.email as string) || '',
        omschrijving:           (s.omschrijving as string) || '',
        onbetwist:              Boolean(s.onbetwist),
        installatiefout:        Boolean(s.installatiefout),
        klantVerantwoordelijk:  Boolean(s.klant_verantwoordelijk),
        verzekeringsdocumenten: Boolean(s.verzekeringsdocumenten),
      };
      return {
        id,
        refId:    id,
        refType:  'incident_schade' as const,
        siteId:   siteId ?? '',
        title:    (s.merk_model as string) || 'Schade',
        subtitle: (s.omschrijving as string) || '',
        date:     fmtDate(new Date(s.created_at as Date)),
        severity: 'high' as const,
        iconName: 'warning',
        payload,
      };
    }),
    ...incEhbos.map((e) => {
      const payload: IncidentEhboPayload = {
        type:            'ehbo',
        reportedBy:      (e.reported_by_name as string) || '',
        date:            fmtDate(new Date(e.created_at as Date)),
        uur:             (e.uur as string) || '',
        naamSlachtoffer: (e.naam_slachtoffer as string) || '',
        afdelingLocatie: (e.afdeling_locatie as string) || '',
        verwonding:      (e.verwonding as string) || '',
        ehboHandeling:   (e.ehbo_handeling as string) || '',
        ehboVerlener:    (e.ehbo_verlener as string) || '',
        beschrijving:    (e.beschrijving as string) || '',
        dokterNodig:     Boolean(e.dokter_nodig),
      };
      return {
        id:      (e._id as Types.ObjectId).toString(),
        refType: 'incident_ehbo' as const,
        siteId:  siteId ?? '',
        title:   (e.naam_slachtoffer as string) || 'EHBO',
        subtitle: (e.verwonding as string) || '',
        date:    fmtDate(new Date(e.created_at as Date)),
        severity: 'medium' as const,
        iconName: 'warning',
        payload,
      };
    }),
    ...defects.map((d) => {
      const ernstMap: Record<string, 'low' | 'medium' | 'high'> = { laag: 'low', medium: 'medium', hoog: 'high' };
      const payload: DefectPayload = {
        type:         'defect',
        reportedBy:   (d.reported_by_name as string) || '',
        date:         fmtDate(new Date(d.created_at as Date)),
        omschrijving: (d.omschrijving as string) || '',
        ernst:        (d.ernst as string) || '',
      };
      return {
        id:      (d._id as Types.ObjectId).toString(),
        refType: 'defect' as const,
        siteId:  siteId ?? '',
        title:   ((d.omschrijving as string) ?? '').slice(0, 35) || 'Defect',
        subtitle: (d.ernst as string) || '',
        date:    fmtDate(new Date(d.created_at as Date)),
        severity: (ernstMap[d.ernst as string] ?? 'medium') as 'low' | 'medium' | 'high',
        iconName: 'wrench',
        payload,
      };
    }),
  ];

  // Consumption-per-car anomaly alerts: flags water/energy spikes and wax/chemical
  // drops vs. the previous period, since these usually surface as a surprise water
  // bill, motor wear, or cars coming out of the tunnel too wet.
  function pctChange(curr: number, prev: number): number | null {
    if (prev <= 0) return null;
    return ((curr - prev) / prev) * 100;
  }

  const waterCostPerCarCur  = wagensCount > 0 ? calcCost(waterRaw,  price?.water_per_liter ?? 0) / wagensCount : 0;
  const waterCostPerCarPrev = wagensPrev  > 0 ? calcCost(waterPrevRaw, price?.water_per_liter ?? 0) / wagensPrev  : 0;
  const flockCostPerCarCur  = 0;
  const flockCostPerCarPrev = 0;
  const energyPerCarCur     = wagensCount > 0 ? curBillAmount  / wagensCount : 0;
  const energyPerCarPrev    = wagensPrev  > 0 ? prevBillAmount / wagensPrev  : 0;

  const ANOMALY_THRESHOLD_PCT = 20;
  const consumptionAlertItems: AlertItem[] = [];

  const waterPct = pctChange(waterCostPerCarCur, waterCostPerCarPrev);
  if (waterPct !== null && waterPct >= ANOMALY_THRESHOLD_PCT) {
    consumptionAlertItems.push({
      id: 'consumption-water', siteId: siteId ?? '',
      title: `Waterverbruik per wagen +${Math.round(waterPct)}%`,
      subtitle: 'Sterke stijging t.o.v. vorige periode — controleer op lekken vóór de waterfactuur binnenkomt.',
      severity: 'high', iconName: 'warning',
    });
  }

  const energyPct = pctChange(energyPerCarCur, energyPerCarPrev);
  if (energyPct !== null && energyPct >= ANOMALY_THRESHOLD_PCT) {
    consumptionAlertItems.push({
      id: 'consumption-energy', siteId: siteId ?? '',
      title: `Energieverbruik per wagen +${Math.round(energyPct)}%`,
      subtitle: 'Kan wijzen op slijtage van de motor — best snel laten nakijken.',
      severity: 'high', iconName: 'warning',
    });
  }

  const flockPct = pctChange(flockCostPerCarCur, flockCostPerCarPrev);
  if (flockPct !== null && flockPct <= -ANOMALY_THRESHOLD_PCT) {
    consumptionAlertItems.push({
      id: 'consumption-flock', siteId: siteId ?? '',
      title: `Wax/chemie verbruik per wagen ${Math.round(flockPct)}%`,
      subtitle: 'Sterke daling — wagens kunnen te nat uit de tunnel komen.',
      severity: 'medium', iconName: 'warning',
    });
  }

  // Check-in / check-out events, used to keep the owner's feed limited to
  // completions, incidents and attendance — not proactive maintenance nagging.
  const attendanceAlertItems: AlertItem[] = attendanceLogs.map((l) => {
    const ts = new Date(l.timestamp as Date);
    const isExtern = (l.person_type as string) === 'technician_extern';
    const isDeparture = l.type === 'sluiting';

    // For departures: find the most recent arrival of same person before this timestamp
    let workedHours: string | undefined;
    if (isDeparture) {
      const arrival = attendanceLogs.find(
        (a) =>
          a.type === 'opening' &&
          (a.user_name as string) === (l.user_name as string) &&
          new Date(a.timestamp as Date).getTime() < ts.getTime(),
      );
      if (arrival) {
        const ms = ts.getTime() - new Date(arrival.timestamp as Date).getTime();
        const arrivalTime = fmtTime(new Date(arrival.timestamp as Date));
        workedHours = `${arrivalTime} → ${fmtTime(ts)} · ${fmtDuration(ms)} gewerkt`;
      }
    }

    const subtitleParts = [
      isExtern ? 'Externe technieker' : undefined,
      !isDeparture ? fmtTime(ts) : undefined,
      isDeparture && workedHours ? workedHours : undefined,
    ].filter(Boolean);

    return {
      id:       `attendance-${(l._id as Types.ObjectId).toString()}`,
      siteId:   siteId ?? '',
      title:    `${l.user_name ?? 'Onbekend'} is ${isDeparture ? 'vertrokken' : 'aangekomen'}`,
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined,
      date:     `${fmtDate(ts)} ${fmtTime(ts)}`,
      severity: 'low' as const,
      iconName: 'check',
    };
  });

  // Technicians need to see proactive "this is due" maintenance warnings to act on them.
  // The owner only needs to know once something is actually done, an incident happened,
  // or who came/went — proactive maintenance nagging belongs in the Onderhoud tab only.
  const isTechnician = userRole === 'technician';
  const alertsPanelData: AlertsPanelData = {
    alerts: isTechnician
      ? [...consumptionAlertItems, ...alertItems, ...approachingItems, ...dagficheAlerts]
      : [...onderhoudItems, ...incidentItems, ...attendanceAlertItems],
    onderhoud: onderhoudItems,
    incident:  incidentItems,
  };

  // ── Voorraad ─────────────────────────────────────────────────
  const voorraad: VoorraadItem[] = stocks.map((s) => ({
    id: s._id.toString(),
    name: s.name,
    current: s.current_stock,
    max: s.min_stock_alert > 0 ? s.min_stock_alert * 3 : 100,
    unit: s.unit,
  }));

  const PERIOD_OPTIONS = [{ label: 'Week', value: 'week' }, { label: 'Maand', value: 'month' }];
  const VIEW_OPTIONS   = [{ label: 'Prijs', value: 'prijs' }, { label: 'Liter', value: 'liter' }];

  // ── Ranking (owner / developer only) ─────────────────────────
  const isOwner = userRole === 'owner' || userRole === 'developer';
  const isEmployee = userRole === 'employee';
  let ownerRank = 1;
  let ownerTotal = 1;
  if (isOwner && siteId && resolvedSite?.owner_id) {
    const siblingDocs = await Site.find({ owner_id: resolvedSite.owner_id }).select('_id').lean();
    ownerTotal = siblingDocs.length;
    if (ownerTotal > 1) {
      const siblingIds = siblingDocs.map((s) => (s._id as Types.ObjectId).toString());
      const latestPerSite = await Promise.all(
        siblingIds.map((sId) =>
          WeeklyEntry.findOne({ site_id: sId }).sort({ week_start: -1 }).select('program_counts').lean(),
        ),
      );
      const ranked = siblingIds
        .map((sId, i) => ({
          siteId: sId,
          wagens: latestPerSite[i]?.program_counts?.reduce((s: number, p: { count?: number }) => s + (p.count ?? 0), 0) ?? 0,
        }))
        .sort((a, b) => b.wagens - a.wagens);
      const rankIdx = ranked.findIndex((s) => s.siteId === siteId);
      ownerRank = rankIdx >= 0 ? rankIdx + 1 : 1;
    }
  }

  return (
    <div className={styles.grid}>

      {/* ── Quick-access bar ─────────────────────────────────── */}
      {siteId && (
        <div className={styles.employeeQuickBar}>
          <Link href={`/dagfiche?site=${siteId}`} className={styles.quickBtn}>Dagfiche</Link>
          <Link href={`/logboek?site=${siteId}`} className={styles.quickBtn}>Logboek</Link>
          <Link href={`/opdrachten?site=${siteId}`} className={styles.quickBtn}>Opdrachten</Link>
          <Link href={`/planning?site=${siteId}`} className={styles.quickBtn}>Planning</Link>
          <Link href={`/incidenten?site=${siteId}`} className={styles.quickBtn}>Incidenten</Link>
          <Link href="/diversen" className={styles.quickBtn}>Diversen</Link>
          {!isEmployee && (
            <Link href="/technieker" className={styles.quickBtn}>Technieker</Link>
          )}
        </div>
      )}

      {/* ── Setup banner (shown when no price config exists) ─── */}
      {!price && (userRole === 'owner' || userRole === 'developer') && (
        <Link
          href={siteId ? `/instellingen?site=${siteId}` : '/instellingen'}
          className={styles.setupBanner}
        >
          <span>Prijzen nog niet ingesteld — stel uw instellingen in om kosten te berekenen</span>
          <span className={styles.setupArrow}>→</span>
        </Link>
      )}

      {/* ── Mobile-only selector row ─────────────────────────── */}
      <div className={styles.mobileSelectors}>
        {sites && sites.length > 0 && propSiteId && (
          <Suspense fallback={null}>
            <SiteSelector sites={sites} activeSiteId={propSiteId} />
          </Suspense>
        )}
        {addHref && addLabel && (
          <Link href={addHref} className={styles.mobileAddBtn}>{addLabel}</Link>
        )}
        {!isEmployee && (
          <>
            <Suspense fallback={null}>
              <ParamSelector label="Weergave" paramKey="view" options={VIEW_OPTIONS} activeValue={view} />
            </Suspense>
            {refDate && (
              <Suspense fallback={null}>
                <DatePicker activeDate={refDate} />
              </Suspense>
            )}
          </>
        )}
      </div>

      {/* ── Centre hero ─────────────────────────────────────── */}
      <div className={styles.hero}>
        <CarwashHero />
      </div>

      {/* ── Right column ────────────────────────────────────── */}
      <aside className={styles.right}>
        {isEmployee ? (
          <LogboekPanel
            siteId={siteId ?? ''}
            userRole={userRole}
            userName={userName}
            recentLogs={recentLogs}
          />
        ) : (
          <>
            <AlertsPanel data={alertsPanelData} />
            <VoorraadPanel items={voorraad} />
          </>
        )}
      </aside>

      {/* ── Left column (owner/developer only) ──────────────── */}
      {!isEmployee && (
        <aside className={styles.left}>
          <ProgrammaCard
            programs={programOptions}
            totalWagens={programOptions.reduce((s, p) => s + p.count, 0)}
            view={view}
            costBreakdown={latestCostRows}
            prevCostBreakdown={prevCostRows}
          />
        </aside>
      )}

      {/* ── Bottom bar ──────────────────────────────────────── */}
      {noCurrentData && latestEntry && (
        <div className={styles.fallbackNote}>
          Geen ingave voor deze periode — meest recente ingave getoond
        </div>
      )}
      <div className={styles.foot}>
        <div className={styles.spacer} />
        <div className={styles.rankingSlot}>
          {isOwner && (
            <RankingWidget
              rank={ownerRank}
              total={ownerTotal}
              isOwner={isOwner}
              siteId={siteId ?? ''}
            />
          )}
        </div>
      </div>
    </div>
  );
}
