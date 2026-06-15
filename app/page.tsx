import Image from 'next/image';
import type { Types } from 'mongoose';
import { redirect } from 'next/navigation';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User, Announcement, PriceConfig } from '@/lib/models';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { CarwashPage } from '@/components/dashboard/CarwashPage/CarwashPage';
import { AnnouncementBanner } from '@/components/dashboard/AnnouncementBanner/AnnouncementBanner';
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
    Site.find({}).select('_id name location setup_done').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const allSites = siteDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: (s.name as string) ?? '',
    location: (s.location as string) ?? '',
    setup_done: (s.setup_done as boolean) ?? false,
  }));

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());

  const sites =
    userRole === 'developer'
      ? allSites
      : allSites.filter((s) => userSiteIds.includes(s.id));

  const activeSiteId = site && sites.find((s) => s.id === site)
    ? site
    : (sites[0]?.id ?? '');

  // Redirect owners/developers to setup wizard if active site has not been configured.
  // Also check that no PriceConfig exists yet (fallback for sites created before this feature).
  const activeSiteDoc = sites.find((s) => s.id === activeSiteId);
  if (
    activeSiteDoc &&
    !activeSiteDoc.setup_done &&
    (userRole === 'owner' || userRole === 'developer')
  ) {
    const existingPrice = await PriceConfig.findOne({ site_id: activeSiteId }).select('_id').lean();
    if (!existingPrice) {
      redirect(`/setup?site=${activeSiteId}`);
    }
  }

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

  // Fetch announcements visible for this site
  const announcementDocs = await Announcement.find({
    $or: [{ is_all_sites: true }, { site_ids: activeSiteId }],
  })
    .sort({ created_at: -1 })
    .limit(5)
    .lean();

  const announcements = announcementDocs.map((a) => ({
    id: (a._id as Types.ObjectId).toString(),
    text: a.text as string,
    created_by_name: (a.created_by_name as string) ?? '',
    is_all_sites: (a.is_all_sites as boolean) ?? true,
    created_at: (a.created_at as Date).toISOString(),
  }));

  const canManage = userRole === 'owner' || userRole === 'developer';

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar sites={sites} activeSiteId={activeSiteId} activePeriod={period} activeView={view} addHref={addHref} addLabel={addLabel} settingsHref={settingsHref} />
      {announcements.length > 0 || canManage ? (
        <div className={styles.announcementsWrap}>
          <AnnouncementBanner
            siteId={activeSiteId}
            initialAnnouncements={announcements}
            canManage={canManage}
          />
        </div>
      ) : null}
      <CarwashPage siteId={activeSiteId} period={period} view={view} usage={usage} sites={sites} addHref={addHref} addLabel={addLabel} userRole={userRole} />
    </div>
  );
}
