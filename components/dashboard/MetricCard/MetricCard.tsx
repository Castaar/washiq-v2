import type { MetricCard as MetricCardData } from '@/lib/mock-data/metrics';
import { DynamicIcon, IconTrendingUp, IconTrendingDown } from '@/components/ui/icons';
import { IconWrapper } from '@/components/ui/IconWrapper/IconWrapper';
import type { IconWrapperColor } from '@/components/ui/IconWrapper/IconWrapper';
import styles from './MetricCard.module.scss';

export interface MetricCardProps {
  data: MetricCardData;
}

export function MetricCard({ data }: MetricCardProps) {
  const isPositive = data.change >= 0;

  return (
    <article className={[styles.card, styles[`accent-${data.accentColor}`]].join(' ')}>
      <div className={styles.header}>
        <span className={styles.label}>{data.label}</span>
        <IconWrapper color={data.accentColor as IconWrapperColor} size="sm">
          <DynamicIcon name={data.iconName} size={14} />
        </IconWrapper>
      </div>

      <div className={styles.valueRow}>
        <span className={styles.value}>{data.value}</span>
      </div>

      {data.subValue && (
        <span className={styles.subValue}>{data.subValue}</span>
      )}

      <div className={styles.footer}>
        <span className={[styles.change, isPositive ? styles.positive : styles.negative].join(' ')}>
          {isPositive
            ? <IconTrendingUp size={12} />
            : <IconTrendingDown size={12} />
          }
          {isPositive ? '+' : ''}{data.change}%
        </span>
        <span className={styles.changeLabel}>{data.changeLabel}</span>
      </div>
    </article>
  );
}
