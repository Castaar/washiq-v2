'use client';

import { IconSearch, IconBell, IconFilter, IconCalendar, IconMenu } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button/Button';
import styles from './TopBar.module.scss';

export interface TopBarProps {
  onMobileMenuOpen: () => void;
}

const pageTitle = 'Overview';
const dateRange = 'Apr 14 – Apr 20, 2026';
const unreadAlerts = 3;

export function TopBar({ onMobileMenuOpen }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <button
          className={styles.mobileMenuBtn}
          onClick={onMobileMenuOpen}
          aria-label="Open navigation menu"
        >
          <IconMenu size={20} />
        </button>
        <div className={styles.titleGroup}>
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
          <span className={styles.liveIndicator} aria-label="Live data">
            <span className={styles.liveDot} aria-hidden="true" />
            Live
          </span>
        </div>
      </div>

      <div className={styles.center}>
        <label className={styles.searchWrap} htmlFor="global-search">
          <IconSearch size={15} className={styles.searchIcon} />
          <input
            id="global-search"
            type="search"
            placeholder="Search products, SKUs, orders…"
            className={styles.searchInput}
          />
        </label>
      </div>

      <div className={styles.right}>
        <Button variant="ghost" size="sm" iconLeft={<IconCalendar size={14} />}>
          {dateRange}
        </Button>
        <Button variant="secondary" size="sm" iconLeft={<IconFilter size={14} />}>
          Filters
        </Button>
        <div className={styles.divider} />
        <button className={styles.iconBtn} aria-label={`${unreadAlerts} unread alerts`}>
          <IconBell size={18} />
          {unreadAlerts > 0 && (
            <span className={styles.alertBadge} aria-hidden="true">{unreadAlerts}</span>
          )}
        </button>
        <button className={styles.avatarBtn} aria-label="User menu">
          <span className={styles.avatar} aria-hidden="true">AM</span>
        </button>
      </div>
    </header>
  );
}
