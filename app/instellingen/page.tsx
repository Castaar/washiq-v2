import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { InstellingenForm } from '@/components/forms/InstellingenForm/InstellingenForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, PriceConfig, ChemicalStock, EnergyBill, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import styles from './page.module.scss';

export default async function InstellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  await dbConnect();

  const session = await getSession();
  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name start_car_count').lean(),
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
  const siteDoc = allowedSiteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId);
  const siteName = (siteDoc?.name as string) ?? '';
  const startCarCount = (siteDoc?.start_car_count as number) ?? 0;
  const filter = siteId ? { site_id: siteId } : {};

  const [priceConfigDoc, stockDocs, energyBillDocs] = await Promise.all([
    PriceConfig.findOne(filter).sort({ valid_from: -1 }).lean(),
    ChemicalStock.find(filter).sort({ name: 1 }).lean(),
    EnergyBill.find(filter).sort({ year: -1, month: -1 }).limit(12).lean(),
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

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar
        centerTitle={siteName ? `Instellingen — ${siteName}` : 'Instellingen'}
        backHref="/"
      />
      <main className={styles.main}>
        <InstellingenForm
          siteId={siteId ?? ''}
          priceConfig={priceConfig}
          stocks={stocks}
          energyBills={energyBills}
          startCarCount={startCarCount}
        />
      </main>
    </div>
  );
}
