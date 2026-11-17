import styles from './Skeleton.module.scss';

// Placeholder shown while a page's server data loads (route loading.tsx files).
// The layout appears at once with softly pulsing blocks where the data will come,
// so the app feels like it keeps going instead of showing a spinner. It fades in
// only after a short delay, so fast pages never flash it.

function Bar({ w = '100%', h = 12, round = false }: { w?: string; h?: number; round?: boolean }) {
  return <span className={[styles.block, round ? styles.round : ''].join(' ')} style={{ width: w, height: h }} />;
}

function Card({ lines = 4, title = true, tall = false }: { lines?: number; title?: boolean; tall?: boolean }) {
  const widths = ['72%', '55%', '66%', '45%', '60%', '50%', '70%'];
  return (
    <div className={styles.card}>
      {title && <Bar w="38%" h={14} />}
      {tall && <span className={styles.block} style={{ width: '100%', height: 140 }} />}
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={styles.row}>
          <Bar w={widths[i % widths.length]} />
          <Bar w="48px" />
        </div>
      ))}
    </div>
  );
}

function NavPlaceholder() {
  return (
    <div className={styles.nav}>
      <div className={styles.navLeft}>
        <Bar w="30px" h={30} />
        <div className={styles.navTitle}>
          <Bar w="64px" h={12} />
          <Bar w="88px" h={10} />
        </div>
      </div>
      <Bar w="36px" h={36} />
    </div>
  );
}

// Generic page: nav + a column of cards
export function PageSkeleton({ cards = [5, 4, 3] }: { cards?: number[] }) {
  return (
    <div className={styles.root} aria-busy="true" aria-label="Laden">
      <NavPlaceholder />
      <main className={styles.main}>
        <div className={styles.column}>
          {cards.map((lines, i) => <Card key={i} lines={lines} />)}
        </div>
      </main>
    </div>
  );
}

// Dashboard: three columns on desktop (cost card · hero + water · alerts + stock),
// one stack on mobile in the same order the real dashboard uses.
export function DashboardSkeleton() {
  return (
    <div className={styles.root} aria-busy="true" aria-label="Laden">
      <NavPlaceholder />
      <main className={styles.mainWide}>
        <div className={styles.grid}>
          <div className={styles.center}>
            <div className={styles.hero}>
              <Bar w="55%" h={20} />
              <Bar w="35%" h={12} />
            </div>
            <span className={[styles.block, styles.image].join(' ')} />
            <Card lines={3} />
          </div>
          <div className={styles.right}>
            <Card lines={4} />
            <Card lines={5} />
          </div>
          <div className={styles.left}>
            <Card lines={6} />
            <Card lines={3} />
          </div>
        </div>
      </main>
    </div>
  );
}
