import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  isLoading = false,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[
        styles.button,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        isLoading ? styles.loading : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      disabled={disabled || isLoading}
      {...rest}
    >
      {iconLeft && <span className={styles.iconSlot}>{iconLeft}</span>}
      <span className={styles.label}>{children}</span>
      {iconRight && <span className={styles.iconSlot}>{iconRight}</span>}
    </button>
  );
}
