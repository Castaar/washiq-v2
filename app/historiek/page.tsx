import { cookies } from 'next/headers';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { HistoryList } from '@/components/forms/HistoryList/HistoryList';
import type { HistoryEntry, HistoryProgram } from '@/components/forms/HistoryList/HistoryList';
import { ChemieChart } from '@/components/historiek/ChemieChart/ChemieChart';
import type { ChemieDataPoint } from '@/components/historiek/ChemieChart/ChemieChart';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WashProgram, WeeklyEntry, ChemicalStock, User, EnergyBill } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import { filterSitesForUser, resolveActiveSite } from '@/lib/getUserSites';
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
    Site.find({}).select('_id name location start_car_count').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite) || null;
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';
  const siteDoc = siteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId);
  const startCarCount = (siteDoc?.start_car_count as number) ?? 0;
  const filter = siteId ? { site_id: siteId } : {};

  const [programDocs, entryDocs, stockDocs, energyBillDocs] = await Promise.all([
    WashProgram.find(filter).select('_id name tier chemicals').sort({ tier: 1 }).lean(),
    WeeklyEntry.find(filter).sort({ week_start: 1 }).lean(),
    ChemicalStock.find(filter).select('name unit').sort({ name: 1 }).lean(),
    EnergyBill.find(filter).select('year month amount_euro').lean(),
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

  // ── Build chart data: one row per week, columns per product ──
  const chartProducts = stockDocs.map((s) => ({ name: s.name as string, unit: (s.unit as string) ?? 'L' }));

  // Collect all unique product names from entries too (in case products were renamed/deleted)
  const allProductNames = new Set<string>(chartProducts.map((p) => p.name));
  for (const e of entryDocs) {
    for (const cu of (e.chemical_usages ?? []) as { name?: string }[]) {
      if (cu.name) allProductNames.add(cu.name);
    }
  }
  const allProducts = Array.from(allProductNames).map((name) => {
    const found = chartProducts.find((p) => p.name === name);
    return found ?? { name, unit: 'L' };
  });

  function weekLabel(date: Date): string {
    const d = new Date(date);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  const entryChartData: ChemieDataPoint[] = entryDocs.map((e) => {
    const row: ChemieDataPoint = { week: weekLabel(new Date(e.week_start as Date)) };
    for (const cu of (e.chemical_usages ?? []) as { name?: string; amount?: number }[]) {
      if (cu.name) row[cu.name] = cu.amount ?? 0;
    }
    return row;
  });

  // Prepend a "Begin" baseline point with 0 for all products
  const beginRow: ChemieDataPoint = { week: 'Begin' };
  for (const p of allProducts) beginRow[p.name] = 0;
  const chartData: ChemieDataPoint[] = entryDocs.length > 0 ? [beginRow, ...entryChartData] : [];

  const backHref = siteId ? `/wekelijkse-ingave?site=${siteId}` : '/wekelijkse-ingave';

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref={backHref} />
      <main className={styles.main}>

        {/* ── Verbruiksgrafieken ──────────────────────────────── */}
        {allProducts.length > 0 && (
          <div className={styles.card}>
            <div className={styles.header}>
              <h2 className={styles.title}>Verbruik chemie — {siteName}</h2>
              <p className={styles.subtitle}>Wekelijks verbruik per product (in eenheid)</p>
            </div>
            <ChemieChart data={chartData} products={allProducts} />
          </div>
        )}

        {/* ── Maandelijkse ingaves lijst ─────────────────────────── */}
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Maandelijkse Ingaves — {siteName}</h1>
          </div>
          <HistoryList entries={entries} programs={programs} startCarCount={startCarCount} siteId={siteId ?? ''} energyBillsByMonth={energyBillsByMonth} />
        </div>
      </main>
    </div>
  );
}
