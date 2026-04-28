'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import styles from './SiteSelector.module.scss';

interface Site {
  id: string;
  name: string;
  location: string;
}

interface SiteSelectorProps {
  sites: Site[];
  activeSiteId: string;
}

export function SiteSelector({ sites, activeSiteId }: SiteSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('site', e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const active = sites.find((s) => s.id === activeSiteId);

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Carwash</span>
      <span className={styles.divider} aria-hidden="true" />
      <select
        className={styles.select}
        value={activeSiteId}
        onChange={handleChange}
        aria-label="Selecteer carwash"
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.location}
          </option>
        ))}
      </select>
      {/* visible value label (mirrors the select) */}
      <span className={styles.value} aria-hidden="true">
        {active?.location ?? '—'}
      </span>
    </div>
  );
}
