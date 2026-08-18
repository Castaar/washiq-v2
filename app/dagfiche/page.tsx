import { cookies } from 'next/headers';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { DagficheForm } from '@/components/forms/DagficheForm/DagficheForm';
import type { TodayEvent } from '@/components/forms/DagficheForm/DagficheForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WeeklyEntry, MaintenanceTask, MaintenanceLog, User, IncidentSchade, IncidentEhbo, Defect, StockDelivery, ChemicalStock, AttendanceLog } from '@/lib/models';
import { getSession } from '@/lib/session';
import { computeIsOverdue } from '@/lib/maintenance';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded } from '@/lib/getUserSites';
import styles from './page.module.scss';

function fmtTime(d: Date) {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

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
  await redirectIfSetupNeeded(siteId ?? '', userRole);

  const siteDoc = allowedSites.find((s) => s.id === siteId);
  const siteName = siteDoc?.name ?? 'Carwash';

  // Today boundaries (local Belgian time approx via UTC+1/+2)
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [lastEntry, allTaskDocs, maintenanceLogsToday, incSchadesToday, incEhbosToday, defectsToday, deliveriesToday, attendanceToday] = await Promise.all([
    WeeklyEntry.findOne({ site_id: siteId }).sort({ week_start: -1 }).select('program_counts').lean(),
    MaintenanceTask.find({ site_id: siteId })
      .select('_id description trigger_type trigger_value trigger_day trigger_month trigger_month_list last_done_at is_overdue')
      .lean(),
    MaintenanceLog.find({ site_id: siteId, done_at: { $gte: todayStart, $lt: todayEnd } }).populate('task_id', 'description').lean(),
    IncidentSchade.find({ site_id: siteId, created_at: { $gte: todayStart, $lt: todayEnd } }).select('merk_model naam_eigenaar omschrijving created_at').lean(),
    IncidentEhbo.find({ site_id: siteId, created_at: { $gte: todayStart, $lt: todayEnd } }).select('naam_slachtoffer verwonding created_at').lean(),
    Defect.find({ site_id: siteId, created_at: { $gte: todayStart, $lt: todayEnd } }).select('omschrijving ernst reported_by_name created_at').lean(),
    StockDelivery.find({ site_id: siteId, delivered_at: { $gte: todayStart, $lt: todayEnd } }).populate('chemical_id', 'name unit').lean(),
    AttendanceLog.find({ site_id: siteId, timestamp: { $gte: todayStart, $lt: todayEnd } }).sort({ timestamp: 1 }).lean(),
  ]);

  const totalWagens = (lastEntry?.program_counts ?? []).reduce(
    (sum: number, p: { count?: number }) => sum + (p.count ?? 0),
    0,
  );

  const maintenanceTasks = allTaskDocs
    .filter((t) => computeIsOverdue(t, now))
    .map((t) => ({
      id: (t._id as Types.ObjectId).toString(),
      description: t.description as string,
    }));

  // Build today's events
  const todayEvents: TodayEvent[] = [
    ...attendanceToday.map((l) => ({
      kind: (l.type === 'sluiting' ? 'uitlog' : 'inlog') as TodayEvent['kind'],
      label: `${l.user_name ?? 'Onbekend'} ${l.type === 'sluiting' ? 'vertrokken' : 'aangemeld'}`,
      time: fmtTime(new Date(l.timestamp as Date)),
      detail: (l.person_type as string) === 'technician_extern' ? 'Externe technieker' : undefined,
    })),
    ...incSchadesToday.map((s) => ({
      kind: 'incident' as const,
      label: `Schade: ${(s.merk_model as string) || (s.naam_eigenaar as string) || 'Voertuig'}`,
      time: fmtTime(new Date(s.created_at as Date)),
      detail: (s.omschrijving as string) || undefined,
    })),
    ...incEhbosToday.map((e) => ({
      kind: 'incident' as const,
      label: `EHBO: ${(e.naam_slachtoffer as string) || 'Slachtoffer'}`,
      time: fmtTime(new Date(e.created_at as Date)),
      detail: (e.verwonding as string) || undefined,
    })),
    ...defectsToday.map((d) => ({
      kind: 'defect' as const,
      label: `Defect gemeld: ${((d.omschrijving as string) ?? '').slice(0, 50) || 'Defect'}`,
      time: fmtTime(new Date(d.created_at as Date)),
      detail: `Ernst: ${d.ernst as string} · Door: ${d.reported_by_name as string}`,
    })),
    ...deliveriesToday.map((d) => {
      const chem = d.chemical_id as { name?: string; unit?: string } | null;
      return {
        kind: 'levering' as const,
        label: `Levering: ${chem?.name ?? 'Product'}`,
        time: fmtTime(new Date(d.delivered_at as Date)),
        detail: `${d.quantity as number} ${chem?.unit ?? ''}`,
      };
    }),
    ...maintenanceLogsToday.map((l) => {
      const taskDesc = (l.task_id as unknown as { description?: string } | null)?.description ?? '';
      return {
        kind: 'onderhoud' as const,
        label: `Onderhoud: ${taskDesc || 'Uitgevoerd'}`,
        time: fmtTime(new Date(l.done_at as Date)),
        detail: (l.notes as string) || undefined,
      };
    }),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId} backHref="/" />
      <main className={styles.main}>
        <DagficheForm
          siteId={siteId}
          siteName={siteName}
          userName={session?.name ?? ''}
          totalWagens={totalWagens}
          maintenanceTasks={maintenanceTasks}
          todayEvents={todayEvents}
        />
      </main>
    </div>
  );
}
