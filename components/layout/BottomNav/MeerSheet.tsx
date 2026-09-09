'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/ui/BottomSheet/BottomSheet';
import {
  IconBarChart, IconClipboard, IconCalendar, IconGrid, IconUser,
  IconSettings, IconMessageSquare, IconCheck, IconWrench, IconCart, IconBox, IconDownload, IconGlobe, IconFileText, IconPackage,
} from '@/components/ui/icons';
import type { UserRole } from './BottomNav';
import styles from './MeerSheet.module.scss';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface MeerLink {
  href: string;
  labelKey: string;
  icon: typeof IconBarChart;
}

const OWNER_LINKS: MeerLink[] = [
  { href: '/historiek', labelKey: 'historiek', icon: IconBarChart },
  { href: '/opdrachten', labelKey: 'opdrachten', icon: IconClipboard },
  { href: '/planning', labelKey: 'planning', icon: IconCalendar },
  { href: '/logboek', labelKey: 'logboek', icon: IconCheck },
  { href: '/dagfiches', labelKey: 'dagfiches', icon: IconFileText },
  { href: '/onderhouden', labelKey: 'onderhoud', icon: IconWrench },
  { href: '/leveringen', labelKey: 'leveringen', icon: IconCart },
  { href: '/orders', labelKey: 'orders', icon: IconPackage },
  { href: '/diversen', labelKey: 'diversen', icon: IconGrid },
  { href: '/vertalingen', labelKey: 'vertalingen', icon: IconGlobe },
  { href: '/instellingen', labelKey: 'instellingen', icon: IconSettings },
  { href: '/account', labelKey: 'account', icon: IconUser },
  { href: '/handleiding', labelKey: 'handleiding', icon: IconMessageSquare },
];

const DEVELOPER_LINKS: MeerLink[] = [
  ...OWNER_LINKS,
  { href: '/developer', labelKey: 'developerPaneel', icon: IconBox },
];

const EMPLOYEE_LINKS: MeerLink[] = [
  { href: '/logboek', labelKey: 'logboek', icon: IconCheck },
  { href: '/opdrachten', labelKey: 'opdrachten', icon: IconClipboard },
  { href: '/planning', labelKey: 'planning', icon: IconCalendar },
  { href: '/leveringen', labelKey: 'leveringen', icon: IconCart },
  { href: '/onderhouden', labelKey: 'onderhoud', icon: IconWrench },
  { href: '/orders', labelKey: 'orders', icon: IconPackage },
  { href: '/diversen', labelKey: 'diversen', icon: IconGrid },
  { href: '/account', labelKey: 'account', icon: IconUser },
  { href: '/handleiding', labelKey: 'handleiding', icon: IconMessageSquare },
];

function linksForRole(role: UserRole, siteType: 'wasstraat' | 'selfcarwash'): MeerLink[] {
  const base = role === 'developer' ? DEVELOPER_LINKS : role === 'owner' ? OWNER_LINKS : EMPLOYEE_LINKS;
  // Selfcarwash sites don't track wagens — Historiek (weekly wagen entries) doesn't apply.
  return siteType === 'selfcarwash' ? base.filter((l) => l.href !== '/historiek') : base;
}

export function MeerSheet({ role, siteType = 'wasstraat', open, onClose }: { role: UserRole; siteType?: 'wasstraat' | 'selfcarwash'; open: boolean; onClose: () => void }) {
  const t = useTranslations('nav');
  const links = linksForRole(role, siteType);

  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isSafari, setIsSafari] = useState(false);
  const [showSafariTip, setShowSafariTip] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (installPrompt) {
      (installPrompt as BeforeInstallPromptEvent).prompt();
      const { outcome } = await (installPrompt as BeforeInstallPromptEvent).userChoice;
      if (outcome === 'accepted') setInstallPrompt(null);
    } else if (isSafari) {
      setShowSafariTip((v) => !v);
    }
  }

  const canInstall = !isStandalone && (installPrompt || isSafari);
  const tLogin = useTranslations('login');

  return (
    <BottomSheet open={open} onClose={onClose} title={t('meer')}>
      <div className={styles.grid}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={styles.item} onClick={onClose}>
            <span className={styles.iconCircle}><link.icon size={19} /></span>
            <span className={styles.label}>{t(link.labelKey)}</span>
          </Link>
        ))}
        {canInstall && (
          <button type="button" className={styles.item} onClick={handleInstall}>
            <span className={styles.iconCircle}><IconDownload size={19} /></span>
            <span className={styles.label}>{tLogin('appInstalleren')}</span>
          </button>
        )}
      </div>
      {showSafariTip && (
        <p className={styles.safariTip}>
          {tLogin.rich('safariTip', { b: (chunks) => <strong>{chunks}</strong> })}
        </p>
      )}
    </BottomSheet>
  );
}
