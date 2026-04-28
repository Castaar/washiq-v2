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
} from '@/lib/models';
import { UsageToggle } from '@/components/dashboard/UsageToggle/UsageToggle';
import { ProgrammaCard } from '@/components/dashboard/ProgrammaCard/ProgrammaCard';
import type { ProgramOption } from '@/components/dashboard/ProgrammaCard/ProgrammaCard';
import { ConsumptionCard } from '@/components/dashboard/ConsumptionCard/ConsumptionCard';
import { WagensCard } from '@/components/dashboard/WagensCard/WagensCard';
import { RankingWidget } from '@/components/dashboard/RankingWidget/RankingWidget';
import { CarwashHero } from '@/components/dashboard/CarwashHero/CarwashHero';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel/AlertsPanel';
import { VoorraadPanel } from '@/components/dashboard/VoorraadPanel/VoorraadPanel';
import { ParamSelector } from '@/components/layout/NavBar/ParamSelector';
import { SiteSelector } from '@/components/layout/NavBar/SiteSelector';
import type { AlertItem, AlertsPanelData, VoorraadItem, ChemieRow, ConsumptionData, DagfichePayload, IncidentSchadePayload, IncidentEhboPayload, DefectPayload, MaintenanceTaskPayload } from '@/lib/types/dashboard';
import styles from './CarwashPage.module.scss';
import type { Types } from 'mongoose';

