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

const UNDO_TIMEOUT_MS = 6000;

export function TechniekerPanel({ items: initial }: { items: TechniekerItem[] }) {
  const [items, setItems] = useState(initial);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  // Recently resolved items shown as undo toasts: id → { item, undoTimer }
  const [undoQueue, setUndoQueue] = useState<{ item: TechniekerItem; note: string }[]>([]);

  const sites = Array.from(new Set(items.map((i) => i.siteName)));

  function requestConfirm(id: string) {
    setConfirmId(id);
  }

  function cancelConfirm() {
    setConfirmId(null);
  }

  async function handleResolve(item: TechniekerItem) {
    setConfirmId(null);
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
      // Show undo toast
      const entry = { item, note };
      setUndoQueue((prev) => [...prev, entry]);
      setTimeout(() => {
        setUndoQueue((prev) => prev.filter((e) => e.item.id !== item.id));
      }, UNDO_TIMEOUT_MS);
    } finally {
      setResolvingId(null);
    }
  }

  async function handleUndo(entry: { item: TechniekerItem; note: string }) {
    setUndoQueue((prev) => prev.filter((e) => e.item.id !== entry.item.id));
    try {
      if (entry.item.kind === 'defect') {
        await fetch(`/api/incidents/defect/${entry.item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_resolved: false }),
        });
      } else if (entry.item.kind === 'schade') {
        await fetch(`/api/incidents/schade/${entry.item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_resolved: false }),
        });
      } else {
        await fetch(`/api/maintenance/${entry.item.id}/undo-complete`, {
          method: 'POST',
        });
      }
      setItems((prev) => [...prev, entry.item]);
    } catch { /* ignore — page refresh will restore state */ }
  }

  return (
    <>
      {/* ── Undo toasts ─────────────────────────────────────── */}
      {undoQueue.length > 0 && (
        <div className={styles.undoStack}>
          {undoQueue.map((entry) => (
            <div key={entry.item.id} className={styles.undoToast}>
              <span className={styles.undoText}>
                &ldquo;{entry.item.title}&rdquo; gemarkeerd als opgelost
              </span>
              <button
                type="button"
                className={styles.undoBtn}
                onClick={() => handleUndo(entry)}
              >
                Ongedaan maken
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.wrap}>
        {items.length === 0 && undoQueue.length === 0 && (
          <p className={styles.empty}>Geen openstaande problemen of onderhoud — alles is in orde.</p>
        )}
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

                  {confirmId === item.id ? (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>Zeker?</span>
                      <button
                        type="button"
                        className={styles.confirmYes}
                        onClick={() => handleResolve(item)}
                        disabled={resolvingId === item.id}
                      >
                        {resolvingId === item.id ? '...' : 'Ja'}
                      </button>
                      <button
                        type="button"
                        className={styles.confirmNo}
                        onClick={cancelConfirm}
                      >
                        Nee
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.resolveBtn}
                      onClick={() => requestConfirm(item.id)}
                      disabled={resolvingId === item.id}
                    >
                      Oplossen
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
