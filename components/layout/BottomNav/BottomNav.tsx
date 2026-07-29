'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconHome, IconFileText, IconWarning, IconMoreHorizontal, IconCheck, IconCart,
} from '@/components/ui/icons';
import { MeerSheet } from './MeerSheet';
import styles from './BottomNav.module.scss';

export type UserRole = 'developer' | 'owner' | 'employee' | 'technician';

interface BottomNavProps {
  role: UserRole;
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const [meerOpen, setMeerOpen] = useState(false);

  if (role === 'technician') {
    const tabs = [
      { href: '/technieker', label: 'Werklijst', icon: IconHome },
      { href: '/logboek', label: 'Logboek', icon: IconCheck },
      { href: '/leveringen', label: 'Leveringen', icon: IconCart },
      { href: '/account', label: 'Account', icon: IconFileText },
    ];
    return (
      <nav className={styles.nav} aria-label="Hoofdnavigatie">
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

  const ingaveHref = role === 'employee' ? '/dagfiche' : '/wekelijkse-ingave';

  return (
    <>
      <nav className={styles.nav} aria-label="Hoofdnavigatie">
        <Link href="/" className={[styles.tab, isActive(pathname, '/') ? styles.active : ''].filter(Boolean).join(' ')}>
          <IconHome size={22} />
          <span className={styles.tabLabel}>Dashboard</span>
        </Link>
        <Link
          href={ingaveHref}
          className={[styles.tab, isActive(pathname, ingaveHref) ? styles.active : ''].filter(Boolean).join(' ')}
        >
          <IconFileText size={22} />
          <span className={styles.tabLabel}>Ingave</span>
        </Link>
        <Link
          href="/incidenten"
          className={[styles.tab, isActive(pathname, '/incidenten') ? styles.active : ''].filter(Boolean).join(' ')}
        >
          <IconWarning size={22} />
          <span className={styles.tabLabel}>Melden</span>
        </Link>
        <button
          type="button"
          className={[styles.tab, meerOpen ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => setMeerOpen(true)}
          aria-haspopup="dialog"
        >
          <IconMoreHorizontal size={22} />
          <span className={styles.tabLabel}>Meer</span>
        </button>
      </nav>
      <MeerSheet role={role} open={meerOpen} onClose={() => setMeerOpen(false)} />
    </>
  );
}
