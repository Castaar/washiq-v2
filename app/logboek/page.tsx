import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { LogboekPanel } from '@/components/logboek/LogboekPanel/LogboekPanel';
import type { LogEntry } from '@/components/logboek/LogboekPanel/LogboekPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, AttendanceLog, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import styles from './page.module.scss';

export default async function LogboekPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  const session = await getSession();
  await dbConnect();

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name').lean(),
    session ? User.findById(session.userId).select('site_ids role name').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSiteDocs = userRole === 'developer'
    ? siteDocs
    : siteDocs.filter((s) => userSiteIds.includes((s._id as Types.ObjectId).toString()));

  const siteId = (site && allowedSiteDocs.find((s) => (s._id as Types.ObjectId).toString() === site))
    ? site
    : ((allowedSiteDocs[0]?._id as Types.ObjectId)?.toString() ?? '');
  const siteName = allowedSiteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId)?.name as string ?? '';

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
    timestamp: (l.timestamp as Date).toISOString(),
    note: (l.note as string) ?? '',
  }));

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle={`Logboek — ${siteName}`} backHref="/" />
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
