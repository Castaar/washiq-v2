'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  IconHome, IconFileText, IconWarning, IconMoreHorizontal, IconCheck, IconCart,
} from '@/components/ui/icons';
import { MeerSheet } from './MeerSheet';
import styles from './BottomNav.module.scss';

export type UserRole = 'developer' | 'owner' | 'employee' | 'technician';

interface BottomNavProps {
  role: UserRole;
  siteType?: 'wasstraat' | 'selfcarwash';
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function BottomNav({ role, siteType = 'wasstraat' }: BottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [meerOpen, setMeerOpen] = useState(false);

  if (role === 'technician') {
    const tabs = [
      { href: '/technieker', label: t('werklijst'), icon: IconHome },
      { href: '/logboek', label: t('logboek'), icon: IconCheck },
      { href: '/leveringen', label: t('leveringen'), icon: IconCart },
      { href: '/account', label: t('account'), icon: IconFileText },
    ];
    return (
      <nav className={styles.nav} aria-label={t('hoofdnavigatie')}>
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={[styles.tab, isActive(pathname, tab.href) ? styles.active : ''].filter(Boolean).join(' ')}
          >
            <tab.icon size={22} />
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        ))}
      </nav>
    );
  }

  // One Ingave route for every site type: the page itself shows the wagen ingave
  // or, for a selfcarwash, the dated stock count. (The nav's siteType comes from the
  // root layout and can be stale after switching carwash, so it must not decide the link.)
  const ingaveHref = role === 'employee' ? '/dagfiche' : '/wekelijkse-ingave';
  const ingaveLabelKey = 'ingave';

  return (
    <>
      <nav className={styles.nav} aria-label={t('hoofdnavigatie')}>
        <Link href="/" className={[styles.tab, isActive(pathname, '/') ? styles.active : ''].filter(Boolean).join(' ')}>
          <IconHome size={22} />
          <span className={styles.tabLabel}>{t('dashboard')}</span>
        </Link>
        <Link
          href={ingaveHref}
          className={[styles.tab, isActive(pathname, ingaveHref) ? styles.active : ''].filter(Boolean).join(' ')}
        >
          <IconFileText size={22} />
          <span className={styles.tabLabel}>{t(ingaveLabelKey)}</span>
        </Link>
        <Link
          href="/incidenten"
          className={[styles.tab, isActive(pathname, '/incidenten') ? styles.active : ''].filter(Boolean).join(' ')}
        >
          <IconWarning size={22} />
          <span className={styles.tabLabel}>{t('melden')}</span>
        </Link>
        <button
          type="button"
          className={[styles.tab, meerOpen ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setMeerOpen(true)}
          aria-haspopup="dialog"
        >
          <IconMoreHorizontal size={22} />
          <span className={styles.tabLabel}>{t('meer')}</span>
        </button>
      </nav>
      <MeerSheet role={role} siteType={siteType} open={meerOpen} onClose={() => setMeerOpen(false)} />
    </>
  );
}
