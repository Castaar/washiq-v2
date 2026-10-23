import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { m } from '@/lib/demo';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { DagficheForm } from '@/components/forms/DagficheForm/DagficheForm';
import type { TodayEvent } from '@/components/forms/DagficheForm/DagficheForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WeeklyEntry, MaintenanceTask, MaintenanceLog, User, IncidentSchade, IncidentEhbo, Defect, StockDelivery, ChemicalStock, AttendanceLog } from '@/lib/models';
import { getSession } from '@/lib/session';
import { computeIsOverdue } from '@/lib/maintenance';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded, redirectWithSiteParam } from '@/lib/getUserSites';
import styles from './page.module.scss';
import { isBeforeStatsFrom } from '@/lib/statsFrom';
import type { AttendanceType } from '@/lib/attendance-hours';

// Runs server-side (Vercel = UTC) — pin the timezone so times aren't off by
// 1-2 hours vs. Belgian local time.
function fmtTime(dateLocale: string, d: Date) {
  return d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
}

export default async function DagfichePage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const session = await getSession();
  const isDemo = session?.demo === true;
  const { site } = await searchParams;
  const t = await getTranslations('dagfiches');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  const dateLocale = locale === 'fr' ? 'fr-BE' : 'nl-BE';
  const fmtErnst = (ernst: string) => (['laag', 'medium', 'hoog'].includes(ernst) ? t(`ernst.${ernst}`) : ernst);

  await dbConnect();

  const cookieStore = await cookies();
  const cookieSite = cookieStore.get('glosiv_active_site')?.value;

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location site_type stats_from').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite);
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  redirectWithSiteParam('/dagfiche', { site }, siteId ?? '');

  const siteDoc = allowedSites.find((s) => s.id === siteId);
  const siteName = siteDoc?.name ?? 'Carwash';

  // Today boundaries (local Belgian time approx via UTC+1/+2)
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [lastEntry, allTaskDocs, maintenanceLogsToday, incSchadesToday, incEhbosToday, defectsToday, deliveriesToday, attendanceToday] = await Promise.all([
    WeeklyEntry.findOne({ site_id: siteId }).sort({ week_start: -1 }).select('program_counts week_start').lean(),
    MaintenanceTask.find({ site_id: siteId })
      .select('_id description trigger_type trigger_value trigger_day trigger_month trigger_month_list last_done_at is_overdue')
      .lean(),
    MaintenanceLog.find({ site_id: siteId, done_at: { $gte: todayStart, $lt: todayEnd } }).populate('task_id', 'description').lean(),
    IncidentSchade.find({ site_id: siteId, created_at: { $gte: todayStart, $lt: todayEnd } }).select('merk_model naam_eigenaar omschrijving reported_by_name created_at').lean(),
    IncidentEhbo.find({ site_id: siteId, created_at: { $gte: todayStart, $lt: todayEnd } }).select('naam_slachtoffer verwonding reported_by_name created_at').lean(),
    Defect.find({ site_id: siteId, created_at: { $gte: todayStart, $lt: todayEnd } }).select('omschrijving ernst reported_by_name created_at').lean(),
    StockDelivery.find({ site_id: siteId, delivered_at: { $gte: todayStart, $lt: todayEnd } }).populate('chemical_id', 'name unit').lean(),
    AttendanceLog.find({ site_id: siteId, timestamp: { $gte: todayStart, $lt: todayEnd } }).sort({ timestamp: 1 }).lean(),
  ]);

  // An ingave from before a takeover (stats_from) belongs to the previous owner
  const statsFrom = (siteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId)?.stats_from as string | null | undefined) ?? null;
  const lastStatsEntry = lastEntry && !isBeforeStatsFrom(new Date(lastEntry.week_start as Date).toISOString().slice(0, 10), statsFrom) ? lastEntry : null;
  const totalWagens = (lastStatsEntry?.program_counts ?? []).reduce(
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
      kind: (l.type === 'sluiting' || l.type === 'pauze_start' ? 'uitlog' : 'inlog') as TodayEvent['kind'],
      label: t(({ opening: 'event.aangemeld', sluiting: 'event.vertrokken', pauze_start: 'event.pauzeStart', pauze_einde: 'event.pauzeEinde' } as const)[l.type as AttendanceType] ?? 'event.aangemeld', { name: l.user_name ?? tCommon('onbekend') }),
      time: fmtTime(dateLocale, new Date(l.timestamp as Date)),
      detail: (l.person_type as string) === 'technician_extern' ? t('event.externeTechnieker') : undefined,
    })),
    ...incSchadesToday.map((s) => ({
      kind: 'incident' as const,
      label: t('event.schade', { name: (s.merk_model as string) || m(isDemo, (s.naam_eigenaar as string)) || t('event.voertuig') }),
      time: fmtTime(dateLocale, new Date(s.created_at as Date)),
      detail: [(s.omschrijving as string) || '', (s.reported_by_name as string) ? t('event.door', { name: s.reported_by_name as string }) : ''].filter(Boolean).join(' · ') || undefined,
    })),
    ...incEhbosToday.map((e) => ({
      kind: 'incident' as const,
      label: t('event.ehbo', { name: m(isDemo, (e.naam_slachtoffer as string)) || t('event.slachtoffer') }),
      time: fmtTime(dateLocale, new Date(e.created_at as Date)),
      detail: [(e.verwonding as string) || '', (e.reported_by_name as string) ? t('event.door', { name: e.reported_by_name as string }) : ''].filter(Boolean).join(' · ') || undefined,
    })),
    ...defectsToday.map((d) => ({
      kind: 'defect' as const,
      label: t('event.defectGemeld', { name: ((d.omschrijving as string) ?? '').slice(0, 50) || t('event.defect') }),
      time: fmtTime(dateLocale, new Date(d.created_at as Date)),
      detail: t('event.ernstDoor', { ernst: fmtErnst(d.ernst as string), name: d.reported_by_name as string }),
    })),
    ...deliveriesToday.map((d) => {
      const chem = d.chemical_id as { name?: string; unit?: string } | null;
      return {
        kind: 'levering' as const,
        label: t('event.levering', { name: chem?.name ?? ((d.note as string) || t('event.product')) }),
        time: fmtTime(dateLocale, new Date(d.delivered_at as Date)),
        detail: chem?.name ? `${d.quantity as number} ${chem?.unit ?? ''}` : ((d.logged_by_name as string) ? t('event.door', { name: d.logged_by_name as string }) : undefined),
      };
    }),
    ...maintenanceLogsToday.map((l) => {
      const taskDesc = (l.task_id as unknown as { description?: string } | null)?.description ?? '';
      return {
        kind: 'onderhoud' as const,
        label: t('event.onderhoud', { name: taskDesc || t('event.uitgevoerd') }),
        time: fmtTime(dateLocale, new Date(l.done_at as Date)),
        detail: (l.notes as string) || undefined,
      };
    }),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId} backHref="/" />
      <main className={styles.main}>
        <DagficheForm
          key={siteId}
          siteId={siteId}
          siteName={siteName}
          siteType={siteDoc?.siteType ?? 'wasstraat'}
          userName={session?.name ?? ''}
          totalWagens={totalWagens}
          maintenanceTasks={maintenanceTasks}
          todayEvents={todayEvents}
        />
      </main>
    </div>
  );
}
