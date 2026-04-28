import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { SchadeForm } from '@/components/incidenten/SchadeForm/SchadeForm';
import { getSession } from '@/lib/session';
import styles from '../page.module.scss';

export default async function SchadePage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  const session = await getSession();
  const siteId = site ?? '';

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle="Schaderapport" backHref={`/incidenten?site=${siteId}`} />
      <main className={styles.main}>
        <SchadeForm siteId={siteId} userName={session?.name ?? ''} />
      </main>
    </div>
  );
}
