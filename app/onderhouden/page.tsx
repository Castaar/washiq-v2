import { cookies } from 'next/headers';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { OnderhoudPanel } from '@/components/onderhouden/OnderhoudPanel/OnderhoudPanel';
import type { OnderhoudTask } from '@/components/onderhouden/OnderhoudPanel/OnderhoudPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User, MaintenanceTask, WeeklyEntry } from '@/lib/models';
import { getSession } from '@/lib/session';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded, redirectWithSiteParam } from '@/lib/getUserSites';
import { computeIsOverdue, computeIsApproaching, washesRemaining } from '@/lib/maintenance';
import styles from './page.module.scss';

export default async function OnderhoudPage({
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
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  redirectWithSiteParam('/onderhouden', { site }, siteId ?? '');
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';

  const siteDoc = siteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId);
  const startCarCount = (siteDoc as Record<string, unknown>)?.start_car_count as number ?? 0;

  const [taskDocs, latestEntry] = siteId
    ? await Promise.all([
        MaintenanceTask.find({ site_id: siteId }).lean(),
        WeeklyEntry.findOne({ site_id: siteId }).sort({ week_start: -1 }).select('tellerstand').lean(),
      ])
    : [[], null];

  const currentTellerstand = (latestEntry as Record<string, unknown> | null)?.tellerstand as number ?? startCarCount;
  const now = new Date();

  const tasks: OnderhoudTask[] = taskDocs.map((t) => {
    const overdue = computeIsOverdue(t, now, currentTellerstand > 0 ? currentTellerstand : undefined);
    const approaching = !overdue && computeIsApproaching(t, currentTellerstand);
    const remaining = currentTellerstand > 0 ? washesRemaining(t, currentTellerstand) : null;
    return {
      id: (t._id as Types.ObjectId).toString(),
      description: t.description as string,
      triggerType: t.trigger_type as OnderhoudTask['triggerType'],
      triggerValue: t.trigger_value as number ?? 0,
      lastDoneAt: t.last_done_at ? new Date(t.last_done_at as Date).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : undefined,
      washesAtLastDone: t.washes_at_last_done as number ?? 0,
      isOverdue: overdue,
      isApproaching: approaching,
      washesRemaining: remaining,
    };
  }).sort((a, b) => (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0) || (b.isApproaching ? 1 : 0) - (a.isApproaching ? 1 : 0));

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>Onderhoud — {siteName}</h1>
          </div>
          <OnderhoudPanel tasks={tasks} />
        </div>
      </main>
    </div>
  );
}
