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
    const siteId = e.target.value;
    document.cookie = `dodane_active_site=${siteId}; path=/; max-age=2592000; SameSite=Lax`;
    const params = new URLSearchParams(searchParams.toString());
    params.set('site', siteId);
    router.push(`${pathname}?${params.toString()}`);
  }

  const active = sites.find((s) => s.id === activeSiteId);

  if (sites.length <= 1) {
    return <span className={styles.staticValue}>{active?.location ?? '—'}</span>;
  }

  return (
    <div className={styles.wrap}>
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
        <span className={styles.chevron} />
      </span>
    </div>
  );
}
