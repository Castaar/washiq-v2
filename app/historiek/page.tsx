import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { HistoryList } from '@/components/forms/HistoryList/HistoryList';
import type { HistoryEntry, HistoryProgram } from '@/components/forms/HistoryList/HistoryList';
import { ChemieChart } from '@/components/historiek/ChemieChart/ChemieChart';
import type { ChemieDataPoint } from '@/components/historiek/ChemieChart/ChemieChart';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WashProgram, WeeklyEntry, ChemicalStock, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import styles from './page.module.scss';

export default async function HistoriekPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  await dbConnect();

  const session = await getSession();
  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSiteDocs = userRole === 'developer'
    ? siteDocs
    : siteDocs.filter((s) => userSiteIds.includes((s._id as Types.ObjectId).toString()));

  const siteId = (site && allowedSiteDocs.find((s) => (s._id as Types.ObjectId).toString() === site))
    ? site
    : ((allowedSiteDocs[0]?._id as Types.ObjectId)?.toString() ?? null);
  const siteName = allowedSiteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId)?.name as string ?? '';
  const filter = siteId ? { site_id: siteId } : {};

  const [programDocs, entryDocs, stockDocs] = await Promise.all([
    WashProgram.find(filter).select('_id name tier chemicals').sort({ tier: 1 }).lean(),
    WeeklyEntry.find(filter).sort({ week_start: 1 }).lean(),
    ChemicalStock.find(filter).select('name unit').sort({ name: 1 }).lean(),
  ]);

  const programs: HistoryProgram[] = programDocs.map((p) => ({
    id: (p._id as Types.ObjectId).toString(),
    name: (p.name as string) ?? '',
    chemicals: ((p.chemicals as string[]) ?? []).map((name: string) => ({ id: name, name, unit: 'L' })),
  }));

  const entries: HistoryEntry[] = [...entryDocs].reverse().map((e) => ({
    id: (e._id as Types.ObjectId).toString(),
    weekStart: (e.week_start as Date).toISOString(),
    waterLiters: e.water_liters ?? 0,
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
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `W${String(weekNo).padStart(2, '0')}`;
  }

  const chartData: ChemieDataPoint[] = entryDocs.map((e) => {
    const row: ChemieDataPoint = { week: weekLabel(new Date(e.week_start as Date)) };
    for (const cu of (e.chemical_usages ?? []) as { name?: string; amount?: number }[]) {
      if (cu.name) row[cu.name] = cu.amount ?? 0;
    }
    return row;
  });

  const backHref = siteId ? `/wekelijkse-ingave?site=${siteId}` : '/wekelijkse-ingave';

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle="Historiek" backHref={backHref} />
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
          <HistoryList entries={entries} programs={programs} />
        </div>
      </main>
    </div>
  );
}
