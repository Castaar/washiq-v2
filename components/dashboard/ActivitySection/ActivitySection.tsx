'use client';

import { useState, useEffect } from 'react';
import type { ActivityEntry } from '@/lib/types/dashboard';
import styles from './ActivitySection.module.scss';

const actionLabels: Record<string, string> = {
  comment:   'Reactie',
  completed: 'Afgerond',
  created:   'Aangemaakt',
  updated:   'Bijgewerkt',
};

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
      .catch(() => { setFetchError('Kon historiek niet laden.'); setLoading(false); });
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
      setSubmitError('Opslaan mislukt. Probeer opnieuw.');
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
      <p className={styles.sectionLabel}>Historiek</p>

      {loading && <p className={styles.muted}>Laden…</p>}
      {fetchError && <p className={styles.errorText}>{fetchError}</p>}
      {!loading && !fetchError && entries.length === 0 && (
        <p className={styles.muted}>Nog geen activiteit.</p>
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
          placeholder="Voeg een reactie toe… (Ctrl+Enter om op te slaan)"
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
          {submitting ? 'Opslaan…' : 'Reactie toevoegen'}
        </button>
      </div>
    </div>
  );
}
