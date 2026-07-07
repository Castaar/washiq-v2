import Image from 'next/image';
import { cookies } from 'next/headers';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { InstellingenForm } from '@/components/forms/InstellingenForm/InstellingenForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, PriceConfig, ChemicalStock, EnergyBill, User, MaintenanceTask, WeeklyEntry, WashProgram } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import { filterSitesForUser, resolveActiveSite } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function InstellingenPage({
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

  const siteDoc = siteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId);
  const siteName = (siteDoc?.name as string) ?? '';
  const startCarCount = (siteDoc?.start_car_count as number) ?? 0;
  const filter = siteId ? { site_id: siteId } : {};

  const [priceConfigDoc, stockDocs, energyBillDocs, taskDocs, weeklyEntries, programDocs] = await Promise.all([
    PriceConfig.findOne(filter).sort({ valid_from: -1 }).lean(),
    ChemicalStock.find(filter).sort({ name: 1 }).lean(),
    EnergyBill.find(filter).sort({ year: -1, month: -1 }).limit(12).lean(),
    MaintenanceTask.find(filter).sort({ description: 1 }).lean(),
    WeeklyEntry.find(filter).select('program_counts').lean(),
    WashProgram.find(filter).sort({ tier: 1 }).lean(),
  ]);

  const priceConfig = priceConfigDoc
    ? {
        id: (priceConfigDoc._id as Types.ObjectId).toString(),
        water_per_liter: priceConfigDoc.water_per_liter ?? 0,
        salt_per_kg: priceConfigDoc.salt_per_kg ?? 0,
        flock_per_kg: priceConfigDoc.flock_per_kg ?? 0,
        cloth_per_unit: (priceConfigDoc.cloth_per_unit as number) ?? 0,
        chemicals: ((priceConfigDoc.chemicals as { name: string; price_per_unit: number }[]) ?? []).map(
          (c) => ({ name: c.name as string, price_per_unit: (c.price_per_unit as number) ?? 0 }),
        ),
      }
    : null;

  const stocks = stockDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: s.name as string,
    current_stock: (s.current_stock as number) ?? 0,
    min_stock_alert: (s.min_stock_alert as number) ?? 0,
    unit: (s.unit as string) ?? '',
  }));

  const energyBills = energyBillDocs.map((b) => ({
    id: (b._id as Types.ObjectId).toString(),
    year: b.year as number,
    month: b.month as number,
    amount_euro: b.amount_euro as number,
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

  const currentTotalWashes = (weeklyEntries as { program_counts?: { count: number }[] }[]).reduce(
    (sum, e) => sum + (e.program_counts ?? []).reduce((s, p) => s + (p.count ?? 0), 0),
    0,
  );

  const programs = programDocs.map((p) => ({
    id: (p._id as Types.ObjectId).toString(),
    siteId: (p.site_id as Types.ObjectId).toString(),
    name: (p.name as string) ?? '',
    tier: (p.tier as number) ?? 0,
    chemicals: (p.chemicals as string[]) ?? [],
  }));

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref="/" />
      <main className={styles.main}>
        <InstellingenForm
          siteId={siteId ?? ''}
          siteName={siteName}
          priceConfig={priceConfig}
          stocks={stocks}
          energyBills={energyBills}
          startCarCount={startCarCount}
          maintenanceTasks={maintenanceTasks}
          currentTotalWashes={currentTotalWashes}
          programs={programs}
          allowedSites={allowedSites}
        />
      </main>
    </div>
  );
}
