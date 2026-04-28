import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { HistoryList } from '@/components/forms/HistoryList/HistoryList';
import type { HistoryEntry, HistoryProgram } from '@/components/forms/HistoryList/HistoryList';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WashProgram, WeeklyEntry, User } from '@/lib/models';
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

  const [programDocs, entryDocs] = await Promise.all([
    WashProgram.find(filter).select('_id name tier chemicals').sort({ tier: 1 }).lean(),
    WeeklyEntry.find(filter).sort({ week_start: -1 }).lean(),
  ]);

  const programs: HistoryProgram[] = programDocs.map((p) => ({
    id: (p._id as Types.ObjectId).toString(),
    name: (p.name as string) ?? '',
    chemicals: ((p.chemicals as string[]) ?? []).map((name: string) => ({ id: name, name, unit: 'L' })),
  }));

  const entries: HistoryEntry[] = entryDocs.map((e) => ({
    id: (e._id as Types.ObjectId).toString(),
    weekStart: (e.week_start as Date).toISOString(),
    waterLiters: e.water_liters ?? 0,
    energyKw: e.energy_kw ?? 0,
    saltKg: e.salt_kg ?? 0,
    flockKg: e.flock_kg ?? 0,
    clothUnits: (e as Record<string, unknown>).cloth_units as number ?? 0,
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

  const backHref = siteId ? `/wekelijkse-ingave?site=${siteId}` : '/wekelijkse-ingave';

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle="Historiek" backHref={backHref} />
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Wekelijkse Ingaves — {siteName}</h1>
          </div>
          <HistoryList entries={entries} programs={programs} />
        </div>
      </main>
    </div>
  );
}
