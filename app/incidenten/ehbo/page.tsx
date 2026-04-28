import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { EhboForm } from '@/components/incidenten/EhboForm/EhboForm';
import { getSession } from '@/lib/session';
import styles from '../page.module.scss';

export default async function EhboPage({
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
      <NavBar centerTitle="EHBO rapport" backHref={`/incidenten?site=${siteId}`} />
      <main className={styles.main}>
        <EhboForm siteId={siteId} userName={session?.name ?? ''} />
      </main>
    </div>
  );
}
