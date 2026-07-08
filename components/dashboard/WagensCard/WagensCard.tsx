import styles from './WagensCard.module.scss';

interface WagensCardProps {
  count: number;
  delta: number;
  tellerstand?: number;
}

export function WagensCard({ count, delta, tellerstand }: WagensCardProps) {
  const isPositive = delta >= 0;
  const sign = isPositive ? '+' : '';

  return (
    <div className={styles.card}>
      <span className={styles.label}>Wagens</span>
      <span className={styles.value}>{count}</span>
      <span className={[styles.delta, isPositive ? styles.positive : styles.negative].join(' ')}>
        {sign}{delta}
      </span>
      {tellerstand != null && tellerstand > 0 && (
        <span className={styles.tellerstand}>Stand: {tellerstand.toLocaleString('nl-BE')}</span>
      )}
    </div>
  );
}
