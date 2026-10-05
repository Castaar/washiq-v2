import { cookies } from 'next/headers';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { HistoryList } from '@/components/forms/HistoryList/HistoryList';
import type { HistoryEntry, HistoryProgram } from '@/components/forms/HistoryList/HistoryList';
import { ChemieChart } from '@/components/historiek/ChemieChart/ChemieChart';
import type { ChemieDataPoint } from '@/components/historiek/ChemieChart/ChemieChart';
import { EventHistoryPanel } from '@/components/historiek/EventHistoryPanel/EventHistoryPanel';
import type { DefectHistoryItem, SchadeHistoryItem, OrderHistoryItem, MaintenanceHistoryItem, StockLedgerItem } from '@/components/historiek/EventHistoryPanel/EventHistoryPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WashProgram, WeeklyEntry, ChemicalStock, StockReading, User, EnergyBill, Defect, IncidentSchade, IncidentEhbo, OrderRequest, MaintenanceLog, StockDelivery, StockTransfer } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded, redirectWithSiteParam } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function HistoriekPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  await dbConnect();

  const session = await getSession();

  const cookieStore = await cookies();
  const cookieSite = cookieStore.get('dodane_active_site')?.value;

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location start_car_count start_water_count site_type').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite) || null;
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  redirectWithSiteParam('/historiek', { site }, siteId ?? '');
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';
  const siteDoc = siteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId);
  // Selfcarwash sites don't track per-program wagen counts, so the
  // wagen/chemie graphs and weekly-ingave list don't apply to them — but
  // the pannes/schade/bestellingen/onderhouden history below is still
  // fully relevant, so only skip the wagen-specific sections, not the page.
  const isSelfcarwash = siteDoc?.site_type === 'selfcarwash';
  const startCarCount = (siteDoc?.start_car_count as number) ?? 0;
  const startWaterCount = (siteDoc?.start_water_count as number) ?? 0;
  const filter = siteId ? { site_id: siteId } : {};

  const [programDocs, entryDocs, stockDocs, energyBillDocs, readingDocs, defectDocs, schadeDocs, ehboDocs, orderDocs, maintenanceLogDocs, deliveryDocs, transferDocs] = await Promise.all([
    WashProgram.find(filter).select('_id name tier chemicals').sort({ tier: 1 }).lean(),
    WeeklyEntry.find(filter).sort({ week_start: 1 }).lean(),
    ChemicalStock.find(filter).select('name unit').sort({ name: 1 }).lean(),
    EnergyBill.find(filter).select('year month amount_euro').lean(),
    StockReading.find(filter).select('name unit quantity consumption recorded_at recorded_by chemical_id').sort({ recorded_at: 1 }).lean(),
    Defect.find(filter).sort({ created_at: -1 }).limit(200).lean(),
    IncidentSchade.find(filter).sort({ created_at: -1 }).limit(200).lean(),
    IncidentEhbo.find(filter).sort({ created_at: -1 }).limit(200).lean(),
    OrderRequest.find(filter).sort({ requested_at: -1 }).limit(200).lean(),
    MaintenanceLog.find(filter).sort({ done_at: -1 }).limit(200).populate('task_id', 'description').populate('done_by', 'name').lean(),
    StockDelivery.find(filter).sort({ delivered_at: -1 }).limit(200).populate('chemical_id', 'name unit').lean(),
    siteId ? StockTransfer.find({ $or: [{ from_site_id: siteId }, { to_site_id: siteId }] }).sort({ transferred_at: -1 }).limit(200).populate('from_site_id', 'name').populate('to_site_id', 'name').lean() : Promise.resolve([]),
  ]);

  const energyBillsByMonth: Record<string, number> = {};
  for (const b of energyBillDocs) {
    energyBillsByMonth[`${b.year}-${b.month}`] = (b.amount_euro as number) ?? 0;
  }

  const programs: HistoryProgram[] = programDocs.map((p) => ({
    id: (p._id as Types.ObjectId).toString(),
    name: (p.name as string) ?? '',
    chemicals: ((p.chemicals as string[]) ?? []).map((name: string) => ({ id: name, name, unit: 'L' })),
  }));

  const entries: HistoryEntry[] = [...entryDocs].reverse().map((e) => ({
    id: (e._id as Types.ObjectId).toString(),
    weekStart: (e.week_start as Date).toISOString(),
    createdAt: e.created_at ? (e.created_at as Date).toISOString() : undefined,
    tellerstand: (e as Record<string, unknown>).tellerstand as number ?? 0,
    waterLiters: e.water_liters ?? 0,
    waterTellerstand: (e as Record<string, unknown>).water_tellerstand as number ?? 0,
    energyKw: e.energy_kw ?? 0,
    saltKg: e.salt_kg ?? 0,
    blobLiters: (e as Record<string, unknown>).blob_liters as number ?? 0,
    totalCost: (e as Record<string, unknown>).total_cost as number ?? 0,
    programCounts: (e.program_counts ?? []).map(
      (pc: { program_id?: { toString(): string }; name?: string; count?: number }) => ({
        programId: pc.program_id?.toString() ?? '',
        name: pc.name ?? '',
        count: pc.count ?? 0,
      }),
    ),
    chemicalUsages: (e.chemical_usages ?? []).map(
      (cu: { chemical_id?: { toString(): string }; name?: string; amount?: number; unit?: string }) => ({
        chemicalId: cu.chemical_id?.toString() ?? cu.name ?? '',
        name: cu.name ?? '',
        amount: cu.amount ?? 0,
        unit: cu.unit ?? 'L',
      }),
    ),
  }));

  // ── Build weekly chart data: water + elektriciteit per wassing ──
  const allProducts = [{ name: 'Water', unit: 'm³/wassing' }, { name: 'Elektriciteit', unit: '€/wassing' }];

  function weekLabel(date: Date): string {
    const d = new Date(date);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  const entryChartData: ChemieDataPoint[] = entryDocs.map((e) => {
    const row: ChemieDataPoint = { week: weekLabel(new Date(e.week_start as Date)) };
    const totalWagens = ((e.program_counts ?? []) as { count?: number }[]).reduce((s, pc) => s + (pc.count ?? 0), 0);
    if (totalWagens > 0) {
      const weekStart = new Date(e.week_start as Date);
      const billKey = `${weekStart.getUTCFullYear()}-${weekStart.getUTCMonth() + 1}`;
      const billAmount = energyBillsByMonth[billKey] ?? 0;
      row['Water'] = Math.round(((e.water_liters ?? 0) / totalWagens) * 1000) / 1000;
      row['Elektriciteit'] = Math.round((billAmount / totalWagens) * 100) / 100;
    }
    return row;
  });

  // Prepend a "Begin" baseline point with 0 for all products
  const beginRow: ChemieDataPoint = { week: 'Begin' };
  for (const p of allProducts) beginRow[p.name] = 0;
  const chartData: ChemieDataPoint[] = entryDocs.length > 0 ? [beginRow, ...entryChartData] : [];

  // ── Build monthly chart data: chemie-verbruik per product, uit voorraadtellingen ──
  const productReadingNames = [...new Set(readingDocs.map((r) => r.name as string))];
  const chemieProducts = productReadingNames.length > 0
    ? productReadingNames.map((name) => ({
        name,
        unit: (readingDocs.find((r) => r.name === name)?.unit as string) ?? 'L',
      }))
    : stockDocs.map((s) => ({ name: s.name as string, unit: (s.unit as string) ?? 'L' }));

  function monthLabel(date: Date): string {
    return date.toLocaleDateString('nl-BE', { month: 'short', year: '2-digit', timeZone: 'Europe/Brussels' });
  }

  const chemieChartData: ChemieDataPoint[] = (() => {
    const byMonth = new Map<string, ChemieDataPoint>();
    // Skip each product's very first reading — it's a baseline, not a period's consumption
    const seenFirst = new Set<string>();
    for (const r of readingDocs) {
      const name = r.name as string;
      if (!seenFirst.has(name)) { seenFirst.add(name); continue; }
      const label = monthLabel(new Date(r.recorded_at as Date));
      if (!byMonth.has(label)) byMonth.set(label, { week: label });
      byMonth.get(label)![name] = Math.max(0, r.consumption as number);
    }
    return [...byMonth.values()];
  })();

  // ── Historiek van pannes/schade/bestellingen/onderhouden ────────
  const defectHistory: DefectHistoryItem[] = defectDocs.map((d) => ({
    id: (d._id as Types.ObjectId).toString(),
    omschrijving: (d.omschrijving as string) || '',
    ernst: (d.ernst as string) || 'medium',
    isResolved: Boolean(d.is_resolved),
    reportedByName: (d.reported_by_name as string) || '',
    resolvedByName: (d.resolved_by_name as string) || '',
    createdAt: (d.created_at as Date).toISOString(),
    siteId: siteId ?? '',
    payload: {
      type: 'defect' as const,
      isResolved: Boolean(d.is_resolved),
      resolvedByName: (d.resolved_by_name as string) || '',
      reportedBy: (d.reported_by_name as string) || '',
      date: new Date(d.created_at as Date).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      omschrijving: (d.omschrijving as string) || '',
      ernst: (d.ernst as string) || 'medium',
      photos: (d.photos as string[]) ?? [],
    },
  }));

  const schadeHistory: SchadeHistoryItem[] = [
    ...schadeDocs.map((s) => ({
      id: (s._id as Types.ObjectId).toString(),
      kind: 'schade' as const,
      title: (s.merk_model as string) || 'Schade',
      subtitle: (s.omschrijving as string) || '',
      reportedByName: (s.reported_by_name as string) || '',
      createdAt: (s.created_at as Date).toISOString(),
      siteId: siteId ?? '',
      payload: {
        type: 'schade' as const,
        isResolved: Boolean(s.is_resolved),
        resolvedByName: (s.resolved_by_name as string) || '',
        reportedBy: (s.reported_by_name as string) || '',
        date: new Date(s.created_at as Date).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        typeVoertuig: (s.type_voertuig as string) || '',
        merkModel: (s.merk_model as string) || '',
        nummerplaat: (s.nummerplaat as string) || '',
        naamEigenaar: (s.naam_eigenaar as string) || '',
        telGsm: (s.tel_gsm as string) || '',
        email: (s.email as string) || '',
        omschrijving: (s.omschrijving as string) || '',
        onbetwist: Boolean(s.onbetwist),
        installatiefout: Boolean(s.installatiefout),
        klantVerantwoordelijk: Boolean(s.klant_verantwoordelijk),
        verzekeringsdocumenten: Boolean(s.verzekeringsdocumenten),
        photos: (s.photos as string[]) ?? [],
      },
    })),
    ...ehboDocs.map((e) => ({
      id: (e._id as Types.ObjectId).toString(),
      kind: 'ehbo' as const,
      title: (e.naam_slachtoffer as string) || 'EHBO',
      subtitle: (e.verwonding as string) || '',
      reportedByName: (e.reported_by_name as string) || '',
      createdAt: (e.created_at as Date).toISOString(),
      siteId: siteId ?? '',
      payload: {
        type: 'ehbo' as const,
        isResolved: Boolean(e.is_resolved),
        resolvedByName: (e.resolved_by_name as string) || '',
        reportedBy: (e.reported_by_name as string) || '',
        date: new Date(e.created_at as Date).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        uur: (e.uur as string) || '',
        naamSlachtoffer: (e.naam_slachtoffer as string) || '',
        afdelingLocatie: (e.afdeling_locatie as string) || '',
        verwonding: (e.verwonding as string) || '',
        ehboHandeling: (e.ehbo_handeling as string) || '',
        ehboVerlener: (e.ehbo_verlener as string) || '',
        beschrijving: (e.beschrijving as string) || '',
        dokterNodig: Boolean(e.dokter_nodig),
        photos: (e.photos as string[]) ?? [],
      },
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const orderHistory: OrderHistoryItem[] = orderDocs.map((o) => ({
    id: (o._id as Types.ObjectId).toString(),
    itemName: (o.item_name as string) || '',
    details: (o.details as string) || '',
    isHandled: Boolean(o.is_handled),
    requestedByName: (o.requested_by_name as string) || '',
    requestedAt: (o.requested_at as Date).toISOString(),
  }));

  // Undo only applies to the most recent completion of a task.
  const latestLogPerTask = new Map<string, string>();
  for (const l of maintenanceLogDocs) {
    const tid = ((l.task_id as unknown as { _id?: Types.ObjectId } | null)?._id)?.toString();
    if (tid && !latestLogPerTask.has(tid)) latestLogPerTask.set(tid, (l._id as Types.ObjectId).toString());
  }

  const maintenanceHistory: MaintenanceHistoryItem[] = maintenanceLogDocs.map((l) => ({
    id: (l._id as Types.ObjectId).toString(),
    taskId: ((l.task_id as unknown as { _id?: Types.ObjectId } | null)?._id)?.toString() ?? '',
    canUndo: latestLogPerTask.get(((l.task_id as unknown as { _id?: Types.ObjectId } | null)?._id)?.toString() ?? '') === (l._id as Types.ObjectId).toString(),
    description: (l.task_id as unknown as { description?: string } | null)?.description ?? '',
    notes: (l.notes as string) || '',
    doneByName: (l.done_by as unknown as { name?: string } | null)?.name ?? '',
    doneAt: (l.done_at as Date).toISOString(),
  }));

  const readerIds = [...new Set(readingDocs.map((r) => (r.recorded_by as Types.ObjectId | undefined)?.toString()).filter(Boolean))] as string[];
  const readerDocs = readerIds.length > 0 ? await User.find({ _id: { $in: readerIds } }).select('name').lean() : [];
  const readerName = new Map(readerDocs.map((u) => [(u._id as Types.ObjectId).toString(), (u.name as string) ?? '']));
  // The earliest count per product is a baseline (no consumption derivable).
  const firstReadingIds = new Set<string>();
  const seenChem = new Set<string>();
  for (const r of readingDocs) {
    const cid = (r.chemical_id as Types.ObjectId | undefined)?.toString() ?? (r.name as string);
    if (!seenChem.has(cid)) { seenChem.add(cid); firstReadingIds.add((r._id as Types.ObjectId).toString()); }
  }

  const stockLedger: StockLedgerItem[] = [
    ...deliveryDocs.map((d): StockLedgerItem => {
      const chem = d.chemical_id as unknown as { name?: string; unit?: string } | null;
      return {
        id: (d._id as Types.ObjectId).toString(),
        kind: 'delivery',
        title: chem?.name ? `Levering: ${chem.name}` : `Levering: ${(d.note as string) || 'diverse'}`,
        detail: chem?.name ? `+${((d.quantity as number) ?? 0).toLocaleString('nl-BE')} ${chem.unit ?? ''}${d.note ? ` — ${d.note}` : ''}` : '',
        quantity: chem?.name ? ((d.quantity as number) ?? 0) : undefined,
        byName: (d.logged_by_name as string) || '',
        at: (d.delivered_at as Date).toISOString(),
      };
    }),
    ...transferDocs.map((t): StockLedgerItem => {
      const from = (t.from_site_id as unknown as { _id?: Types.ObjectId; name?: string } | null);
      const to = (t.to_site_id as unknown as { _id?: Types.ObjectId; name?: string } | null);
      const outgoing = from?._id?.toString() === siteId;
      const qty = ((t.quantity as number) ?? 0).toLocaleString('nl-BE');
      return {
        id: (t._id as Types.ObjectId).toString(),
        kind: outgoing ? 'transfer-out' : 'transfer-in',
        title: outgoing ? `Verplaatst naar ${to?.name ?? '?'}: ${t.name}` : `Ontvangen van ${from?.name ?? '?'}: ${t.name}`,
        detail: `${outgoing ? '−' : '+'}${qty} ${t.unit ?? ''}`,
        byName: (t.logged_by_name as string) || '',
        at: (t.transferred_at as Date).toISOString(),
      };
    }),
    ...readingDocs.map((r): StockLedgerItem => {
      const isFirst = firstReadingIds.has((r._id as Types.ObjectId).toString());
      const q = ((r.quantity as number) ?? 0).toLocaleString('nl-BE');
      const c = Math.round(((r.consumption as number) ?? 0) * 100) / 100;
      return {
        id: (r._id as Types.ObjectId).toString(),
        kind: 'reading',
        title: `Telling: ${r.name}`,
        detail: isFirst
          ? `Voorraad ${q} ${r.unit ?? ''} (beginstand)`
          : `Voorraad ${q} ${r.unit ?? ''} · verbruik ${c.toLocaleString('nl-BE')} ${r.unit ?? ''}`,
        quantity: (r.quantity as number) ?? 0,
        byName: readerName.get((r.recorded_by as Types.ObjectId | undefined)?.toString() ?? '') ?? '',
        at: (r.recorded_at as Date).toISOString(),
      };
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const backHref = siteId ? `/wekelijkse-ingave?site=${siteId}` : '/wekelijkse-ingave';

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref={backHref} />
      <main className={styles.main}>

        {/* ── Verbruiksgrafieken ──────────────────────────────── */}
        {!isSelfcarwash && allProducts.length > 0 && (
          <div className={styles.card}>
            <div className={styles.header}>
              <h2 className={styles.title}>Verbruik per wassing — {siteName}</h2>
              <p className={styles.subtitle}>Wekelijks, water en elektriciteit per wassing</p>
            </div>
            <ChemieChart data={chartData} products={allProducts} />
          </div>
        )}

        {/* ── Chemieverbruik uit voorraadtellingen ───────────────── */}
        {!isSelfcarwash && (
          <div className={styles.card}>
            <div className={styles.header}>
              <h2 className={styles.title}>Chemieverbruik per maand — {siteName}</h2>
              <p className={styles.subtitle}>Berekend uit voorraadtellingen bij Instellingen (vorige telling + leveringen − nieuwe telling)</p>
            </div>
            <ChemieChart data={chemieChartData} products={chemieProducts} />
          </div>
        )}

        {/* ── Historiek pannes/schade/bestellingen/onderhouden ────── */}
        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.title}>Historiek — {siteName}</h2>
            <p className={styles.subtitle}>Pannes, schadegevallen/EHBO, bestellingen en onderhouden</p>
          </div>
          <EventHistoryPanel
            defects={defectHistory}
            schades={schadeHistory}
            orders={orderHistory}
            maintenance={maintenanceHistory}
            stockLedger={stockLedger}
          />
        </div>

        {/* ── Maandelijkse ingaves lijst ─────────────────────────── */}
        {!isSelfcarwash && (
          <div className={styles.card}>
            <div className={styles.header}>
              <h1 className={styles.title}>Maandelijkse Ingaves — {siteName}</h1>
            </div>
            <HistoryList entries={entries} programs={programs} startCarCount={startCarCount} startWaterCount={startWaterCount} siteId={siteId ?? ''} energyBillsByMonth={energyBillsByMonth} />
          </div>
        )}
      </main>
    </div>
  );
}
