'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  IconHome, IconFileText, IconWarning, IconMoreHorizontal, IconCheck, IconCart,
} from '@/components/ui/icons';
import { MeerSheet } from '@/components/layout/BottomNav/MeerSheet';
import type { UserRole } from '@/components/layout/BottomNav/BottomNav';
import styles from './DesktopNav.module.scss';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function DesktopNav({ role, siteType = 'wasstraat' }: { role: UserRole; siteType?: 'wasstraat' | 'selfcarwash' }) {
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
        <div className={styles.inner}>
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={[styles.pill, isActive(pathname, tab.href) ? styles.active : ''].filter(Boolean).join(' ')}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  // Selfcarwash owners/developers have no wagen-based weekly ingave — the
  // slot becomes a shortcut to voorraad (Leveringen) instead.
  const ingaveHref = role === 'employee' ? '/dagfiche' : siteType === 'selfcarwash' ? '/leveringen' : '/wekelijkse-ingave';
  const ingaveLabel = role !== 'employee' && siteType === 'selfcarwash' ? t('leveringen') : t('ingave');

  return (
    <>
      <nav className={styles.nav} aria-label={t('hoofdnavigatie')}>
        <div className={styles.inner}>
          <Link href="/" className={[styles.pill, isActive(pathname, '/') ? styles.active : ''].filter(Boolean).join(' ')}>
            <IconHome size={16} />
            <span>{t('dashboard')}</span>
          </Link>
          <Link
            href={ingaveHref}
            className={[styles.pill, isActive(pathname, ingaveHref) ? styles.active : ''].filter(Boolean).join(' ')}
          >
            <IconFileText size={16} />
            <span>{ingaveLabel}</span>
          </Link>
          <Link
            href="/incidenten"
            className={[styles.pill, isActive(pathname, '/incidenten') ? styles.active : ''].filter(Boolean).join(' ')}
          >
            <IconWarning size={16} />
            <span>{t('melden')}</span>
          </Link>
          <button
            type="button"
            className={[styles.pill, meerOpen ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => setMeerOpen(true)}
            aria-haspopup="dialog"
          >
            <IconMoreHorizontal size={16} />
            <span>{t('meer')}</span>
          </button>
        </div>
      </nav>
      <MeerSheet role={role} siteType={siteType} open={meerOpen} onClose={() => setMeerOpen(false)} />
    </>
  );
}
