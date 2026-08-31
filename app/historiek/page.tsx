import { cookies } from 'next/headers';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { HistoryList } from '@/components/forms/HistoryList/HistoryList';
import type { HistoryEntry, HistoryProgram } from '@/components/forms/HistoryList/HistoryList';
import { ChemieChart } from '@/components/historiek/ChemieChart/ChemieChart';
import type { ChemieDataPoint } from '@/components/historiek/ChemieChart/ChemieChart';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WashProgram, WeeklyEntry, ChemicalStock, StockReading, User, EnergyBill } from '@/lib/models';
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
    Site.find({}).select('_id name location start_car_count start_water_count').lean(),
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
  const startCarCount = (siteDoc?.start_car_count as number) ?? 0;
  const startWaterCount = (siteDoc?.start_water_count as number) ?? 0;
  const filter = siteId ? { site_id: siteId } : {};

  const [programDocs, entryDocs, stockDocs, energyBillDocs, readingDocs] = await Promise.all([
    WashProgram.find(filter).select('_id name tier chemicals').sort({ tier: 1 }).lean(),
    WeeklyEntry.find(filter).sort({ week_start: 1 }).lean(),
    ChemicalStock.find(filter).select('name unit').sort({ name: 1 }).lean(),
    EnergyBill.find(filter).select('year month amount_euro').lean(),
    StockReading.find(filter).select('name unit consumption recorded_at').sort({ recorded_at: 1 }).lean(),
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

  const backHref = siteId ? `/wekelijkse-ingave?site=${siteId}` : '/wekelijkse-ingave';

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref={backHref} />
      <main className={styles.main}>

        {/* ── Verbruiksgrafieken ──────────────────────────────── */}
        {allProducts.length > 0 && (
          <div className={styles.card}>
            <div className={styles.header}>
              <h2 className={styles.title}>Verbruik per wassing — {siteName}</h2>
              <p className={styles.subtitle}>Wekelijks, water en elektriciteit per wassing</p>
            </div>
            <ChemieChart data={chartData} products={allProducts} />
          </div>
        )}

        {/* ── Chemieverbruik uit voorraadtellingen ───────────────── */}
        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.title}>Chemieverbruik per maand — {siteName}</h2>
            <p className={styles.subtitle}>Berekend uit voorraadtellingen bij Instellingen (vorige telling + leveringen − nieuwe telling)</p>
          </div>
          <ChemieChart data={chemieChartData} products={chemieProducts} />
        </div>

        {/* ── Maandelijkse ingaves lijst ─────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Maandelijkse Ingaves — {siteName}</h1>
          </div>
          <HistoryList entries={entries} programs={programs} startCarCount={startCarCount} startWaterCount={startWaterCount} siteId={siteId ?? ''} energyBillsByMonth={energyBillsByMonth} />
        </div>
      </main>
    </div>
  );
}
