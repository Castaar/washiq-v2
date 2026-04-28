import { weeklyStockData, heroStats } from '@/lib/mock-data/hero';
import { StockChart } from './StockChart';
import styles from './HeroPanel.module.scss';

export function HeroPanel() {
  const { totalAdded, totalRemoved, netChange, changePercent, period } = heroStats;

  return (
    <section className={styles.panel} aria-labelledby="hero-title">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h2 id="hero-title" className={styles.title}>Weekly Stock Movement</h2>
          <span className={styles.period}>{period}</span>
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={[styles.legendDot, styles.dotBlue].join(' ')} />
            Added
          </span>
          <span className={styles.legendItem}>
            <span className={[styles.legendDot, styles.dotRed].join(' ')} />
            Removed
          </span>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalAdded}</span>
          <span className={styles.statLabel}>Units added</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalRemoved}</span>
          <span className={styles.statLabel}>Units removed</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.stat}>
          <span className={[styles.statValue, styles.positive].join(' ')}>+{netChange}</span>
          <span className={styles.statLabel}>Net change</span>
        </div>
        <div className={[styles.changeBadge, styles.positive].join(' ')}>
          +{changePercent}%
        </div>
      </div>

      <div className={styles.chartArea}>
        <StockChart data={weeklyStockData} />
      </div>
    </section>
  );
}
