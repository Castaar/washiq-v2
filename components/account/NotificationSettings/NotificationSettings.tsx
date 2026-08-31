'use client';

import { useEffect, useState } from 'react';
import { registerPushSubscription, requestAndRegisterPush } from '@/lib/pushClient';
import styles from './NotificationSettings.module.scss';

type Status = 'checking' | 'unsupported' | 'default' | 'granted' | 'denied';

export function NotificationSettings() {
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
      if (permission === 'granted') setMessage('Meldingen zijn ingeschakeld.');
    } catch {
      setMessage('Inschakelen mislukt — probeer opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResync() {
    setBusy(true);
    setMessage('');
    try {
      await registerPushSubscription();
      setMessage('Meldingen opnieuw geactiveerd op dit toestel.');
    } catch {
      setMessage('Opnieuw registreren mislukt — probeer opnieuw.');
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
            <span className={styles.dot} aria-hidden="true" /> Meldingen staan aan
          </p>
          <button type="button" className={styles.linkBtn} onClick={handleResync} disabled={busy}>
            {busy ? 'Bezig...' : 'Opnieuw activeren op dit toestel'}
          </button>
        </>
      )}

      {status === 'default' && (
        <>
          <p className={styles.hint}>Je krijgt nu geen meldingen (nieuwe incidenten, defecten, ...).</p>
          <button type="button" className={styles.enableBtn} onClick={handleEnable} disabled={busy}>
            {busy ? 'Bezig...' : '🔔 Meldingen inschakelen'}
          </button>
        </>
      )}

      {status === 'denied' && (
        <div className={styles.deniedBox}>
          <p className={styles.hint}>
            Meldingen staan geblokkeerd voor deze app. Dit kan de app niet zelf herstellen — je moet dit aanzetten
            via je toestel:
          </p>
          <ul className={styles.steps}>
            <li><strong>iOS/iPadOS:</strong> Instellingen → scroll naar "WashIQ" → Meldingen → aanzetten.</li>
            <li><strong>Android:</strong> lang drukken op het WashIQ-icoon → App-info → Meldingen → aanzetten.</li>
            <li><strong>macOS:</strong> Systeeminstellingen → Meldingen → WashIQ → aanzetten.</li>
            <li><strong>Windows:</strong> Instellingen → Systeem → Meldingen → WashIQ → aanzetten.</li>
            <li><strong>In een browsertab (niet-geïnstalleerd):</strong> klik het slotje naast de adresbalk → Site-instellingen → Meldingen → Toestaan.</li>
          </ul>
        </div>
      )}

      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}
