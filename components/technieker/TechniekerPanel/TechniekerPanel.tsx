'use client';

import { useState } from 'react';
import styles from './TechniekerPanel.module.scss';

export interface TechniekerItem {
  id: string;
  kind: 'defect' | 'schade' | 'maintenance';
  siteId: string;
  siteName: string;
  title: string;
  subtitle: string;
  severity: 'low' | 'medium' | 'high';
  date: string;
}

const KIND_LABEL: Record<TechniekerItem['kind'], string> = {
  defect: 'Defect',
  schade: 'Schade',
  maintenance: 'Onderhoud',
};

export function TechniekerPanel({ items: initial }: { items: TechniekerItem[] }) {
  const [items, setItems] = useState(initial);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const sites = Array.from(new Set(items.map((i) => i.siteName)));

  async function handleResolve(item: TechniekerItem) {
    setResolvingId(item.id);
    const note = noteDrafts[item.id]?.trim() ?? '';
    try {
      if (item.kind === 'defect') {
        await fetch(`/api/incidents/defect/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_resolved: true }),
        });
      } else if (item.kind === 'schade') {
        await fetch(`/api/incidents/schade/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_resolved: true }),
        });
      } else {
        await fetch(`/api/maintenance/${item.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: note }),
        });
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } finally {
      setResolvingId(null);
    }
  }

  if (items.length === 0) {
    return <p className={styles.empty}>Geen openstaande problemen of onderhoud — alles is in orde.</p>;
  }

  return (
    <div className={styles.wrap}>
      {sites.map((siteName) => (
        <div key={siteName} className={styles.siteGroup}>
          <h2 className={styles.siteTitle}>{siteName}</h2>
          <div className={styles.list}>
            {items.filter((i) => i.siteName === siteName).map((item) => (
              <div key={item.id} className={[styles.item, styles[`severity_${item.severity}`]].join(' ')}>
                <div className={styles.itemBody}>
                  <div className={styles.itemTop}>
                    <span className={[styles.kindBadge, styles[`kind_${item.kind}`]].join(' ')}>
                      {KIND_LABEL[item.kind]}
                    </span>
                    {item.date && <span className={styles.itemDate}>{item.date}</span>}
                  </div>
                  <p className={styles.itemTitle}>{item.title}</p>
                  {item.subtitle && <p className={styles.itemSubtitle}>{item.subtitle}</p>}
                  {item.kind === 'maintenance' && (
                    <input
                      className={styles.noteInput}
                      type="text"
                      placeholder="Opmerking (optioneel)"
                      value={noteDrafts[item.id] ?? ''}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className={styles.resolveBtn}
                  onClick={() => handleResolve(item)}
                  disabled={resolvingId === item.id}
                >
                  {resolvingId === item.id ? '...' : '✓ Opgelost'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
