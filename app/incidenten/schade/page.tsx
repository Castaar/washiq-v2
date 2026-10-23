import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('incidenten');
  const siteId = site ?? '';

  return (
    <div className={styles.root}>
      <NavBar centerTitle={t('schadeRapport')} backHref={`/incidenten?site=${siteId}`} />
      <main className={styles.main}>
        <SchadeForm siteId={siteId} userName={session?.name ?? ''} />
      </main>
    </div>
  );
}
