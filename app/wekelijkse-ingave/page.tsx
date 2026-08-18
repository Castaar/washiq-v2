import { cookies } from 'next/headers';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { WeeklyEntryForm } from '@/components/forms/WeeklyEntryForm/WeeklyEntryForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WashProgram, WeeklyEntry, User, ChemicalStock, MaintenanceTask } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function WekelijkseIngavePage({
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
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';
  const siteDoc = siteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId);
  const startCarCount = (siteDoc?.start_car_count as number) ?? 0;
  const filter = siteId ? { site_id: siteId } : {};

  const [programs, lastEntries, stockDocs, washesTasks] = await Promise.all([
    WashProgram.find(filter).select('_id name tier chemicals').sort({ tier: 1 }).lean(),
    WeeklyEntry.find(filter).sort({ week_start: -1 }).limit(1).lean(),
    ChemicalStock.find(filter).sort({ name: 1 }).lean(),
    MaintenanceTask.find({ ...filter, trigger_type: 'washes' }).lean(),
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
        tellerstand: (last as Record<string, unknown>).tellerstand as number ?? 0,
        waterLiters: last.water_liters,
        waterTellerstand: (last as Record<string, unknown>).water_tellerstand as number ?? 0,
        energyKw: last.energy_kw,
        saltKg: last.salt_kg,
        blobLiters: (last as Record<string, unknown>).blob_liters as number ?? 0,
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

  const washesTasksData = washesTasks.map((t) => ({
    id: (t._id as Types.ObjectId).toString(),
    description: (t.description as string) ?? '',
    triggerValue: (t.trigger_value as number) ?? 0,
    washesAtLastDone: (t.washes_at_last_done as number) ?? 0,
  }));

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref="/" />
      <main className={styles.main}>
        <WeeklyEntryForm
          siteId={siteId ?? ''}
          programs={programsWithChemicals}
          lastEntry={lastEntryData}
          washesTasks={washesTasksData}
          startCarCount={startCarCount}
        />
      </main>
    </div>
  );
}
