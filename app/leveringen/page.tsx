import { cookies } from 'next/headers';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { LeveringenPanel } from '@/components/leveringen/LeveringenPanel/LeveringenPanel';
import type { StockItem } from '@/components/leveringen/LeveringenPanel/LeveringenPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, ChemicalStock, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function LeveringenPage({
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
    Site.find({}).select('_id name location').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite) || null;
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';

  const stockDocs = siteId
    ? await ChemicalStock.find({ site_id: siteId }).sort({ name: 1 }).lean()
    : [];

  const stocks: StockItem[] = stockDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: s.name as string,
    current_stock: (s.current_stock as number) ?? 0,
    min_stock_alert: (s.min_stock_alert as number) ?? 0,
    unit: (s.unit as string) ?? '',
  }));

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref="/" />
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Leveringen — {siteName}</h1>
            <p className={styles.subtitle}>Registreer een levering om de voorraad bij te werken.</p>
          </div>
          <LeveringenPanel stocks={stocks} />
        </div>
      </main>
    </div>
  );
}
