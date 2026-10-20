'use client';

import { useState } from 'react';
import styles from './DemoBar.module.scss';

const ROLES = [
  { key: 'owner', label: 'Eigenaar' },
  { key: 'technician', label: 'Technieker' },
  { key: 'employee', label: 'Werknemer' },
] as const;

export function DemoBar({ role }: { role: string }) {
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
      <button type="button" className={styles.collapsed} onClick={() => setOpen(true)} aria-label="Toon demo-balk">
        DEMO
      </button>
    );
  }

  return (
    <div className={styles.bar} role="region" aria-label="Demo-omgeving">
      <span className={styles.tag}>DEMO<span className={styles.tagLong}> · alleen lezen</span></span>
      <div className={styles.roles}>
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            className={[styles.roleBtn, role === r.key ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => switchTo(r.key)}
            disabled={busy !== null}
          >
            {busy === r.key ? '…' : r.label}
          </button>
        ))}
      </div>
      <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Verberg demo-balk">×</button>
    </div>
  );
}
