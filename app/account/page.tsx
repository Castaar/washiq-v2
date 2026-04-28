import Image from 'next/image';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { AccountForm } from '@/components/account/AccountForm/AccountForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, PriceConfig, User, WashProgram, ChemicalStock, MaintenanceTask, WeeklyEntry } from '@/lib/models';
import { getSession } from '@/lib/session';
import styles from './page.module.scss';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  await dbConnect();

  const session = await getSession();
  const sessionRole = session?.role ?? 'employee';

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const allSites = siteDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: (s.name as string) ?? '',
    location: (s.location as string) ?? '',
  }));

  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const sites =
    sessionRole === 'developer'
      ? allSites
      : allSites.filter((s) => userSiteIds.includes(s.id));

  const { site } = await searchParams;
  const siteId = (site && sites.find((s) => s.id === site))
    ? site
    : (sites[0]?.id ?? '');

  const addHref = sessionRole === 'employee' ? '/dagfiche' : '/wekelijkse-ingave';

  const [priceConfigDoc, userDocs, currentUserDoc, programDocs, stockDocs, taskDocs, weeklyEntries] = await Promise.all([
    PriceConfig.findOne({ site_id: siteId }).lean(),
    User.find({ site_ids: siteId }).select('_id name email role').lean(),
    session ? User.findById(session.userId).select('_id name email').lean() : Promise.resolve(null),
    WashProgram.find({ site_id: siteId }).select('chemicals').lean(),
    ChemicalStock.find({ site_id: siteId }).sort({ name: 1 }).lean(),
    MaintenanceTask.find({ site_id: siteId }).sort({ description: 1 }).lean(),
    WeeklyEntry.find({ site_id: siteId }).select('program_counts').lean(),
  ]);

  // Collect unique chemical names from all programs for this site
  const chemieLabels = [...new Set(
    (programDocs as { chemicals?: string[] }[]).flatMap((p) => p.chemicals ?? [])
  )];

  // Total wash count for this site (sum of all program_counts across all weekly entries)
  const currentTotalWashes = (weeklyEntries as { program_counts?: { count: number }[] }[]).reduce(
    (sum, e) => sum + (e.program_counts ?? []).reduce((s, p) => s + (p.count ?? 0), 0),
    0,
  );

  type ChemEntry = { name: string; price_per_unit: number };

  const priceConfig = priceConfigDoc
    ? {
        id: (priceConfigDoc._id as Types.ObjectId).toString(),
        energyPerKw: priceConfigDoc.energy_per_kw ?? 0,
        waterPerLiter: priceConfigDoc.water_per_liter ?? 0,
        saltPerKg: priceConfigDoc.salt_per_kg ?? 0,
        flockPerKg: priceConfigDoc.flock_per_kg ?? 0,
        clothPerUnit: (priceConfigDoc as Record<string, unknown>).cloth_per_unit as number ?? 0,
        chemicalPrices: (priceConfigDoc.chemicals as ChemEntry[] ?? []).map((c) => ({
          name: c.name,
          price: c.price_per_unit,
        })),
      }
    : null;

  const users = userDocs.map((u) => ({
    id: (u._id as Types.ObjectId).toString(),
    name: (u.name as string) ?? '',
  }));

  const currentUser = currentUserDoc
    ? {
        id: (currentUserDoc._id as Types.ObjectId).toString(),
        name: (currentUserDoc.name as string) ?? '',
        email: (currentUserDoc.email as string) ?? '',
      }
    : null;

  const stockItems = stockDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: (s.name as string) ?? '',
    current_stock: (s.current_stock as number) ?? 0,
    min_stock_alert: (s.min_stock_alert as number) ?? 0,
    unit: (s.unit as string) ?? '',
  }));

  const maintenanceTasks = taskDocs.map((t) => ({
    id: (t._id as Types.ObjectId).toString(),
    description: (t.description as string) ?? '',
    trigger_type: (t.trigger_type as string) as 'washes' | 'months' | 'fixed_date' | 'fixed_months',
    trigger_value: (t.trigger_value as number) ?? 0,
    trigger_day: (t.trigger_day as number) ?? 0,
    trigger_month: (t.trigger_month as number) ?? 0,
    trigger_month_list: (t.trigger_month_list as number[]) ?? [],
    last_done_at: t.last_done_at ? (t.last_done_at as Date).toISOString() : null,
    washes_at_last_done: (t.washes_at_last_done as number) ?? 0,
  }));

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle={sites.find((s) => s.id === siteId)?.name ? `Account — ${sites.find((s) => s.id === siteId)!.name}` : 'Account'} sites={sites} activeSiteId={siteId} backHref="/" addHref={addHref} addLabel={addHref === '/dagfiche' ? 'Dagfiche' : 'Wekelijkse Ingave'} />
      <main className={styles.main}>
        <AccountForm
          priceConfig={priceConfig}
          users={users}
          siteId={siteId}
          currentUser={currentUser}
          role={sessionRole}
          chemieLabels={chemieLabels}
          stockItems={stockItems}
          maintenanceTasks={maintenanceTasks}
          currentTotalWashes={currentTotalWashes}
        />
      </main>
    </div>
  );
}
