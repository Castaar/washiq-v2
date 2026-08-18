import { cookies } from 'next/headers';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { LogboekPanel } from '@/components/logboek/LogboekPanel/LogboekPanel';
import type { LogEntry } from '@/components/logboek/LogboekPanel/LogboekPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, AttendanceLog, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function LogboekPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  const session = await getSession();
  await dbConnect();

  const cookieStore = await cookies();
  const cookieSite = cookieStore.get('dodane_active_site')?.value;

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location').lean(),
    session ? User.findById(session.userId).select('site_ids role name').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite);
  await redirectIfSetupNeeded(siteId ?? '', userRole);

  const isOwner = userRole === 'owner' || userRole === 'developer';

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const filter: Record<string, unknown> = { site_id: siteId, timestamp: { $gte: thirtyDaysAgo } };
  if (!isOwner) {
    filter.user_id = session?.userId;
  }

  const logDocs = await AttendanceLog.find(filter).sort({ timestamp: -1 }).limit(200).lean();

  const recentLogs: LogEntry[] = logDocs.map((l) => ({
    id: (l._id as Types.ObjectId).toString(),
    userName: (l.user_name as string) ?? '',
    type: l.type as 'opening' | 'sluiting',
    personType: (l.person_type as 'employee' | 'technician_extern') ?? 'employee',
    registeredByName: (l.registered_by_name as string) ?? '',
    timestamp: (l.timestamp as Date).toISOString(),
    note: (l.note as string) ?? '',
  }));

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId} backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
          <LogboekPanel
            siteId={siteId}
            userRole={userRole}
            userName={(userDoc?.name as string) ?? session?.name ?? ''}
            recentLogs={recentLogs}
          />
        </div>
      </main>
    </div>
  );
}
