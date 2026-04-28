import { topRankedItems } from '@/lib/mock-data/ranking';
import type { RankingItem } from '@/lib/mock-data/ranking';
import { IconTrendingUp, IconTrendingDown } from '@/components/ui/icons';
import styles from './RankingCard.module.scss';

const SPARK_W = 56;
const SPARK_H = 24;

function Sparkline({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * SPARK_W;
    const y = SPARK_H - ((v - min) / range) * SPARK_H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const last = data[data.length - 1];
  const isUp = last >= data[0];

  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={isUp ? '#10d9a0' : '#f05252'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RankRow({ item }: { item: RankingItem }) {
  const isUp = item.trend >= 0;

  return (
    <li className={styles.row}>
      <span className={styles.rank}>{item.rank}</span>
      <div className={styles.info}>
        <span className={styles.name}>{item.name}</span>
        <span className={styles.category}>{item.category}</span>
      </div>
      <div className={styles.metrics}>
        <span className={styles.units}>{item.unitsSold.toLocaleString()} units</span>
        <span className={styles.revenue}>€{(item.revenue / 1000).toFixed(1)}k</span>
      </div>
      <div className={styles.sparkCol}>
        <Sparkline data={item.sparkline} />
        <span className={[styles.trend, isUp ? styles.up : styles.down].join(' ')}>
          {isUp ? <IconTrendingUp size={11} /> : <IconTrendingDown size={11} />}
          {Math.abs(item.trend)}%
        </span>
      </div>
    </li>
  );
}

export function RankingCard() {
  return (
    <section className={styles.card} aria-labelledby="ranking-title">
      <div className={styles.header}>
        <h2 id="ranking-title" className={styles.title}>Top Products</h2>
        <span className={styles.period}>This month</span>
      </div>

      <ul className={styles.list} role="list">
        {topRankedItems.map(item => (
          <RankRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
