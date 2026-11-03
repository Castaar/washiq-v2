'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ContractStatus } from '@/lib/contract-hours';
import styles from './ContractAlert.module.scss';

// Owner notice: who has already worked their monthly contract hours, with overtime
export function ContractAlert({ items }: { items: ContractStatus[] }) {
  const t = useTranslations('contract');
  const locale = useLocale();
  const reached = items.filter((s) => s.reached);
  if (reached.length === 0) return null;
  const fmt = (n: number) => n.toLocaleString(locale === 'fr' ? 'fr-BE' : 'nl-BE', { maximumFractionDigits: 1 });
  return (
    <div className={styles.alert} role="status">
      <p className={styles.title}>{t('bereiktTitel')}</p>
      <ul className={styles.list}>
        {reached.map((s) => (
          <li key={s.userId}>
            <span className={styles.name}>{s.name}</span>
            <span className={styles.hours}>{t('gewerktVan', { gewerkt: fmt(s.workedHours), contract: fmt(s.contractHours) })}</span>
            {s.overtime > 0 && <span className={styles.overtime}>{t('overuren', { uren: fmt(s.overtime) })}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
