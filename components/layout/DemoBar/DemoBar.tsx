'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './DemoBar.module.scss';

const ROLES = [
  { key: 'owner', labelKey: 'demoEigenaar' },
  { key: 'technician', labelKey: 'demoTechnieker' },
  { key: 'employee', labelKey: 'demoWerknemer' },
] as const;

export function DemoBar({ role }: { role: string }) {
  const t = useTranslations('layout');
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  async function switchTo(next: string) {
    if (next === role || busy) return;
    setBusy(next);
    try {
      const res = await fetch('/api/demo/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: next }),
      });
      if (res.ok) window.location.href = '/';
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <button type="button" className={styles.collapsed} onClick={() => setOpen(true)} aria-label={t('toonDemoBalk')}>
        DEMO
      </button>
    );
  }

  return (
    <div className={styles.bar} role="region" aria-label={t('demoOmgeving')}>
      <span className={styles.tag}>DEMO<span className={styles.tagLong}>{` · ${t('alleenLezen')}`}</span></span>
      <div className={styles.roles}>
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            className={[styles.roleBtn, role === r.key ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => switchTo(r.key)}
            disabled={busy !== null}
          >
            {busy === r.key ? '…' : t(r.labelKey)}
          </button>
        ))}
      </div>
      <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label={t('verbergDemoBalk')}>×</button>
    </div>
  );
}
