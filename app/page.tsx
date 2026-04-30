import Image from 'next/image';
import type { Types } from 'mongoose';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User } from '@/lib/models';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { CarwashPage } from '@/components/dashboard/CarwashPage/CarwashPage';
import { getSession } from '@/lib/session';
import styles from './page.module.scss';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; period?: string; view?: string; usage?: string }>;
}) {
  const { site, period: periodParam, view: viewParam, usage: usageParam } = await searchParams;
  const period = (periodParam === 'month' ? 'month' : 'week') as 'week' | 'month';
  const view = (viewParam === 'liter' ? 'liter' : 'prijs') as 'prijs' | 'liter';
  const usage = (usageParam === 'wagen' ? 'wagen' : 'totaal') as 'totaal' | 'wagen';
  const session = await getSession();

  await dbConnect();

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const allSites = siteDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: (s.name as string) ?? '',
    location: (s.location as string) ?? '',
  }));

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());

  // Only developers see all sites; owners and employees only see their assigned sites
  const sites =
    userRole === 'developer'
      ? allSites
      : allSites.filter((s) => userSiteIds.includes(s.id));

  const activeSiteId = site && sites.find((s) => s.id === site)
    ? site
    : (sites[0]?.id ?? '');

  const addBase = userRole === 'developer'
    ? '/developer'
    : userRole === 'employee'
    ? '/dagfiche'
    : '/wekelijkse-ingave';
  const addHref = userRole === 'developer' ? '/developer' : (activeSiteId ? `${addBase}?site=${activeSiteId}` : addBase);
  const addLabel = userRole === 'developer' ? 'Developer' : userRole === 'employee' ? 'Dagfiche' : 'Wekelijkse Ingave';
  const settingsHref = (userRole === 'owner' || userRole === 'developer')
    ? (activeSiteId ? `/instellingen?site=${activeSiteId}` : '/instellingen')
    : undefined;

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar sites={sites} activeSiteId={activeSiteId} activePeriod={period} activeView={view} addHref={addHref} addLabel={addLabel} settingsHref={settingsHref} />
      <CarwashPage siteId={activeSiteId} period={period} view={view} usage={usage} sites={sites} addHref={addHref} addLabel={addLabel} userRole={userRole} />
    </div>
  );
}
