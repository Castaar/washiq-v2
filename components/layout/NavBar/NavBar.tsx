import { Suspense } from 'react';
import Link from 'next/link';
import { IconChevronLeft, IconUser, IconSettings } from '@/components/ui/icons';
import { SiteSelector } from './SiteSelector';
import { LogoutButton } from './LogoutButton';
import styles from './NavBar.module.scss';

interface Site {
  id: string;
  name: string;
  location: string;
}

interface NavBarProps {
  centerTitle?: string;
  sites?: Site[];
  activeSiteId?: string;
  addHref?: string;
  addLabel?: string;
  backHref?: string;
  settingsHref?: string;
}

export function NavBar({ centerTitle, sites, activeSiteId, addHref, addLabel, backHref, settingsHref }: NavBarProps) {
  return (
    <header className={styles.nav}>
      <div className={styles.left}>
        {backHref ? (
          <Link href={backHref} className={styles.backBtn} aria-label="Terug">
            <IconChevronLeft size={18} />
          </Link>
        ) : (
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark}>W</span>
          </Link>
        )}
        <div className={styles.titleGroup}>
          {centerTitle ? (
            <span className={styles.pageTitle}>{centerTitle}</span>
          ) : (
            <>
              <span className={styles.brandText}>WashIQ</span>
              {sites && sites.length > 0 && activeSiteId ? (
                <Suspense fallback={<span className={styles.siteFallback}>{sites.find((s) => s.id === activeSiteId)?.location ?? '—'}</span>}>
                  <SiteSelector sites={sites} activeSiteId={activeSiteId} />
                </Suspense>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        {addHref && (
          <Link href={addHref} className={styles.addBtn} aria-label={addLabel ?? 'Toevoegen'}>
            <span aria-hidden="true">+</span>
          </Link>
        )}
        {settingsHref && (
          <Link href={settingsHref} className={styles.iconBtn} aria-label="Instellingen">
            <IconSettings size={16} />
          </Link>
        )}
        <Link href="/account" className={styles.avatar} aria-label="Account">
          <IconUser size={15} />
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