export async function CarwashPage({
  siteId: propSiteId,
  period = 'week',
  view = 'prijs',
  usage = 'totaal',
  sites,
  addHref,
  addLabel,
  userRole = 'employee',
}: {
  siteId?: string;
  period?: 'week' | 'month';
  view?: 'prijs' | 'liter';
  usage?: 'totaal' | 'wagen';
  sites?: { id: string; name: string; location: string }[];
  addHref?: string;
  addLabel?: string;
  userRole?: string;
}) {
  await dbConnect();

  // ── Resolve site ─────────────────────────────────────────────
  const resolvedSite = propSiteId
    ? await Site.findById(propSiteId).select('_id owner_id').lean()
    : await Site.findOne({}).select('_id owner_id').lean();
  const siteId = resolvedSite ? (resolvedSite._id as Types.ObjectId).toString() : null;
  const filter = siteId ? { site_id: siteId } : {};

  // ── Fetch all data in parallel ───────────────────────────────
  const [entries, programs, priceConfigs, stocks, tasks, logs, checklists, incSchades, incEhbos, defects] = await Promise.all([
    WeeklyEntry.find(filter).sort({ week_start: -1 }).limit(9).lean(),
    WashProgram.find(filter).sort({ tier: 1 }).lean(),
    PriceConfig.find(filter).sort({ valid_from: -1 }).limit(1).lean(),
    ChemicalStock.find(filter).sort({ name: 1 }).lean(),
    MaintenanceTask.find(filter).lean(),
    MaintenanceLog.find(filter).sort({ done_at: -1 }).limit(10).lean(),
    DailyChecklist.find(filter).sort({ submitted_at: -1 }).limit(7).lean(),
    IncidentSchade.find(filter).sort({ created_at: -1 }).limit(8).lean(),
    IncidentEhbo.find(filter).sort({ created_at: -1 }).limit(8).lean(),
    Defect.find(filter).sort({ created_at: -1 }).limit(8).lean(),
  ]);

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
  // Week:  this week's single entry vs last week's single entry
  // Month: sum of last 4 weeks vs sum of prior 4 weeks
  const current  = period === 'month' ? aggregateEntries(entries.slice(0, 4)) : (entries[0] ?? null);
  const previous = period === 'month' ? aggregateEntries(entries.slice(4, 8)) : (entries[1] ?? null);
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
  const saltRaw   = current?.salt_kg      ?? 0;
  const flockRaw  = current?.flock_kg     ?? 0;
  const waterRaw  = current?.water_liters ?? 0;
  const energyRaw = current?.energy_kw    ?? 0;
  const clothRaw  = (current as Record<string, unknown>)?.cloth_units as number ?? 0;

  const saltPrevRaw   = previous?.salt_kg      ?? 0;
  const flockPrevRaw  = previous?.flock_kg     ?? 0;
  const waterPrevRaw  = previous?.water_liters ?? 0;
  const energyPrevRaw = previous?.energy_kw    ?? 0;
  const clothPrevRaw  = (previous as Record<string, unknown>)?.cloth_units as number ?? 0;

  const saltVal   = getVal(saltRaw,   price?.salt_per_kg      ?? 0);
  const flockVal  = getVal(flockRaw,  price?.flock_per_kg     ?? 0);
  const waterVal  = getVal(waterRaw,  price?.water_per_liter  ?? 0);
  const energyVal = getVal(energyRaw, price?.energy_per_kw    ?? 0);
  const clothVal  = getVal(clothRaw,  price?.cloth_per_unit   ?? 0);

  const saltPrev   = getPrev(saltPrevRaw,   price?.salt_per_kg      ?? 0);
  const flockPrev  = getPrev(flockPrevRaw,  price?.flock_per_kg     ?? 0);
  const waterPrev  = getPrev(waterPrevRaw,  price?.water_per_liter  ?? 0);
  const energyPrev = getPrev(energyPrevRaw, price?.energy_per_kw    ?? 0);
  const clothPrev  = getPrev(clothPrevRaw,  price?.cloth_per_unit   ?? 0);

  const zoutData: ConsumptionData    = { label: 'Zout',           value: saltVal,   delta: calcDelta(saltVal, saltPrev),     prefix: cardPrefix, suffix: view === 'liter' ? 'kg' : undefined,    lowerIsBetter: true };
  const flocData: ConsumptionData    = { label: 'Flockmiddel',    value: flockVal,  delta: calcDelta(flockVal, flockPrev),   prefix: cardPrefix, suffix: view === 'liter' ? 'kg' : undefined,    lowerIsBetter: true };
  const clothData: ConsumptionData   = { label: 'Ruitendoekjes',  value: clothVal,  delta: calcDelta(clothVal, clothPrev),   prefix: cardPrefix, suffix: view === 'liter' ? 'st' : undefined,    lowerIsBetter: true };
  const waterData: ConsumptionData   = { label: 'Water',          value: waterVal,  delta: calcDelta(waterVal, waterPrev),   prefix: cardPrefix, suffix: view === 'liter' ? 'L' : undefined,     lowerIsBetter: true };
  const energieData: ConsumptionData = { label: 'Energie',        value: energyVal, delta: calcDelta(energyVal, energyPrev), prefix: cardPrefix, suffix: view === 'liter' ? 'kWh' : undefined,   lowerIsBetter: true };

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
    return { id: cu.chemical_id?.toString() ?? String(i), label: cu.name, value: val, delta: calcDelta(val, prevVal) };
  });

  const programOptions: ProgramOption[] = programs.map((p) => {
    const pid = (p._id as Types.ObjectId).toString();
    const curr = (current?.program_counts ?? []).find(
      (c: { program_id?: { toString(): string }; count: number }) => c.program_id?.toString() === pid,
    );
    const prev = (previous?.program_counts ?? []).find(
      (c: { program_id?: { toString(): string }; count: number }) => c.program_id?.toString() === pid,
    );
    return {
      id: pid,
      name: p.name as string,
      count: curr?.count ?? 0,
      prevCount: prev?.count ?? 0,
    };
  });

  // ── Alerts panel ─────────────────────────────────────────────
  function fmtDate(d: Date) {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  const alertItems: AlertItem[] = tasks
    .filter((t) => t.is_overdue)
    .map((t) => {
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

  const pendingItems: AlertItem[] = tasks
    .filter((t) => !t.is_overdue)
    .map((t) => ({
      id:       t._id.toString(),
      refType:  'maintenance_task' as const,
      siteId:   siteId ?? '',
      title:    t.description,
      severity: 'medium' as const,
      iconName: 'wrench',
    }));

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

  const alertsPanelData: AlertsPanelData = {
    alerts:    [...alertItems, ...pendingItems, ...dagficheAlerts],
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
        <Suspense fallback={null}>
          <ParamSelector label="Tijd" paramKey="period" options={PERIOD_OPTIONS} activeValue={period} />
        </Suspense>
        <Suspense fallback={null}>
          <ParamSelector label="Weergave" paramKey="view" options={VIEW_OPTIONS} activeValue={view} />
        </Suspense>
      </div>

      {/* ── Centre hero ─────────────────────────────────────── */}
      <div className={styles.hero}>
        <CarwashHero />
      </div>

      {/* ── Right column ────────────────────────────────────── */}
      <aside className={styles.right}>
        <AlertsPanel data={alertsPanelData} />
        <VoorraadPanel items={voorraad} />
      </aside>

      {/* ── Left column ─────────────────────────────────────── */}
      <aside className={styles.left}>
        <Suspense fallback={null}><UsageToggle activeUsage={usage} /></Suspense>
        <ProgrammaCard
          programs={programOptions}
          chemieRows={chemieRows}
        />
        <div className={styles.twoCol}>
          <ConsumptionCard data={zoutData} />
          <ConsumptionCard data={flocData} />
          <ConsumptionCard data={clothData} />
        </div>
      </aside>

      {/* ── Bottom bar ──────────────────────────────────────── */}
      <div className={styles.foot}>
        <ConsumptionCard data={waterData} />
        <ConsumptionCard data={energieData} />
        <WagensCard count={wagensCount} delta={wagensCount - wagensPrev} />
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
