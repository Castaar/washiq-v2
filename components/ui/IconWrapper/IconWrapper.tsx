import type { ReactNode } from 'react';
import styles from './IconWrapper.module.scss';

export type IconWrapperColor = 'blue' | 'teal' | 'amber' | 'red' | 'purple' | 'default';
export type IconWrapperSize = 'sm' | 'md' | 'lg';

export interface IconWrapperProps {
  children: ReactNode;
  color?: IconWrapperColor;
  size?: IconWrapperSize;
  className?: string;
}

export function IconWrapper({ children, color = 'default', size = 'md', className }: IconWrapperProps) {
  return (
    <span
      className={[
        styles.wrapper,
        styles[`color-${color}`],
        styles[`size-${size}`],
        className ?? '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
