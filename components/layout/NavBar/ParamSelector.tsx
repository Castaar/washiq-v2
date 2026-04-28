'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import styles from './SiteSelector.module.scss';

interface Option {
  label: string;
  value: string;
}

interface ParamSelectorProps {
  label: string;
  paramKey: string;
  options: Option[];
  activeValue: string;
}

export function ParamSelector({ label, paramKey, options, activeValue }: ParamSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramKey, e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const active = options.find((o) => o.value === activeValue);

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{label}</span>
      <span className={styles.divider} aria-hidden="true" />
      <select
        className={styles.select}
        value={activeValue}
        onChange={handleChange}
        aria-label={`Selecteer ${label.toLowerCase()}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className={styles.value} aria-hidden="true">
        {active?.label ?? '—'}
      </span>
    </div>
  );
}
