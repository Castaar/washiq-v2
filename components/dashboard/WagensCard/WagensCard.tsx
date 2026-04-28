import styles from './WagensCard.module.scss';

interface WagensCardProps {
  count: number;
  delta: number;
}

export function WagensCard({ count, delta }: WagensCardProps) {
  const isPositive = delta >= 0;
  const sign = isPositive ? '+' : '';

  return (
    <div className={styles.card}>
      <span className={styles.label}>Wagens</span>
      <span className={styles.value}>{count}</span>
      <span className={[styles.delta, isPositive ? styles.positive : styles.negative].join(' ')}>
        {sign}{delta}
      </span>
    </div>
  );
}
