import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { PlanningPanel } from '@/components/planning/PlanningPanel/PlanningPanel';
import type { Shift, PlanningEmployee } from '@/components/planning/PlanningPanel/PlanningPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, Planning, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import type { Types } from 'mongoose';
import styles from './page.module.scss';

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  const session = await getSession();
  await dbConnect();

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

  const from = new Date(today);
  from.setDate(from.getDate() - 7);

  const [shiftDocs, employeeDocs] = await Promise.all([
    Planning.find({
      site_id: siteId,
      date: { $gte: from, $lte: twoWeeksLater },
      ...(!isOwner && session?.userId ? { user_id: session.userId } : {}),
    }).sort({ date: 1, start_time: 1 }).lean(),
    isOwner
      ? User.find({ site_ids: siteId, role: 'employee' }).select('_id name').lean()
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

  const employees: PlanningEmployee[] = (employeeDocs as { _id: Types.ObjectId; name: string }[]).map((u) => ({
    id: u._id.toString(),
    name: u.name,
  }));

  const weekStart = today.toISOString().slice(0, 10);

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle={`Planning — ${siteName}`} backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
          <PlanningPanel
            siteId={siteId}
            userRole={userRole}
            currentUserId={session?.userId ?? ''}
            shifts={shifts}
            employees={employees}
            weekStart={weekStart}
          />
        </div>
      </main>
    </div>
  );
}
