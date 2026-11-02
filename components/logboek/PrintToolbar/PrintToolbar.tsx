'use client';

import { useRouter } from 'next/navigation';
import styles from './PrintToolbar.module.scss';

// Choose which sheet to print (total, everyone, or one person) and print it
export function PrintToolbar({
  year,
  month,
  view,
  options,
  printLabel,
  chooseLabel,
}: {
  year: number;
  month: number;
  view: string;
  options: { value: string; label: string }[];
  printLabel: string;
  chooseLabel: string;
}) {
  const router = useRouter();
  return (
    <div className={styles.bar}>
      <select
        className={styles.select}
        value={view}
        aria-label={chooseLabel}
        onChange={(e) => router.push(`/logboek/afdruk?year=${year}&month=${month}&view=${encodeURIComponent(e.target.value)}`)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button type="button" className={styles.btn} onClick={() => window.print()}>
        {printLabel}
      </button>
    </div>
  );
}
