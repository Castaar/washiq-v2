import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { DagfichesPanel } from '@/components/dagfiches/DagfichesPanel/DagfichesPanel';
import type { DagficheOverviewItem } from '@/components/dagfiches/DagfichesPanel/DagfichesPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User, DailyChecklist } from '@/lib/models';
import { getSession } from '@/lib/session';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded, redirectWithSiteParam } from '@/lib/getUserSites';
import styles from './page.module.scss';

function fmtDateTime(d: Date) {
  return d.toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
}

export default async function DagfichesPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const session = await getSession();
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    redirect('/');
  }

  const { site } = await searchParams;
  await dbConnect();

  const cookieStore = await cookies();
  const cookieSite = cookieStore.get('dodane_active_site')?.value;

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location').lean(),
    User.findById(session.userId).select('site_ids role').lean(),
  ]);

  const userRole = (userDoc?.role as string) ?? session.role;
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite) || null;
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  redirectWithSiteParam('/dagfiches', { site }, siteId ?? '');
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const checklistDocs = siteId
    ? await DailyChecklist.find({ site_id: siteId, submitted_at: { $gte: thirtyDaysAgo } }).sort({ submitted_at: -1 }).lean()
    : [];

  const userIds = [...new Set(checklistDocs.map((c) => c.user_id?.toString()).filter(Boolean))];
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('_id name').lean() : [];
  const userNameMap = Object.fromEntries(users.map((u) => [(u._id as Types.ObjectId).toString(), u.name as string]));

  const items: DagficheOverviewItem[] = checklistDocs.map((c) => {
    const ts = new Date((c.submitted_at as Date) ?? (c.date as Date));
    const clItems = (c.items as { label: string; checked: boolean; opmerking?: string }[]) ?? [];
    const uncheckedCount = clItems.filter((it) => !it.checked).length;
    const userName = userNameMap[c.user_id?.toString() ?? ''] ?? 'Onbekend';
    return {
      id: (c._id as Types.ObjectId).toString(),
      userName,
      submittedAt: fmtDateTime(ts),
      dateKey: ts.toLocaleDateString('nl-BE', { timeZone: 'Europe/Brussels' }),
      uncheckedCount,
      hasDefectNote: !!(c.defect_note && String(c.defect_note).trim()),
      payload: {
        type: 'dagfiche',
        submittedBy: userName,
        submittedAt: fmtDateTime(ts),
        items: clItems.map(({ label, checked, opmerking }) => ({ label, checked, opmerking })),
        defectNote: c.defect_note ? String(c.defect_note) : undefined,
      },
    };
  });

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
          <h1 className={styles.title}>Dagfiches — {siteName}</h1>
          <p className={styles.subtitle}>Laatste 30 dagen. Klik op een regel voor het volledige overzicht.</p>
          <DagfichesPanel items={items} siteId={siteId ?? ''} />
        </div>
      </main>
    </div>
  );
}
