import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import styles from './Chip.module.scss';

export type ChipTone = 'default' | 'blue' | 'teal' | 'amber' | 'red' | 'purple';

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  tone?: ChipTone;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
}

export function Chip({ children, selected = false, tone = 'default', onClick, type = 'button', className }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      onClick={onClick}
      className={[
        styles.chip,
        styles[`tone-${tone}`],
        selected ? styles.selected : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}

export type Severity = 'laag' | 'medium' | 'hoog';

const severityOptions: { value: Severity; labelKey: 'ernstLaag' | 'ernstMedium' | 'ernstHoog'; tone: ChipTone }[] = [
  { value: 'laag', labelKey: 'ernstLaag', tone: 'teal' },
  { value: 'medium', labelKey: 'ernstMedium', tone: 'amber' },
  { value: 'hoog', labelKey: 'ernstHoog', tone: 'red' },
];

export function SeverityChips({
  value,
  onChange,
  className,
}: {
  value: Severity;
  onChange: (value: Severity) => void;
  className?: string;
}) {
  const t = useTranslations('modals');
  return (
    <div className={[styles.group, className ?? ''].filter(Boolean).join(' ')} role="radiogroup" aria-label={t('ernst')}>
      {severityOptions.map((opt) => (
        <Chip key={opt.value} tone={opt.tone} selected={value === opt.value} onClick={() => onChange(opt.value)}>
          {t(opt.labelKey)}
        </Chip>
      ))}
    </div>
  );
}
