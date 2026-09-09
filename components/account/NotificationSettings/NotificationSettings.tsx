'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { registerPushSubscription, requestAndRegisterPush } from '@/lib/pushClient';
import styles from './NotificationSettings.module.scss';

type Status = 'checking' | 'unsupported' | 'default' | 'granted' | 'denied';

export function NotificationSettings() {
  const t = useTranslations('notificaties');
  const tCommon = useTranslations('common');
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus(Notification.permission as Status);
  }, []);

  async function handleEnable() {
    setBusy(true);
    setMessage('');
    try {
      const permission = await requestAndRegisterPush();
      setStatus(permission as Status);
      if (permission === 'granted') setMessage(t('ingeschakeld'));
    } catch {
      setMessage(t('inschakelenMislukt'));
    } finally {
      setBusy(false);
    }
  }

  async function handleResync() {
    setBusy(true);
    setMessage('');
    try {
      await registerPushSubscription();
      setMessage(t('opnieuwGeactiveerd'));
    } catch {
      setMessage(t('opnieuwMislukt'));
    } finally {
      setBusy(false);
    }
  }

  if (status === 'checking' || status === 'unsupported') return null;

  return (
    <div className={styles.wrap}>
      {status === 'granted' && (
        <>
          <p className={styles.status}>
            <span className={styles.dot} aria-hidden="true" /> {t('staanAan')}
          </p>
          <button type="button" className={styles.linkBtn} onClick={handleResync} disabled={busy}>
            {busy ? tCommon('bezig') : t('opnieuwActiveren')}
          </button>
        </>
      )}

      {status === 'default' && (
        <>
          <p className={styles.hint}>{t('geenMeldingenNu')}</p>
          <button type="button" className={styles.enableBtn} onClick={handleEnable} disabled={busy}>
            {busy ? tCommon('bezig') : t('inschakelen')}
          </button>
        </>
      )}

      {status === 'denied' && (
        <div className={styles.deniedBox}>
          <p className={styles.hint}>
            {t('geblokkeerdIntro')}
          </p>
          <ul className={styles.steps}>
            <li>{t.rich('stapIos', { b: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('stapAndroid', { b: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('stapMacos', { b: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('stapWindows', { b: (chunks) => <strong>{chunks}</strong> })}</li>
            <li>{t.rich('stapBrowser', { b: (chunks) => <strong>{chunks}</strong> })}</li>
          </ul>
        </div>
      )}

      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}
