import type { ReactNode, HTMLAttributes } from 'react';
import styles from './Card.module.scss';

export type CardVariant = 'default' | 'elevated' | 'glow-blue' | 'glow-teal' | 'glow-purple';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  className?: string;
}

export function Card({ children, variant = 'default', padding = 'md', className, ...rest }: CardProps) {
  return (
    <div
      className={[
        styles.card,
        styles[`variant-${variant}`],
        styles[`padding-${padding}`],
        className ?? '',
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
