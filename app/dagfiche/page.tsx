import Image from 'next/image';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { DagficheForm } from '@/components/forms/DagficheForm/DagficheForm';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, WeeklyEntry } from '@/lib/models';
import { getSession } from '@/lib/session';
import styles from './page.module.scss';

export default async function DagfichePage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const session = await getSession();
  const { site } = await searchParams;

  await dbConnect();

  const siteDocs = await Site.find({}).select('_id name').lean();
  const siteIds = siteDocs.map((s) => (s._id as Types.ObjectId).toString());
  const siteId = (site && siteIds.includes(site)) ? site : (siteIds[0] ?? '');

  const siteDoc = siteDocs.find((s) => (s._id as Types.ObjectId).toString() === siteId);
  const siteName = (siteDoc?.name as string) ?? 'Carwash';

  // Get most recent weekly entry to show wagens total
  const lastEntry = await WeeklyEntry.findOne({ site_id: siteId })
    .sort({ week_start: -1 })
    .select('program_counts')
    .lean();

  const totalWagens = (lastEntry?.program_counts ?? []).reduce(
    (sum: number, p: { count?: number }) => sum + (p.count ?? 0),
    0,
  );

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle="Dagfiche" backHref="/" />
      <main className={styles.main}>
        <DagficheForm
          siteId={siteId}
          siteName={siteName}
          userName={session?.name ?? ''}
          totalWagens={totalWagens}
        />
      </main>
    </div>
  );
}
