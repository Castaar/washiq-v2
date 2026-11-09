'use client';

import { useLocale, useTranslations } from 'next-intl';
import styles from './OmzetCard.module.scss';

export interface OmzetRow {
  label: string;
  euro: number;
  pct: number; // share of the omzet, in percent
}

interface OmzetCardProps {
  revenue: number;   // omzet of the latest ingave that has one, excl. btw
  date: string;      // YYYY-MM-DD of that ingave
  rows: OmzetRow[];
  prevRows?: OmzetRow[];
}

// Costs as a percentage of omzet (e.g. water 2%, zeep 1%), for selfcarwashes that
// have no wagen counts and as an extra view for tunnels.
export function OmzetCard({ revenue, date, rows, prevRows = [] }: OmzetCardProps) {
  const t = useTranslations('dashboard');
  const numLocale = useLocale() === 'fr' ? 'fr-BE' : 'nl-BE';
  const pct = (v: number) => `${v.toLocaleString(numLocale, { maximumFractionDigits: 1 })} %`;
  const euro = (v: number) => `€ ${v.toLocaleString(numLocale, { maximumFractionDigits: 0 })}`;
  const totalPct = Math.round(rows.reduce((sum, r) => sum + r.pct, 0) * 10) / 10;
  const day = date.split('-').reverse().join('/');

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>{t('kostenTovOmzet')}</span>
        <span className={styles.headerDate}>{day}</span>
      </div>

      <div className={styles.countRow}>
        <span className={styles.label}>{t('omzetExclBtw')}</span>
        <span className={styles.value}>{euro(revenue)}</span>
      </div>

      {rows.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>{t('totaalKostenOmzet')}</span>
            <span className={styles.totalValue}>{pct(totalPct)}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.rows}>
            {rows.map((r) => {
              const prev = prevRows.find((p) => p.label === r.label);
              const delta = prev ? Math.round((r.pct - prev.pct) * 10) / 10 : null;
              // Previous share shown as-is: a bare '+0,8' reads as a relative change
              return (
                <div key={r.label} className={styles.row}>
                  <span className={styles.label}>{r.label}</span>
                  <div className={styles.values}>
                    <span className={styles.value}>{pct(r.pct)}</span>
                    <span className={styles.sub}>
                      {euro(r.euro)}
                      {delta !== null && delta !== 0 && (
                        <span className={delta > 0 ? styles.up : styles.down}>
                          {' · '}{t('vorigePct', { pct: pct(prev!.pct) })}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
