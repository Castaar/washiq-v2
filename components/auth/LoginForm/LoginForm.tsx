'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './LoginForm.module.scss';

interface Site {
  id: string;
  name: string;
}

interface LoginFormProps {
  sites: Site[];
}

export function LoginForm({ sites }: LoginFormProps) {
  const router = useRouter();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        const data = await res.json() as { role: string; siteIds: string[] };
        // Pick the site to land on: selected > first in account > none
        const landingSite = siteId || data.siteIds?.[0] || '';
        const dest = landingSite ? `/?site=${landingSite}` : '/';
        router.push(dest);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || 'Gebruikersnaam of wachtwoord onjuist');
      }
    } catch {
      setError('Verbindingsfout. Probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.logoArea}>
        <span className={styles.logoText}>WashIQ</span>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Locatie / site</label>
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">Selecteer uw carwash...</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className={styles.selectArrow} aria-hidden="true">▾</span>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Gebruikersnaam</label>
        <input
          className={styles.input}
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Wachtwoord</label>
        <input
          className={styles.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? 'Bezig...' : 'Inloggen'}
      </button>
    </form>
  );
}
