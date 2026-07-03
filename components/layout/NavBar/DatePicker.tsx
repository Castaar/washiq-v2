'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import styles from './SiteSelector.module.scss';

interface DatePickerProps {
  activeDate: string; // YYYY-MM-DD
}

export function DatePicker({ activeDate }: DatePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Datum</span>
      <span className={styles.divider} aria-hidden="true" />
      <input
        className={styles.select}
        type="date"
        value={activeDate}
        onChange={handleChange}
        aria-label="Kies een datum om die periode te bekijken"
      />
    </div>
  );
}
