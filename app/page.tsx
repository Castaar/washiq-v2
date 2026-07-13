import Image from 'next/image';
import type { Types } from 'mongoose';
import { redirect } from 'next/navigation';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User, Announcement, PriceConfig, AttendanceLog } from '@/lib/models';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { CarwashPage } from '@/components/dashboard/CarwashPage/CarwashPage';
import { AnnouncementBanner } from '@/components/dashboard/AnnouncementBanner/AnnouncementBanner';
import { getSession } from '@/lib/session';
import styles from './page.module.scss';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; period?: string; view?: string; usage?: string; date?: string }>;
}) {
  const { site, period: periodParam, view: viewParam, usage: usageParam, date: dateParam } = await searchParams;
  const period = (periodParam === 'week' ? 'week' : 'month') as 'week' | 'month';
  const view = (viewParam === 'liter' ? 'liter' : 'prijs') as 'prijs' | 'liter';
  const usage = (usageParam === 'totaal' ? 'totaal' : 'wagen') as 'totaal' | 'wagen';
  const refDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10);
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
    (userRole === 'developer' || userRole === 'technician')
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
  const addLabel = userRole === 'developer' ? 'Developer' : userRole === 'employee' ? 'Dagfiche' : 'Maandelijkse Ingave';
  const settingsHref = (userRole === 'owner' || userRole === 'developer')
    ? (activeSiteId ? `/instellingen?site=${activeSiteId}` : '/instellingen')
    : undefined;

  // Fetch recent attendance logs for employees (shown on dashboard instead of alerts panel)
  let recentLogs: { id: string; userName: string; type: 'opening' | 'sluiting'; personType: 'employee' | 'technician_extern'; registeredByName: string; timestamp: string; note: string }[] = [];
  if ((userRole === 'employee') && activeSiteId && session?.userId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const logDocs = await AttendanceLog.find({
      site_id: activeSiteId,
      user_id: session.userId,
      timestamp: { $gte: thirtyDaysAgo },
    }).sort({ timestamp: -1 }).limit(100).lean();
    recentLogs = logDocs.map((l) => ({
      id: (l._id as Types.ObjectId).toString(),
      userName: (l.user_name as string) ?? '',
      type: l.type as 'opening' | 'sluiting',
      personType: ((l.person_type as string) ?? 'employee') as 'employee' | 'technician_extern',
      registeredByName: (l.registered_by_name as string) ?? '',
      timestamp: (l.timestamp as Date).toISOString(),
      note: (l.note as string) ?? '',
    }));
  }

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
      <NavBar sites={sites} activeSiteId={activeSiteId} activeView={view} addHref={addHref} addLabel={addLabel} settingsHref={settingsHref} />
      {announcements.length > 0 || canManage ? (
        <div className={styles.announcementsWrap}>
          <AnnouncementBanner
            siteId={activeSiteId}
            initialAnnouncements={announcements}
            canManage={canManage}
          />
        </div>
      ) : null}
      <CarwashPage siteId={activeSiteId} period={period} view={view} usage={usage} refDate={refDate} sites={sites} addHref={addHref} addLabel={addLabel} userRole={userRole} recentLogs={recentLogs} userName={session?.name ?? ''} />
    </div>
  );
}
