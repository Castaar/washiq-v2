import { cookies } from 'next/headers';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { OpdrachtenPanel } from '@/components/opdrachten/OpdrachtenPanel/OpdrachtenPanel';
import type { OpdrachtItem, SiteEmployee } from '@/components/opdrachten/OpdrachtenPanel/OpdrachtenPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, Opdracht, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded, redirectWithSiteParam } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function OpdrachtenPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; date?: string }>;
}) {
  const { site, date: dateParam } = await searchParams;
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
  redirectWithSiteParam('/opdrachten', { site, date: dateParam }, siteId ?? '');
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';

  const today = new Date().toISOString().slice(0, 10);
  const activeDate = dateParam ?? today;

  // Fetch opdrachten for next 7 days + past 3 days
  const from = new Date(today);
  from.setDate(from.getDate() - 3);
  const to = new Date(today);
  to.setDate(to.getDate() + 8);

  const isOwner = userRole === 'owner' || userRole === 'developer';

  const [opdrachtenDocs, employeeDocs] = await Promise.all([
    Opdracht.find({
      site_id: siteId,
      date: { $gte: from, $lt: to },
      ...(!isOwner && session?.userId ? {
        $or: [
          { assigned_to_ids: { $size: 0 } },
          { assigned_to_ids: session.userId },
        ],
      } : {}),
    }).sort({ date: 1, created_at: 1 }).lean(),
    isOwner
      ? User.find({ site_ids: siteId, role: { $in: ['employee', 'technician'] } }).select('_id name role').lean()
      : Promise.resolve([]),
  ]);

  const opdrachten: OpdrachtItem[] = opdrachtenDocs.map((d) => ({
    id: (d._id as Types.ObjectId).toString(),
    date: (d.date as Date).toISOString().slice(0, 10),
    text: d.text as string,
    createdByName: (d.created_by_name as string) ?? '',
    assignedToIds: ((d.assigned_to_ids as Types.ObjectId[]) ?? []).map((id) => id.toString()),
    isDone: (d.is_done as boolean) ?? false,
    doneByName: (d.done_by_name as string) ?? '',
    doneAt: d.done_at ? (d.done_at as Date).toISOString() : null,
  }));

  const employees: SiteEmployee[] = (employeeDocs as { _id: Types.ObjectId; name: string; role?: string }[]).map((u) => ({
    id: u._id.toString(),
    name: u.name,
    role: u.role,
  }));

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>Opdrachten — {siteName}</h1>
          </div>
          <OpdrachtenPanel
            siteId={siteId}
            userRole={userRole}
            opdrachten={opdrachten}
            employees={employees}
            activeDate={activeDate}
          />
        </div>
      </main>
    </div>
  );
}
