import { redirect } from 'next/navigation';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { VertalingenPanel } from '@/components/vertalingen/VertalingenPanel/VertalingenPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { getSession } from '@/lib/session';
import { getAllTranslationRows } from '@/lib/translationKeys';
import styles from './page.module.scss';

export default async function VertalingenPage() {
  const session = await getSession();
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    redirect('/');
  }

  await dbConnect();
  const rows = await getAllTranslationRows();

  return (
    <div className={styles.root}>
      <NavBar centerTitle="Vertalingen" backHref="/" />
      <main className={styles.main}>
        <VertalingenPanel rows={rows} />
      </main>
    </div>
  );
}
