import Image from 'next/image';
import { cookies } from 'next/headers';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { DagficheForm } from '@/components/forms/DagficheForm/DagficheForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WeeklyEntry, MaintenanceTask, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import { computeIsOverdue } from '@/lib/maintenance';
import { filterSitesForUser, resolveActiveSite } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function DagfichePage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const session = await getSession();
  const { site } = await searchParams;

  await dbConnect();

  const cookieStore = await cookies();
  const cookieSite = cookieStore.get('dodane_active_site')?.value;

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite);

  const siteDoc = allowedSites.find((s) => s.id === siteId);
  const siteName = siteDoc?.name ?? 'Carwash';

  const [lastEntry, allTaskDocs] = await Promise.all([
    WeeklyEntry.findOne({ site_id: siteId }).sort({ week_start: -1 }).select('program_counts').lean(),
    MaintenanceTask.find({ site_id: siteId })
      .select('_id description trigger_type trigger_value trigger_day trigger_month trigger_month_list last_done_at is_overdue')
      .lean(),
  ]);

  const totalWagens = (lastEntry?.program_counts ?? []).reduce(
    (sum: number, p: { count?: number }) => sum + (p.count ?? 0),
    0,
  );

  const now = new Date();
  const maintenanceTasks = allTaskDocs
    .filter((t) => computeIsOverdue(t, now))
    .map((t) => ({
      id: (t._id as Types.ObjectId).toString(),
      description: t.description as string,
    }));

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar sites={allowedSites} activeSiteId={siteId} backHref="/" />
      <main className={styles.main}>
        <DagficheForm
          siteId={siteId}
          siteName={siteName}
          userName={session?.name ?? ''}
          totalWagens={totalWagens}
          maintenanceTasks={maintenanceTasks}
        />
      </main>
    </div>
  );
}
