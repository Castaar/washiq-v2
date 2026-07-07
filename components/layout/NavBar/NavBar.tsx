import { Suspense } from 'react';
import Link from 'next/link';
import { carwashMeta } from '@/lib/mock-data/carwash';
import { IconChevronDown, IconChevronLeft, IconUser, IconSettings } from '@/components/ui/icons';
import { SiteSelector } from './SiteSelector';
import { ParamSelector } from './ParamSelector';
import { DatePicker } from './DatePicker';
import { LogoutButton } from './LogoutButton';
import styles from './NavBar.module.scss';

interface SelectorPillProps {
  label: string;
  value: string;
}

function SelectorPill({ label, value }: SelectorPillProps) {
  return (
    <button className={styles.pill} type="button">
      <span className={styles.pillLabel}>{label}</span>
      <span className={styles.pillDivider} aria-hidden="true" />
      <span className={styles.pillValue}>{value}</span>
      <IconChevronDown size={13} className={styles.pillArrow} />
    </button>
  );
}

interface Site {
  id: string;
  name: string;
  location: string;
}

interface NavBarProps {
  centerTitle?: string;
  sites?: Site[];
  activeSiteId?: string;
  activePeriod?: 'week' | 'month';
  activeView?: 'prijs' | 'liter';
  addHref?: string;
  addLabel?: string;
  backHref?: string;
  settingsHref?: string;
  activeDate?: string;
}

const PERIOD_OPTIONS = [
  { label: 'Maand', value: 'month' },
  { label: 'Week', value: 'week' },
];

const VIEW_OPTIONS = [
  { label: 'Prijs', value: 'prijs' },
  { label: 'Eenheid', value: 'liter' },
];

export function NavBar({ centerTitle, sites, activeSiteId, activePeriod, activeView, addHref, addLabel, backHref, settingsHref, activeDate }: NavBarProps) {
  const logoParams = new URLSearchParams();
  if (activeSiteId) logoParams.set('site', activeSiteId);
  if (activePeriod && activePeriod !== 'month') logoParams.set('period', activePeriod);
  if (activeView && activeView !== 'prijs') logoParams.set('view', activeView);
  const logoHref = logoParams.toString() ? `/?${logoParams.toString()}` : '/';

  return (
    <header className={styles.nav}>
      <div className={styles.leftGroup}>
        <Link href={logoHref} className={styles.logo}>
          <span className={styles.logoText}>WashIQ</span>
        </Link>
        {backHref && (
          <Link href={backHref} className={styles.backBtn}>
            <IconChevronLeft size={14} />
            Terug
          </Link>
        )}
      </div>

      <div className={styles.center}>
        {centerTitle ? (
          <span className={styles.pageTitle}>{centerTitle}</span>
        ) : (
          <div className={styles.selectors}>
            {sites && sites.length > 0 && activeSiteId ? (
              <Suspense fallback={
                <button className={styles.pill} type="button">
                  <span className={styles.pillLabel}>Carwash</span>
                  <span className={styles.pillDivider} aria-hidden="true" />
                  <span className={styles.pillValue}>{sites.find(s => s.id === activeSiteId)?.location ?? '—'}</span>
                </button>
              }>
                <SiteSelector sites={sites} activeSiteId={activeSiteId} />
              </Suspense>
            ) : (
              <SelectorPill label={carwashMeta.type} value={carwashMeta.location} />
            )}
            {activePeriod && (
              <span className={styles.hideMobile}>
                <Suspense fallback={<button className={styles.pill} type="button"><span className={styles.pillLabel}>Periode</span><span className={styles.pillDivider} aria-hidden="true" /><span className={styles.pillValue}>Maand</span></button>}>
                  <ParamSelector label="Periode" paramKey="period" options={PERIOD_OPTIONS} activeValue={activePeriod} />
                </Suspense>
              </span>
            )}
            {activeView && (
              <span className={styles.hideMobile}>
                <Suspense fallback={<button className={styles.pill} type="button"><span className={styles.pillLabel}>Weergave</span><span className={styles.pillDivider} aria-hidden="true" /><span className={styles.pillValue}>Prijs</span></button>}>
                  <ParamSelector label="Weergave" paramKey="view" options={VIEW_OPTIONS} activeValue={activeView} />
                </Suspense>
              </span>
            )}
            {activeDate && (
              <span className={styles.hideMobile}>
                <Suspense fallback={null}>
                  <DatePicker activeDate={activeDate} />
                </Suspense>
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {addHref && (
          <Link href={addHref} className={addLabel ? styles.addBtnLabel : styles.addBtn} aria-label={addLabel ?? 'Toevoegen'}>
            {addLabel ?? <span aria-hidden="true">+</span>}
          </Link>
        )}
        {settingsHref && (
          <Link href={settingsHref} className={styles.settingsBtn} aria-label="Instellingen">
            <IconSettings size={16} />
          </Link>
        )}
        <Link href="/account" className={styles.profileBtn} aria-label="Account">
          <IconUser size={16} />
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
