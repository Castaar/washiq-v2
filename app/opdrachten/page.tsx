import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { OpdrachtenPanel } from '@/components/opdrachten/OpdrachtenPanel/OpdrachtenPanel';
import type { OpdrachtItem, SiteEmployee } from '@/components/opdrachten/OpdrachtenPanel/OpdrachtenPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, Opdracht, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import styles from './page.module.scss';

export default async function OpdrachtenPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; date?: string }>;
}) {
  const { site, date: dateParam } = await searchParams;
  const session = await getSession();
  await dbConnect();

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSiteDocs = (userRole === 'developer' || userRole === 'technician')
    ? siteDocs
    : siteDocs.filter((s) => userSiteIds.includes((s._id as Types.ObjectId).toString()));

  const siteId = (site && allowedSiteDocs.find((s) => (s._id as Types.ObjectId).toString() === site))
    ? site
    : ((allowedSiteDocs[0]?._id as Types.ObjectId)?.toString() ?? '');
  const siteName = allowedSiteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId)?.name as string ?? '';

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
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle={`Opdrachten — ${siteName}`} backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
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
