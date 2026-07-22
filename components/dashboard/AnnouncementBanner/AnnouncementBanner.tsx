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
  initialAnnouncements,
  canManage,
}: {
  initialAnnouncements: AnnouncementItem[];
  canManage: boolean;
}) {
  const [items, setItems] = useState(initialAnnouncements);

  if (items.length === 0) return null;

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
    </div>
  );
}
