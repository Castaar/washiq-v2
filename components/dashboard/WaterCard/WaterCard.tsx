'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import styles from './WaterCard.module.scss';

export interface WaterCardProps {
  siteId: string;
  yesterday: { date: string; total: number; closed: number; leak: number } | null;
  avgPerDay: number; // over the last 14 measured days
  monthTotal: number; // L, this month up to yesterday
  monthCost: number;
  monthClosed: number;
  prevMonthSamePeriod: number | null; // L, same days of the previous month (null = not measured then)
  bars: { date: string; open: number; closed: number }[]; // last 14 days
  litersPerWash: number | null;
  perWashSource: string; // e.g. "deze maand" or the ingave period
}

export function WaterCard({ siteId, yesterday, avgPerDay, monthTotal, monthCost, monthClosed, prevMonthSamePeriod, bars, litersPerWash, perWashSource }: WaterCardProps) {
  const t = useTranslations('water');
  const loc = useLocale() === 'fr' ? 'fr-BE' : 'nl-BE';
  const L = (n: number) => `${Math.round(n).toLocaleString(loc)} L`;
  const max = Math.max(1, ...bars.map((b) => b.open + b.closed));
  const delta = prevMonthSamePeriod && prevMonthSamePeriod > 0 ? Math.round(((monthTotal - prevMonthSamePeriod) / prevMonthSamePeriod) * 100) : null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>{t('kaartTitel')}</span>
        <Link href={`/water?site=${siteId}`} className={styles.detailLink}>{t('details')} →</Link>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>{yesterday ? t('laatsteDag', { date: yesterday.date.split('-').reverse().slice(0, 2).join('/') }) : t('gisteren')}</span>
        <span className={styles.value}>
          {yesterday ? L(yesterday.total) : '—'}
          {yesterday && avgPerDay > 0 && <span className={styles.sub}> {t('gemiddeldKort', { liters: L(avgPerDay) })}</span>}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>{t('dezeMaand')}</span>
        <span className={styles.value}>
          {(monthTotal / 1000).toLocaleString(loc, { maximumFractionDigits: 1 })} m³ · € {monthCost.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {delta !== null && <span className={delta > 10 ? styles.up : styles.sub}> {t('tovVorige', { pct: `${delta > 0 ? '+' : ''}${delta}%` })}</span>}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>{t('buitenOpening')}</span>
        <span className={monthClosed > 0 ? styles.valueWarn : styles.value}>{L(monthClosed)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>{t('perWasbeurt')}</span>
        <span className={styles.value}>
          {litersPerWash !== null ? L(litersPerWash) : '—'}
          {litersPerWash !== null && perWashSource && <span className={styles.sub}> ({perWashSource})</span>}
        </span>
      </div>
      {yesterday && yesterday.leak > 0 && (
        <p className={styles.alert}>{t('lekGisteren', { liters: L(yesterday.leak), date: yesterday.date.split('-').reverse().slice(0, 2).join('/') })}</p>
      )}

      {bars.length > 0 && (
        <div className={styles.bars} aria-hidden="true">
          {bars.map((b) => (
            <div key={b.date} className={styles.barCol} title={`${b.date.split('-').reverse().slice(0, 2).join('/')}: ${L(b.open + b.closed)}`}>
              <div className={styles.barClosed} style={{ height: `${(b.closed / max) * 100}%` }} />
              <div className={styles.barOpen} style={{ height: `${(b.open / max) * 100}%` }} />
            </div>
          ))}
        </div>
      )}
      <span className={styles.foot}>{t('laatste14')}</span>
    </div>
  );
}
