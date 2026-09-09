'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { ActivityEntry } from '@/lib/types/dashboard';
import styles from './ActivitySection.module.scss';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface ActivitySectionProps {
  refId: string;
  refType: string;
  siteId: string;
}

export function ActivitySection({ refId, refType, siteId }: ActivitySectionProps) {
  const t = useTranslations('activity');
  const actionLabels: Record<string, string> = {
    comment:   t('reactie'),
    completed: t('afgerond'),
    created:   t('aangemaakt'),
    updated:   t('bijgewerkt'),
  };
  const [entries, setEntries]       = useState<ActivityEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [text, setText]             = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetch(`/api/activity?refId=${encodeURIComponent(refId)}&refType=${encodeURIComponent(refType)}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<ActivityEntry[]>;
      })
      .then((data) => { setEntries(data); setLoading(false); })
      .catch(() => { setFetchError(t('konNietLaden')); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refId, refType]);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/activity', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refId, refType, siteId, text: trimmed }),
      });
      if (!res.ok) throw new Error();
      const newEntry = (await res.json()) as ActivityEntry;
      setEntries((prev) => [...prev, newEntry]);
      setText('');
    } catch {
      setSubmitError(t('opslaanMislukt'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.divider} />

      {/* ─── Historiek ─────────────────────────────────────── */}
      <p className={styles.sectionLabel}>{t('historiek')}</p>

      {loading && <p className={styles.muted}>{t('laden')}</p>}
      {fetchError && <p className={styles.errorText}>{fetchError}</p>}
      {!loading && !fetchError && entries.length === 0 && (
        <p className={styles.muted}>{t('nogGeenActiviteit')}</p>
      )}
      {!loading && !fetchError && entries.length > 0 && (
        <ul className={styles.entryList}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.entry}>
              <div className={styles.entryMeta}>
                <span className={styles.actionBadge}>
                  {actionLabels[entry.actionType] ?? entry.actionType}
                </span>
                {entry.performedByName && (
                  <span className={styles.entryAuthor}>{entry.performedByName}</span>
                )}
                <span className={styles.entryDate}>{formatDate(entry.createdAt)}</span>
              </div>
              <p className={styles.entryText}>{entry.text}</p>
            </li>
          ))}
        </ul>
      )}

      {/* ─── Add comment ───────────────────────────────────── */}
      <div className={styles.form}>
        <textarea
          className={styles.textarea}
          placeholder={t('reactiePlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={submitting}
        />
        {submitError && <p className={styles.errorText}>{submitError}</p>}
        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
        >
          {submitting ? t('opslaanBezig') : t('reactieToevoegen')}
        </button>
      </div>
    </div>
  );
}
