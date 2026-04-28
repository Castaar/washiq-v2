import type { VoorraadItem } from '@/lib/types/dashboard';
import styles from './VoorraadPanel.module.scss';

interface VoorraadPanelProps {
  items: VoorraadItem[];
}

function VoorraadRow({ item }: { item: VoorraadItem }) {
  const pct = Math.min((item.current / item.max) * 100, 100);
  const isLow = pct < 30;

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.rowLabel}>{item.name}</span>
        <span className={styles.rowValue}>
          {item.current} {item.unit}
        </span>
      </div>
      <div className={styles.bar} role="progressbar" aria-valuenow={item.current} aria-valuemin={0} aria-valuemax={item.max}>
        <div
          className={[styles.barFill, isLow ? styles.barLow : ''].filter(Boolean).join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function VoorraadPanel({ items }: VoorraadPanelProps) {
  return (
    <div className={styles.panel}>
      <span className={styles.title}>Voorraad</span>
      <div className={styles.rows}>
        {items.length > 0
          ? items.map(item => <VoorraadRow key={item.id} item={item} />)
          : <span className={styles.title} style={{ fontSize: '0.75rem', opacity: 0.5 }}>Geen voorraad</span>
        }
      </div>
    </div>
  );
}
