import type { ReactNode } from 'react';
import styles from './Badge.module.scss';

export type BadgeVariant = 'default' | 'blue' | 'teal' | 'amber' | 'red' | 'purple';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', dot = false, className }: BadgeProps) {
  return (
    <span
      className={[
        styles.badge,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        dot ? styles.dot : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
    >
      {dot && <span className={styles.dotIndicator} aria-hidden="true" />}
      {children}
    </span>
  );
}
