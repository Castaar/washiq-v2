'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BottomSheet } from '@/components/ui/BottomSheet/BottomSheet';
import {
  IconBarChart, IconClipboard, IconCalendar, IconGrid, IconUser,
  IconSettings, IconMessageSquare, IconCheck, IconWrench, IconCart, IconBox, IconDownload,
} from '@/components/ui/icons';
import type { UserRole } from './BottomNav';
import styles from './MeerSheet.module.scss';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface MeerLink {
  href: string;
  label: string;
  icon: typeof IconBarChart;
}

const OWNER_LINKS: MeerLink[] = [
  { href: '/historiek', label: 'Historiek', icon: IconBarChart },
  { href: '/opdrachten', label: 'Opdrachten', icon: IconClipboard },
  { href: '/planning', label: 'Planning', icon: IconCalendar },
  { href: '/logboek', label: 'Logboek', icon: IconCheck },
  { href: '/onderhouden', label: 'Onderhoud', icon: IconWrench },
  { href: '/leveringen', label: 'Leveringen', icon: IconCart },
  { href: '/diversen', label: 'Diversen', icon: IconGrid },
  { href: '/instellingen', label: 'Instellingen', icon: IconSettings },
  { href: '/account', label: 'Account', icon: IconUser },
  { href: '/handleiding', label: 'Handleiding', icon: IconMessageSquare },
];

const DEVELOPER_LINKS: MeerLink[] = [
  ...OWNER_LINKS,
  { href: '/developer', label: 'Developer paneel', icon: IconBox },
];

const EMPLOYEE_LINKS: MeerLink[] = [
  { href: '/logboek', label: 'Logboek', icon: IconCheck },
  { href: '/opdrachten', label: 'Opdrachten', icon: IconClipboard },
  { href: '/planning', label: 'Planning', icon: IconCalendar },
  { href: '/leveringen', label: 'Leveringen', icon: IconCart },
  { href: '/onderhouden', label: 'Onderhoud', icon: IconWrench },
  { href: '/diversen', label: 'Diversen', icon: IconGrid },
  { href: '/account', label: 'Account', icon: IconUser },
  { href: '/handleiding', label: 'Handleiding', icon: IconMessageSquare },
];

function linksForRole(role: UserRole): MeerLink[] {
  if (role === 'developer') return DEVELOPER_LINKS;
  if (role === 'owner') return OWNER_LINKS;
  return EMPLOYEE_LINKS;
}

export function MeerSheet({ role, open, onClose }: { role: UserRole; open: boolean; onClose: () => void }) {
  const links = linksForRole(role);

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

  return (
    <BottomSheet open={open} onClose={onClose} title="Meer">
      <div className={styles.grid}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={styles.item} onClick={onClose}>
            <span className={styles.iconCircle}><link.icon size={19} /></span>
            <span className={styles.label}>{link.label}</span>
          </Link>
        ))}
        {canInstall && (
          <button type="button" className={styles.item} onClick={handleInstall}>
            <span className={styles.iconCircle}><IconDownload size={19} /></span>
            <span className={styles.label}>App installeren</span>
          </button>
        )}
      </div>
      {showSafariTip && (
        <p className={styles.safariTip}>
          Op Safari: kies <strong>Bestand → Voeg toe aan Dock</strong> (macOS) of gebruik de deelknop → <strong>Zet op beginscherm</strong> (iOS).
        </p>
      )}
    </BottomSheet>
  );
}
