'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import styles from './HistoryDeleteButton.module.scss';

export function HistoryDeleteButton({ url, label }: { url: string; label: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!confirm(`"${label}" verwijderen? De voorraad wordt aangepast.`)) return;
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        showToast('Verwijderd');
        router.refresh();
      } else {
        showToast(res.status === 403 ? 'Enkel wie dit ingaf of een beheerder kan dit verwijderen' : 'Mislukt, probeer opnieuw');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={styles.btn} onClick={handleClick} disabled={busy}>
      {busy ? '...' : 'Verwijder'}
    </button>
  );
}
