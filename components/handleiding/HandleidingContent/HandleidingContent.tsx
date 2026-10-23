'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import styles from './HandleidingContent.module.scss';

interface Props {
  role: 'developer' | 'owner' | 'employee' | 'technician';
  siteParam: string;
  fromLogin: boolean;
}

interface Section {
  id: string;
  icon: string;
  title: string;
  badge?: string;
  badgeVariant?: 'blue' | 'green';
  roles: ('developer' | 'owner' | 'employee' | 'technician')[];
  content: React.ReactNode;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[styles.chevron, open ? styles.chevronOpen : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ButtonItem({ tag, desc }: { tag: string; desc: string }) {
  return (
    <div className={styles.buttonItem}>
      <span className={styles.buttonTag}>{tag}</span>
      <span className={styles.buttonDesc}>{desc}</span>
    </div>
  );
}

export function HandleidingContent({ role, siteParam, fromLogin }: Props) {
  const router = useRouter();
  const t = useTranslations('handleiding');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState<Record<string, boolean>>({ dashboard: true });
  const [navigating, setNavigating] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleContinue() {
    setNavigating(true);
    await fetch('/api/handleiding', { method: 'POST' });
    const dest = siteParam ? `/?site=${siteParam}` : '/';
    router.push(dest);
    router.refresh();
  }

  async function handleDontShowChange(checked: boolean) {
    setDontShow(checked);
    if (checked) {
      await fetch('/api/handleiding', { method: 'POST' });
      setSaved(true);
    }
  }

  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Standard section body: "Wat is dit?" paragraph + list of buttons, all from handleiding.sections.<key>
  function standardContent(key: string, buttons: string[]) {
    return (
      <>
        <div className={styles.subSection}>
          <span className={styles.subTitle}>{t('watIsDit')}</span>
          <p className={styles.text}>{t(`sections.${key}.text`)}</p>
        </div>
        <div className={styles.subSection}>
          <span className={styles.subTitle}>{t('knoppenActies')}</span>
          <div className={styles.buttonList}>
            {buttons.map((b) => (
              <ButtonItem key={b} tag={t(`sections.${key}.buttons.${b}.tag`)} desc={t(`sections.${key}.buttons.${b}.desc`)} />
            ))}
          </div>
        </div>
      </>
    );
  }

  const sections: Section[] = [
    {
      id: 'dashboard',
      icon: '📊',
      title: t('sections.dashboard.title'),
      badge: '/',
      roles: ['developer', 'owner', 'employee'],
      content: standardContent('dashboard', ['siteSelector', 'periode', 'prijsEenheid', 'accountIcoon', 'alertKaarten']),
    },
    {
      id: 'dagfiche',
      icon: '📋',
      title: t('sections.dagfiche.title'),
      badge: '/dagfiche',
      roles: ['developer', 'owner', 'employee'],
      content: standardContent('dagfiche', ['programmaTeller', 'verbruik', 'opmerking', 'versturen']),
    },
    {
      id: 'wekelijkse-ingave',
      icon: '📅',
      title: t('sections.wekelijkseIngave.title'),
      badge: 'Full options',
      badgeVariant: 'blue',
      roles: ['developer', 'owner'],
      content: standardContent('wekelijkseIngave', ['weekSelecteren', 'wasaantallen', 'verbruik', 'opslaan', 'bewerken']),
    },
    {
      id: 'historiek',
      icon: '🕰️',
      title: t('sections.historiek.title'),
      badge: 'Full options',
      badgeVariant: 'blue',
      roles: ['developer', 'owner'],
      content: standardContent('historiek', ['weekRij', 'weergave', 'periode', 'bewerkenVerwijderen']),
    },
    {
      id: 'incidenten',
      icon: '🚨',
      title: t('sections.incidenten.title'),
      badge: '/incidenten',
      roles: ['developer', 'owner', 'employee'],
      content: standardContent('incidenten', ['ehbo', 'schade', 'incidentKaart', 'tabs']),
    },
    {
      id: 'account',
      icon: '⚙️',
      title: t('sections.account.title'),
      badge: '/account',
      roles: ['developer', 'owner', 'employee'],
      content: standardContent('account', ['email', 'wachtwoord', 'kostprijzen', 'gebruikers', 'voorraad', 'onderhoud', 'energiefacturen', 'handleiding']),
    },
    ...(role === 'developer'
      ? [
          {
            id: 'developer',
            icon: '🛠️',
            title: t('sections.developer.title'),
            badge: 'Developer',
            badgeVariant: 'green' as const,
            roles: ['developer'] as ('developer' | 'owner' | 'employee' | 'technician')[],
            content: standardContent('developer', ['sites', 'wasprogrammas', 'onderhoudstaken', 'seed']),
          },
        ]
      : []),
    {
      id: 'navigatie',
      icon: '🧭',
      title: t('sections.navigatie.title'),
      roles: ['developer', 'owner', 'employee'],
      content: (
        <>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>{t('sections.navigatie.navigerenTitle')}</span>
            <div className={styles.buttonList}>
              {['terug', 'siteSelector', 'accountIcoon'].map((b) => (
                <ButtonItem key={b} tag={t(`sections.navigatie.buttons.${b}.tag`)} desc={t(`sections.navigatie.buttons.${b}.desc`)} />
              ))}
            </div>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>{t('sections.navigatie.installerenTitle')}</span>
            <p className={styles.text}>{t('sections.navigatie.installerenText')}</p>
          </div>
          <div className={styles.subSection}>
            <span className={styles.subTitle}>{t('sections.navigatie.pushTitle')}</span>
            <p className={styles.text}>{t('sections.navigatie.pushText')}</p>
          </div>
        </>
      ),
    },
  ];

  const visibleSections = sections.filter((s) => s.roles.includes(role));

  return (
    <div className={styles.wrap}>
      <div className={styles.introBanner}>
        <h1 className={styles.introTitle}>{t('introTitle')}</h1>
        <p className={styles.introSubtitle}>
          {t('introSubtitle')}
        </p>
      </div>

      {visibleSections.map((section) => (
        <div key={section.id} className={styles.card}>
          <div
            className={styles.cardHeader}
            onClick={() => toggle(section.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && toggle(section.id)}
            aria-expanded={!!open[section.id]}
          >
            <span className={styles.cardIcon} aria-hidden="true">{section.icon}</span>
            <span className={styles.cardTitle}>{section.title}</span>
            {section.badge && (
              <span className={[styles.cardBadge, section.badgeVariant === 'green' ? styles.cardBadgeGreen : ''].filter(Boolean).join(' ')}>
                {section.badge}
              </span>
            )}
            <ChevronIcon open={!!open[section.id]} />
          </div>
          {open[section.id] && (
            <div className={styles.cardBody}>
              {section.content}
            </div>
          )}
        </div>
      ))}

      <div className={styles.footerActions}>
        <label className={styles.dontShowLabel}>
          <input
            type="checkbox"
            className={styles.dontShowCheck}
            checked={dontShow}
            onChange={(e) => handleDontShowChange(e.target.checked)}
          />
          {t('nietMeerTonen')}
          {saved && <span className={styles.savedHint}>{t('opgeslagen')}</span>}
        </label>

        {fromLogin ? (
          <button
            className={styles.continueBtn}
            onClick={handleContinue}
            disabled={navigating}
          >
            {navigating ? tCommon('bezig') : t('begrepen')}
          </button>
        ) : (
          <Link
            href={siteParam ? `/?site=${siteParam}` : '/'}
            className={styles.backBtn}
          >
            {t('terugDashboard')}
          </Link>
        )}
      </div>
    </div>
  );
}
