'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import styles from './LanguageSwitcher.module.scss';

const LOCALE_COOKIE = 'dodane_locale';

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations('taal');
  const router = useRouter();

  function setLocale(next: 'nl' | 'fr') {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className={styles.wrap} role="group" aria-label={t('label')}>
      <button
        type="button"
        className={[styles.option, locale === 'nl' ? styles.active : ''].filter(Boolean).join(' ')}
        onClick={() => setLocale('nl')}
      >
        NL
      </button>
      <button
        type="button"
        className={[styles.option, locale === 'fr' ? styles.active : ''].filter(Boolean).join(' ')}
        onClick={() => setLocale('fr')}
      >
        FR
      </button>
    </div>
  );
}
