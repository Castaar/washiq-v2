'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from './UsageToggle.module.scss';

type UsageMode = 'totaal' | 'wagen';

export function UsageToggle({ activeUsage = 'wagen' }: { activeUsage?: UsageMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('dashboard');
  const tabs: { id: UsageMode; label: string }[] = [
    { id: 'totaal', label: t('totaalverbruik') },
    { id: 'wagen',  label: t('wagenverbruik')  },
  ];

  function handleClick(mode: UsageMode) {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === 'wagen') {
      params.delete('usage');
    } else {
      params.set('usage', mode);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={styles.group} role="tablist" aria-label={t('verbruiksweergave')}>
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
