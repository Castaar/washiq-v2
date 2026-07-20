import Image from 'next/image';
import { cookies } from 'next/headers';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { IncidentenPanel } from '@/components/incidenten/IncidentenPanel/IncidentenPanel';
import type { IncidentListItem } from '@/components/incidenten/IncidentenPanel/IncidentenPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, IncidentSchade, IncidentEhbo, WeeklyEntry, User } from '@/lib/models';
import { getSession } from '@/lib/session';
import { filterSitesForUser, resolveActiveSite } from '@/lib/getUserSites';
import styles from './page.module.scss';

function fmtDate(d: Date) {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export default async function IncidentenPage({
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

  const [schades, ehbos, totalSchade, allSchades, latestEntry] = await Promise.all([
    IncidentSchade.find({ site_id: siteId }).sort({ created_at: -1 }).limit(15).lean(),
    IncidentEhbo.find({ site_id: siteId }).sort({ created_at: -1 }).limit(15).lean(),
    IncidentSchade.countDocuments({ site_id: siteId }),
    IncidentSchade.find({ site_id: siteId }).select('schade_locaties').lean(),
    WeeklyEntry.findOne({ site_id: siteId }).sort({ week_start: -1 }).select('tellerstand').lean(),
  ]);

  const currentTellerstand = (latestEntry as { tellerstand?: number } | null)?.tellerstand ?? 0;
  const schadesPer1000 = currentTellerstand > 0
    ? Math.round((totalSchade / currentTellerstand) * 1000 * 10) / 10
    : null;

  const locatieCounts: Record<string, number> = {};
  for (const s of allSchades as { schade_locaties?: string[] }[]) {
    for (const loc of s.schade_locaties ?? []) {
      locatieCounts[loc] = (locatieCounts[loc] ?? 0) + 1;
    }
  }
  const schadeLocatieStats = Object.entries(locatieCounts).map(([locatie, count]) => ({
    locatie,
    count,
    per1000: currentTellerstand > 0 ? Math.round((count / currentTellerstand) * 1000 * 10) / 10 : null,
  }));

  const incidents: IncidentListItem[] = [
    ...schades.map((s) => ({
      id: (s._id as Types.ObjectId).toString(),
      type: 'schade' as const,
      title: (s.merk_model as string) || (s.naam_eigenaar as string) || 'Schade',
      subtitle: [(s.omschrijving as string) || '', ((s.schade_locaties as string[]) ?? []).join(', ')].filter(Boolean).join(' — '),
      date: fmtDate(new Date(s.created_at as Date)),
      is_resolved: (s.is_resolved as boolean) ?? false,
      resolved_by_name: (s.resolved_by_name as string) ?? '',
    })),
    ...ehbos.map((e) => ({
      id: (e._id as Types.ObjectId).toString(),
      type: 'ehbo' as const,
      title: (e.naam_slachtoffer as string) || 'EHBO',
      subtitle: (e.verwonding as string) || '',
      date: fmtDate(new Date(e.created_at as Date)),
      is_resolved: false,
      resolved_by_name: '',
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const addHref = session?.role === 'employee' ? `/dagfiche?site=${siteId}` : `/wekelijkse-ingave?site=${siteId}`;
  const addLabel = session?.role === 'employee' ? 'Dagfiche' : 'Maandelijkse Ingave';

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar sites={allowedSites} activeSiteId={siteId} backHref="/" addHref={addHref} addLabel={addLabel} />
      <main className={styles.main}>
        <IncidentenPanel
          siteId={siteId}
          initialIncidents={incidents}
          stats={{ totalSchade, currentTellerstand, schadesPer1000, schadeLocatieStats }}
        />
      </main>
    </div>
  );
}
