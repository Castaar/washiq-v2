'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import styles from './LoginForm.module.scss';
import { IconEye, IconEyeOff } from '@/components/ui/icons';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher/LanguageSwitcher';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Site {
  id: string;
  name: string;
}

interface LoginFormProps {
  sites: Site[];
}

export function LoginForm({ sites }: LoginFormProps) {
  const router = useRouter();
  const t = useTranslations('login');
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isSafari, setIsSafari] = useState(false);
  const [showSafariTip, setShowSafariTip] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    const ua = navigator.userAgent;
    setIsSafari(/^((?!chrome|android).)*safari/i.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    (installPrompt as BeforeInstallPromptEvent).prompt();
    const { outcome } = await (installPrompt as BeforeInstallPromptEvent).userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password }),
      });
      if (res.ok) {
        const data = await res.json() as { role: string; siteIds: string[]; helpSeen: boolean };
        // Pick the site to land on: selected > first in account > none
        const landingSite = siteId || data.siteIds?.[0] || '';
        if (!data.helpSeen) {
          const dest = landingSite ? `/handleiding?site=${landingSite}` : '/handleiding';
          router.replace(dest);
        } else {
          let dest: string;
          if (data.role === 'technician') {
            dest = '/technieker';
          } else if (data.role === 'employee') {
            dest = landingSite ? `/dagfiche?site=${landingSite}` : '/dagfiche';
          } else {
            dest = landingSite ? `/?site=${landingSite}` : '/';
          }
          router.replace(dest);
        }
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || t('foutOnjuist'));
      }
    } catch {
      setError(t('foutVerbinding'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.logoArea}>
        <span className={styles.logoText}>WashIQ</span>
      </div>

      {sites.length > 1 && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>{t('locatieSite')}</label>
          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">{t('selecteerCarwash')}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className={styles.selectArrow} aria-hidden="true">▾</span>
          </div>
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.label}>{t('gebruikersnaam')}</label>
        <input
          className={styles.input}
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>{t('wachtwoord')}</label>
        <div className={styles.passwordWrap}>
          <input
            className={styles.input}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? t('wachtwoordVerbergen') : t('wachtwoordTonen')}
          >
            {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? t('bezig') : t('inloggen')}
      </button>

      {!isStandalone && installPrompt && (
        <button type="button" className={styles.installBtn} onClick={handleInstall}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {t('appInstalleren')}
        </button>
      )}
      {!isStandalone && !installPrompt && isSafari && (
        <div className={styles.safariInstall}>
          <button type="button" className={styles.installBtn} onClick={() => setShowSafariTip((v) => !v)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t('appInstalleren')}
          </button>
          {showSafariTip && (
            <p className={styles.safariTip}>
              {t.rich('safariTip', { b: (chunks) => <strong>{chunks}</strong> })}
            </p>
          )}
        </div>
      )}

      <LanguageSwitcher />
    </form>
  );
}
