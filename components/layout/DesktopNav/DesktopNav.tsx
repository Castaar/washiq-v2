'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconHome, IconFileText, IconWarning, IconBarChart, IconClipboard, IconCalendar,
  IconGrid, IconSettings, IconCheck, IconWrench, IconCart, IconUser, IconBox,
} from '@/components/ui/icons';
import type { UserRole } from '@/components/layout/BottomNav/BottomNav';
import styles from './DesktopNav.module.scss';

interface NavLink {
  href: string;
  label: string;
  icon: typeof IconHome;
}

const OWNER_LINKS: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: IconHome },
  { href: '/wekelijkse-ingave', label: 'Ingave', icon: IconFileText },
  { href: '/incidenten', label: 'Melden', icon: IconWarning },
  { href: '/historiek', label: 'Historiek', icon: IconBarChart },
  { href: '/opdrachten', label: 'Opdrachten', icon: IconClipboard },
  { href: '/planning', label: 'Planning', icon: IconCalendar },
  { href: '/logboek', label: 'Logboek', icon: IconCheck },
  { href: '/onderhouden', label: 'Onderhoud', icon: IconWrench },
  { href: '/leveringen', label: 'Leveringen', icon: IconCart },
  { href: '/diversen', label: 'Diversen', icon: IconGrid },
  { href: '/instellingen', label: 'Instellingen', icon: IconSettings },
  { href: '/account', label: 'Account', icon: IconUser },
];

const DEVELOPER_LINKS: NavLink[] = [
  ...OWNER_LINKS,
  { href: '/developer', label: 'Developer', icon: IconBox },
];

const EMPLOYEE_LINKS: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: IconHome },
  { href: '/dagfiche', label: 'Dagfiche', icon: IconFileText },
  { href: '/incidenten', label: 'Melden', icon: IconWarning },
  { href: '/opdrachten', label: 'Opdrachten', icon: IconClipboard },
  { href: '/planning', label: 'Planning', icon: IconCalendar },
  { href: '/logboek', label: 'Logboek', icon: IconCheck },
  { href: '/onderhouden', label: 'Onderhoud', icon: IconWrench },
  { href: '/leveringen', label: 'Leveringen', icon: IconCart },
  { href: '/diversen', label: 'Diversen', icon: IconGrid },
  { href: '/account', label: 'Account', icon: IconUser },
];

const TECHNICIAN_LINKS: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: IconHome },
  { href: '/technieker', label: 'Werklijst', icon: IconWrench },
  { href: '/logboek', label: 'Logboek', icon: IconCheck },
  { href: '/leveringen', label: 'Leveringen', icon: IconCart },
  { href: '/account', label: 'Account', icon: IconUser },
];

function linksForRole(role: UserRole): NavLink[] {
  if (role === 'developer') return DEVELOPER_LINKS;
  if (role === 'owner') return OWNER_LINKS;
  if (role === 'technician') return TECHNICIAN_LINKS;
  return EMPLOYEE_LINKS;
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function DesktopNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const links = linksForRole(role);

  return (
    <nav className={styles.nav} aria-label="Desktopnavigatie">
      <div className={styles.inner}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={[styles.pill, isActive(pathname, link.href) ? styles.active : ''].filter(Boolean).join(' ')}
          >
            <link.icon size={15} />
            <span>{link.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
