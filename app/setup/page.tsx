import Image from 'next/image';
import type { Types } from 'mongoose';
import { redirect } from 'next/navigation';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, PriceConfig, MaintenanceTask } from '@/lib/models';
import { getSession } from '@/lib/session';
import { SetupWizard } from '@/components/setup/SetupWizard/SetupWizard';
import styles from './page.module.scss';

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role === 'employee') redirect('/');

  const { site } = await searchParams;
  await dbConnect();

  const siteDocs = await Site.find({}).select('_id name setup_done').lean();
  const siteId = site && siteDocs.find((s) => (s._id as Types.ObjectId).toString() === site)
    ? site
    : (siteDocs[0]?._id as Types.ObjectId)?.toString() ?? '';

  const siteDoc = siteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId);
  const siteName = (siteDoc?.name as string) ?? '';

  const sites = siteDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: (s.name as string) ?? '',
    setup_done: (s.setup_done as boolean) ?? false,
  }));

  const [existingPrice, existingTasks] = await Promise.all([
    PriceConfig.findOne({ site_id: siteId }).select('-__v').lean(),
    MaintenanceTask.find({ site_id: siteId }).select('description trigger_type trigger_value trigger_day trigger_month trigger_month_list last_done_at washes_at_last_done').lean(),
  ]);

  const initialPrices = existingPrice
    ? {
        water_per_liter: existingPrice.water_per_liter ?? 0,
        energy_per_kw: existingPrice.energy_per_kw ?? 0,
        salt_per_kg: existingPrice.salt_per_kg ?? 0,
        flock_per_kg: existingPrice.flock_per_kg ?? 0,
        cloth_per_unit: existingPrice.cloth_per_unit ?? 0,
      }
    : { water_per_liter: 0, energy_per_kw: 0, salt_per_kg: 0, flock_per_kg: 0, cloth_per_unit: 0 };

  const initialTasks = existingTasks.map((t) => ({
    description: t.description as string,
    trigger_type: t.trigger_type as 'washes' | 'months' | 'fixed_date',
    trigger_value: t.trigger_value as number,
    last_done_at: t.last_done_at ? (t.last_done_at as Date).toISOString().slice(0, 10) : '',
    washes_at_last_done: t.washes_at_last_done as number,
  }));

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <main className={styles.main}>
        <SetupWizard
          siteId={siteId}
          siteName={siteName}
          sites={sites}
          initialPrices={initialPrices}
          initialTasks={initialTasks}
        />
      </main>
    </div>
  );
}
