'use client';

import styles from './Toggle.module.scss';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled, className }: ToggleProps) {
  return (
    <label className={[styles.row, disabled ? styles.disabled : '', className ?? ''].filter(Boolean).join(' ')}>
      {label && <span className={styles.label}>{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={[styles.track, checked ? styles.on : ''].filter(Boolean).join(' ')}
        onClick={() => !disabled && onChange(!checked)}
      >
        <span className={styles.knob} />
      </button>
    </label>
  );
}
