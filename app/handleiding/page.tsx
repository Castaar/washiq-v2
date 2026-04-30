import Image from 'next/image';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { HandleidingContent } from '@/components/handleiding/HandleidingContent/HandleidingContent';
import { getSession } from '@/lib/session';
import styles from './page.module.scss';

export default async function HandleidingPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; from?: string }>;
}) {
  const session = await getSession();
  const role = session?.role ?? 'employee';

  const { site, from } = await searchParams;
  const fromLogin = from === 'login' || !site;

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar
        centerTitle="Handleiding"
        backHref={site ? `/?site=${site}` : '/'}
      />
      <main className={styles.main}>
        <HandleidingContent role={role} siteParam={site ?? ''} fromLogin={fromLogin} />
      </main>
    </div>
  );
}
