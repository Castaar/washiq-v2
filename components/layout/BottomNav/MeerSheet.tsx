'use client';

import Link from 'next/link';
import { BottomSheet } from '@/components/ui/BottomSheet/BottomSheet';
import {
  IconBarChart, IconClipboard, IconCalendar, IconGrid, IconUser,
  IconSettings, IconMessageSquare, IconCheck, IconWrench, IconCart, IconBox,
} from '@/components/ui/icons';
import type { UserRole } from './BottomNav';
import styles from './MeerSheet.module.scss';

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

  return (
    <BottomSheet open={open} onClose={onClose} title="Meer">
      <div className={styles.grid}>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={styles.item} onClick={onClose}>
            <span className={styles.iconCircle}><link.icon size={19} /></span>
            <span className={styles.label}>{link.label}</span>
          </Link>
        ))}
      </div>
    </BottomSheet>
  );
}
