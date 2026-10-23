'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import styles from './HistoryDeleteButton.module.scss';

export function HistoryDeleteButton({ url, label }: { url: string; label: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const t = useTranslations('leveringenPagina');
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!confirm(t('confirmVerwijderen', { label }))) return;
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        showToast(t('verwijderd'));
        router.refresh();
      } else {
        showToast(res.status === 403 ? t('geenRechtVerwijderen') : t('misluktOpnieuw'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={styles.btn} onClick={handleClick} disabled={busy}>
      {busy ? '...' : t('verwijder')}
    </button>
  );
}
