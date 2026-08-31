'use client';

import { useMemo, useState } from 'react';
import styles from './VertalingenPanel.module.scss';

export interface TranslationRow {
  key: string;
  section: string;
  nl: string;
  fr: string;
}

export function VertalingenPanel({ rows: initialRows }: { rows: TranslationRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function handleSave(key: string) {
    const value = drafts[key] ?? rows.find((r) => r.key === key)?.fr ?? '';
    setSaving(key);
    try {
      const res = await fetch('/api/translations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, fr: value.trim() } : r)));
        setDrafts((prev) => { const n = { ...prev }; delete n[key]; return n; });
        setSavedKey(key);
        setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
      }
    } finally {
      setSaving(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.nl.toLowerCase().includes(q) || r.fr.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
  }, [rows, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, TranslationRow[]>();
    for (const r of filtered) {
      if (!map.has(r.section)) map.set(r.section, []);
      map.get(r.section)!.push(r);
    }
    return map;
  }, [filtered]);

  const missingCount = rows.filter((r) => !r.fr).length;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <p className={styles.hint}>
          {rows.length} teksten — {missingCount > 0 ? `${missingCount} nog zonder Franse vertaling` : 'alles vertaald'}.
          Nieuwe producten, wasprogramma&apos;s en onderhoudstaken verschijnen hier automatisch zodra je ze aanmaakt.
        </p>
        <input
          className={styles.search}
          type="text"
          placeholder="Zoeken..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {[...grouped.entries()].map(([section, sectionRows]) => (
        <section key={section} className={styles.section}>
          <h2 className={styles.sectionTitle}>{section}</h2>
          <div className={styles.rows}>
            {sectionRows.map((r) => {
              const value = drafts[r.key] ?? r.fr;
              return (
                <div key={r.key} className={styles.row}>
                  <span className={styles.nl}>{r.nl}</span>
                  <input
                    className={styles.frInput}
                    type="text"
                    placeholder={r.nl}
                    value={value}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [r.key]: e.target.value }))}
                    onBlur={() => { if (drafts[r.key] !== undefined) handleSave(r.key); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  <span className={styles.status}>
                    {saving === r.key ? '...' : savedKey === r.key ? '✓' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
