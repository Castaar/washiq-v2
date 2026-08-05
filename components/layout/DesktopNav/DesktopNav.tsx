'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

export function DesktopNav({ role }: { role: UserRole }) {
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
      <nav className={styles.nav} aria-label="Desktopnavigatie">
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

  const ingaveHref = role === 'employee' ? '/dagfiche' : '/wekelijkse-ingave';

  return (
    <>
      <nav className={styles.nav} aria-label="Desktopnavigatie">
        <div className={styles.inner}>
          <Link href="/" className={[styles.pill, isActive(pathname, '/') ? styles.active : ''].filter(Boolean).join(' ')}>
            <IconHome size={16} />
            <span>Dashboard</span>
          </Link>
          <Link
            href={ingaveHref}
            className={[styles.pill, isActive(pathname, ingaveHref) ? styles.active : ''].filter(Boolean).join(' ')}
          >
            <IconFileText size={16} />
            <span>Ingave</span>
          </Link>
          <Link
            href="/incidenten"
            className={[styles.pill, isActive(pathname, '/incidenten') ? styles.active : ''].filter(Boolean).join(' ')}
          >
            <IconWarning size={16} />
            <span>Melden</span>
          </Link>
          <button
            type="button"
            className={[styles.pill, meerOpen ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => setMeerOpen(true)}
            aria-haspopup="dialog"
          >
            <IconMoreHorizontal size={16} />
            <span>Meer</span>
          </button>
        </div>
      </nav>
      <MeerSheet role={role} open={meerOpen} onClose={() => setMeerOpen(false)} />
    </>
  );
}
