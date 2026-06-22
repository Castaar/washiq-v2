import Image from 'next/image';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { AccountForm } from '@/components/account/AccountForm/AccountForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User, MaintenanceTask, WeeklyEntry, EnergyBill } from '@/lib/models';
import { getSession } from '@/lib/session';
import styles from './page.module.scss';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  await dbConnect();

  const session = await getSession();
  const sessionRole = session?.role ?? 'employee';

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const allSites = siteDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: (s.name as string) ?? '',
    location: (s.location as string) ?? '',
  }));

  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const sites =
    sessionRole === 'developer'
      ? allSites
      : allSites.filter((s) => userSiteIds.includes(s.id));

  const { site } = await searchParams;
  const siteId = (site && sites.find((s) => s.id === site))
    ? site
    : (sites[0]?.id ?? '');

  const addHref = sessionRole === 'employee' ? '/dagfiche' : '/wekelijkse-ingave';

  const [userDocs, currentUserDoc, taskDocs, weeklyEntries, energyBillDocs] = await Promise.all([
    User.find({ site_ids: siteId }).select('_id name email role').lean(),
    session ? User.findById(session.userId).select('_id name email birthday').lean() : Promise.resolve(null),
    MaintenanceTask.find({ site_id: siteId }).sort({ description: 1 }).lean(),
    WeeklyEntry.find({ site_id: siteId }).select('program_counts').lean(),
    EnergyBill.find({ site_id: siteId }).sort({ year: -1, month: -1 }).lean(),
  ]);

  // Total wash count for this site (sum of all program_counts across all weekly entries)
  const currentTotalWashes = (weeklyEntries as { program_counts?: { count: number }[] }[]).reduce(
    (sum, e) => sum + (e.program_counts ?? []).reduce((s, p) => s + (p.count ?? 0), 0),
    0,
  );

  const users = userDocs.map((u) => ({
    id: (u._id as Types.ObjectId).toString(),
    name: (u.name as string) ?? '',
    role: (u.role as string) ?? 'employee',
  }));

  const currentUser = currentUserDoc
    ? {
        id: (currentUserDoc._id as Types.ObjectId).toString(),
        name: (currentUserDoc.name as string) ?? '',
        email: (currentUserDoc.email as string) ?? '',
        birthday: (currentUserDoc.birthday as string) ?? '',
      }
    : null;

  const maintenanceTasks = taskDocs.map((t) => ({
    id: (t._id as Types.ObjectId).toString(),
    description: (t.description as string) ?? '',
    trigger_type: (t.trigger_type as string) as 'washes' | 'months' | 'fixed_date' | 'fixed_months',
    trigger_value: (t.trigger_value as number) ?? 0,
    trigger_day: (t.trigger_day as number) ?? 0,
    trigger_month: (t.trigger_month as number) ?? 0,
    trigger_month_list: (t.trigger_month_list as number[]) ?? [],
    last_done_at: t.last_done_at ? (t.last_done_at as Date).toISOString() : null,
    washes_at_last_done: (t.washes_at_last_done as number) ?? 0,
  }));

  const energyBills = energyBillDocs.map((b) => ({
    id: (b._id as Types.ObjectId).toString(),
    year: b.year as number,
    month: b.month as number,
    amount_euro: b.amount_euro as number,
  }));

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle={sites.find((s) => s.id === siteId)?.name ? `Account — ${sites.find((s) => s.id === siteId)!.name}` : 'Account'} sites={sites} activeSiteId={siteId} backHref="/" addHref={addHref} addLabel={addHref === '/dagfiche' ? 'Dagfiche' : 'Wekelijkse Ingave'} />
      <main className={styles.main}>
        <AccountForm
          users={users}
          siteId={siteId}
          currentUser={currentUser}
          role={sessionRole}
          maintenanceTasks={maintenanceTasks}
          currentTotalWashes={currentTotalWashes}
          energyBills={energyBills}
        />
      </main>
    </div>
  );
}
