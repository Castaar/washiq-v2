import Image from 'next/image';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { IncidentenPanel } from '@/components/incidenten/IncidentenPanel/IncidentenPanel';
import type { IncidentListItem } from '@/components/incidenten/IncidentenPanel/IncidentenPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, IncidentSchade, IncidentEhbo, Defect } from '@/lib/models';
import { getSession } from '@/lib/session';
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

  const siteDocs = await Site.find({}).select('_id name').lean();
  const siteIds = siteDocs.map((s) => (s._id as Types.ObjectId).toString());
  const siteId = (site && siteIds.includes(site)) ? site : (siteIds[0] ?? '');
  const siteName = siteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId)?.name as string ?? '';

  const [schades, ehbos, defects] = await Promise.all([
    IncidentSchade.find({ site_id: siteId }).sort({ created_at: -1 }).limit(15).lean(),
    IncidentEhbo.find({ site_id: siteId }).sort({ created_at: -1 }).limit(15).lean(),
    Defect.find({ site_id: siteId }).sort({ created_at: -1 }).limit(15).lean(),
  ]);

  const incidents: IncidentListItem[] = [
    ...schades.map((s) => ({
      id: (s._id as Types.ObjectId).toString(),
      type: 'schade' as const,
      title: (s.merk_model as string) || (s.naam_eigenaar as string) || 'Schade',
      subtitle: (s.omschrijving as string) || '',
      date: fmtDate(new Date(s.created_at as Date)),
    })),
    ...ehbos.map((e) => ({
      id: (e._id as Types.ObjectId).toString(),
      type: 'ehbo' as const,
      title: (e.naam_slachtoffer as string) || 'EHBO',
      subtitle: (e.verwonding as string) || '',
      date: fmtDate(new Date(e.created_at as Date)),
    })),
    ...defects.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      type: 'defect' as const,
      title: ((d.omschrijving as string) ?? '').slice(0, 40) || 'Defect',
      subtitle: (d.ernst as string) || '',
      date: fmtDate(new Date(d.created_at as Date)),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const addHref = session?.role === 'employee' ? `/dagfiche?site=${siteId}` : `/wekelijkse-ingave?site=${siteId}`;
  const addLabel = session?.role === 'employee' ? 'Dagfiche' : 'Wekelijkse Ingave';

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle={`Incidenten — ${siteName}`} backHref="/" addHref={addHref} addLabel={addLabel} />
      <main className={styles.main}>
        <IncidentenPanel siteId={siteId} initialIncidents={incidents} />
      </main>
    </div>
  );
}
