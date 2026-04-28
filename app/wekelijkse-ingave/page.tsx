import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { WeeklyEntryForm } from '@/components/forms/WeeklyEntryForm/WeeklyEntryForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WashProgram, WeeklyEntry, User, ChemicalStock } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import styles from './page.module.scss';

export default async function WekelijkseIngavePage({
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

  const [programs, lastEntries, stockDocs] = await Promise.all([
    WashProgram.find(filter).select('_id name tier chemicals').sort({ tier: 1 }).lean(),
    WeeklyEntry.find(filter).sort({ week_start: -1 }).limit(1).lean(),
    ChemicalStock.find(filter).sort({ name: 1 }).lean(),
  ]);

  const stockByName: Record<string, { current_stock: number; unit: string }> = {};
  for (const s of stockDocs) {
    stockByName[s.name as string] = {
      current_stock: (s.current_stock as number) ?? 0,
      unit: (s.unit as string) ?? '',
    };
  }

  const programsWithChemicals = programs.map((p) => ({
    id: (p._id as Types.ObjectId).toString(),
    name: (p.name as string) ?? '',
    chemicals: ((p.chemicals as string[]) ?? []).map((name: string) => ({
      id: name,
      name,
      unit: stockByName[name]?.unit ?? 'L',
      current_stock: stockByName[name]?.current_stock ?? null,
    })),
  }));

  const last = lastEntries[0] ?? null;

  const lastEntryData = last
    ? {
        waterLiters: last.water_liters,
        energyKw: last.energy_kw,
        saltKg: last.salt_kg,
        flockKg: last.flock_kg,
        clothUnits: (last as Record<string, unknown>).cloth_units as number ?? 0,
        programCounts: (last.program_counts ?? []).map(
          (pc: { program_id?: { toString(): string }; count?: number }) => ({
            programId: pc.program_id?.toString() ?? '',
            count: pc.count ?? 0,
          }),
        ),
        chemicalUsages: (last.chemical_usages ?? []).map(
          (cu: { chemical_id?: { toString(): string }; amount?: number }) => ({
            chemicalId: cu.chemical_id?.toString() ?? '',
            programId: '',
            amount: cu.amount ?? 0,
          }),
        ),
      }
    : null;

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle={siteName ? `Wekelijkse Ingave — ${siteName}` : 'Wekelijkse Ingave'} backHref="/" />
      <main className={styles.main}>
        <WeeklyEntryForm
          siteId={siteId ?? ''}
          programs={programsWithChemicals}
          lastEntry={lastEntryData}
        />
      </main>
    </div>
  );
}
