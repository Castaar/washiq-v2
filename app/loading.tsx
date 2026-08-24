import styles from './loading.module.scss';

// Shown by Next.js instantly on every route navigation while the new
// page's server-side data fetches — without this, App Router shows
// nothing at all until the whole page resolves, which reads as the app
// "hanging" on every page switch (worse in the installed PWA, which has
// no browser chrome loading indicator of its own).
export default function Loading() {
  return (
    <div className={styles.wrap}>
      <span className={styles.spinner} />
    </div>
  );
}
