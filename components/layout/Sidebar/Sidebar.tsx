'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navSections, workspaceName, workspaceSubtitle } from '@/lib/mock-data/navigation';
import type { NavItem } from '@/lib/mock-data/navigation';
import { DynamicIcon, IconChevronLeft, IconBox } from '@/components/ui/icons';
import styles from './Sidebar.module.scss';

export interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleCollapse: () => void;
  onMobileClose: () => void;
}

function NavLink({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      className={[styles.navLink, isActive ? styles.active : ''].filter(Boolean).join(' ')}
      title={isCollapsed ? item.label : undefined}
    >
      <span className={styles.navIcon}>
        <DynamicIcon name={item.iconName} size={18} />
      </span>
      {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
      {!isCollapsed && item.badge !== undefined && (
        <span className={styles.navBadge}>{item.badge}</span>
      )}
      {isCollapsed && item.badge !== undefined && (
        <span className={styles.collapsedBadge} aria-label={`${item.badge} alerts`} />
      )}
    </Link>
  );
}

export function Sidebar({ isCollapsed, isMobileOpen, onToggleCollapse, onMobileClose }: SidebarProps) {
  return (
    <>
      {isMobileOpen && (
        <div className={styles.overlay} onClick={onMobileClose} aria-hidden="true" />
      )}

      <aside
        className={[
          styles.sidebar,
          isCollapsed ? styles.collapsed : '',
          isMobileOpen ? styles.mobileOpen : '',
        ].filter(Boolean).join(' ')}
        aria-label="Main navigation"
      >
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}><IconBox size={20} /></span>
            {!isCollapsed && (
              <div className={styles.logoText}>
                <span className={styles.workspaceName}>{workspaceName}</span>
                <span className={styles.workspaceSubtitle}>{workspaceSubtitle}</span>
              </div>
            )}
          </div>
          <button
            className={styles.collapseBtn}
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconChevronLeft size={16} />
          </button>
        </div>

        <nav className={styles.nav}>
          {navSections.map((section, idx) => (
            <div key={idx} className={styles.navSection}>
              {section.title && !isCollapsed && (
                <span className={styles.sectionTitle}>{section.title}</span>
              )}
              {section.items.map(item => (
                <NavLink key={item.id} item={item} isCollapsed={isCollapsed} />
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.userCard}>
            <span className={styles.avatar} aria-hidden="true">AM</span>
            {!isCollapsed && (
              <div className={styles.userInfo}>
                <span className={styles.userName}>Alec Meganck</span>
                <span className={styles.userRole}>Admin</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
