'use client';

import { useState } from 'react';
import styles from './AnnouncementBanner.module.scss';

export interface AnnouncementItem {
  id: string;
  text: string;
  created_by_name: string;
  is_all_sites: boolean;
  created_at: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
}

export function AnnouncementBanner({
  siteId,
  initialAnnouncements,
  canManage,
}: {
  siteId: string;
  initialAnnouncements: AnnouncementItem[];
  canManage: boolean;
}) {
  const [items, setItems] = useState(initialAnnouncements);
  const [text, setText] = useState('');
  const [isAllSites, setIsAllSites] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  if (items.length === 0 && !canManage) return null;

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, siteId, is_all_sites: isAllSites }),
      });
      if (res.ok) {
        const data = await res.json() as { id: string };
        setItems((prev) => [{
          id: data.id,
          text,
          created_by_name: '',
          is_all_sites: isAllSites,
          created_at: new Date().toISOString(),
        }, ...prev]);
        setText('');
        setAdding(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className={styles.wrap}>
      {items.length > 0 && (
        <div className={styles.list}>
          {items.map((item) => (
            <div key={item.id} className={styles.item}>
              <span className={styles.icon} aria-hidden="true">📢</span>
              <div className={styles.content}>
                <p className={styles.text}>{item.text}</p>
                <span className={styles.meta}>
                  {item.created_by_name && `${item.created_by_name} · `}
                  {fmtDate(item.created_at)}
                  {item.is_all_sites && ' · Alle filialen'}
                </span>
              </div>
              {canManage && (
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(item.id)}
                  title="Verwijderen"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        adding ? (
          <div className={styles.addForm}>
            <textarea
              className={styles.textarea}
              placeholder="Bericht voor het team (zichtbaar in alle/dit filiaal)..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className={styles.formRow}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={isAllSites}
                  onChange={(e) => setIsAllSites(e.target.checked)}
                />
                Zichtbaar in alle filialen
              </label>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnCancel} onClick={() => { setAdding(false); setText(''); }}>Annuleren</button>
                <button type="button" className={styles.btnSave} onClick={handleAdd} disabled={saving || !text.trim()}>
                  {saving ? 'Bezig...' : 'Plaatsen'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setAdding(true)}>
            + Bericht plaatsen
          </button>
        )
      )}
    </div>
  );
}
