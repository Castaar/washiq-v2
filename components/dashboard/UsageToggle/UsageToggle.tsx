'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import styles from './UsageToggle.module.scss';

type UsageMode = 'totaal' | 'wagen';

const tabs: { id: UsageMode; label: string }[] = [
  { id: 'totaal', label: 'Totaalverbruik' },
  { id: 'wagen',  label: 'Wagenverbruik'  },
];

export function UsageToggle({ activeUsage = 'totaal' }: { activeUsage?: UsageMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleClick(mode: UsageMode) {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === 'totaal') {
      params.delete('usage');
    } else {
      params.set('usage', mode);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={styles.group} role="tablist" aria-label="Verbruiksweergave">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeUsage === tab.id}
          className={[styles.tab, activeUsage === tab.id ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => handleClick(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
