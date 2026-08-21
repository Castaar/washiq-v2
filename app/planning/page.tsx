import { cookies } from 'next/headers';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { PlanningPanel } from '@/components/planning/PlanningPanel/PlanningPanel';
import type { Shift, PlanningEmployee } from '@/components/planning/PlanningPanel/PlanningPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, Planning, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded, redirectWithSiteParam } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function PlanningPage({
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
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite);
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  redirectWithSiteParam('/planning', { site }, siteId ?? '');

  const isOwner = userRole === 'owner' || userRole === 'developer';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

  const from = new Date(today);
  from.setDate(from.getDate() - 7);

  const [shiftDocs, employeeDocs] = await Promise.all([
    // Scoped to the currently active carwash only — matches the site
    // selector in the top bar, same as every other page.
    Planning.find({
      site_id: siteId,
      date: { $gte: from, $lte: twoWeeksLater },
      ...(!isOwner && session?.userId ? { user_id: session.userId } : {}),
    }).sort({ date: 1, start_time: 1 }).lean(),
    // Any employee account can be scheduled at any carwash, not just the
    // sites they're currently assigned to — so fetch every employee.
    isOwner
      ? User.find({ role: 'employee' }).select('_id name site_ids').lean()
      : Promise.resolve([]),
  ]);

  const shifts: Shift[] = shiftDocs.map((d) => ({
    id: (d._id as Types.ObjectId).toString(),
    userId: (d.user_id as Types.ObjectId).toString(),
    userName: (d.user_name as string) ?? '',
    date: (d.date as Date).toISOString().slice(0, 10),
    startTime: (d.start_time as string) ?? '',
    endTime: (d.end_time as string) ?? '',
    note: (d.note as string) ?? '',
  }));

  const employees: PlanningEmployee[] = (employeeDocs as { _id: Types.ObjectId; name: string; site_ids: Types.ObjectId[] }[]).map((u) => ({
    id: u._id.toString(),
    name: u.name,
    siteIds: (u.site_ids ?? []).map((sid) => sid.toString()),
  }));

  const weekStart = today.toISOString().slice(0, 10);

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId} backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
          <PlanningPanel
            siteId={siteId}
            userRole={userRole}
            currentUserId={session?.userId ?? ''}
            shifts={shifts}
            employees={employees}
            weekStart={weekStart}
            allowedSites={allowedSites}
          />
        </div>
      </main>
    </div>
  );
}
