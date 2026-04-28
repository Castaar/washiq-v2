import type { ConsumptionData } from '@/lib/types/dashboard';
import styles from './ConsumptionCard.module.scss';

export interface ConsumptionCardProps {
  data: ConsumptionData;
}

export function ConsumptionCard({ data }: ConsumptionCardProps) {
  const isPositive = data.delta >= 0;
  const sign = isPositive ? '+' : '-';
  const prefix = data.prefix ?? '';
  const suffix = data.suffix ?? '';
  // For cost metrics: higher = bad (red), lower = good (green)
  const isGood = data.lowerIsBetter ? !isPositive : isPositive;

  return (
    <div className={styles.card}>
      <span className={styles.label}>{data.label}</span>
      <span className={styles.value}>
        {prefix && <span className={styles.prefix}>{prefix} </span>}
        {data.value}
        {suffix && <span className={styles.suffix}> {suffix}</span>}
      </span>
      <span className={[styles.delta, isGood ? styles.positive : styles.negative].join(' ')}>
        {sign}{prefix && `${prefix} `}{Math.abs(data.delta)}{suffix && ` ${suffix}`}
      </span>
    </div>
  );
}
