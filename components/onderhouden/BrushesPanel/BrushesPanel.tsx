'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge/Badge';
import styles from './BrushesPanel.module.scss';

export type BrushCategory = 'verticaal_links' | 'verticaal_rechts' | 'horizontaal';

export interface BrushItem {
  id: string;
  category: BrushCategory;
  label: string;
  order: number;
  washesAtLastReplacement: number;
  lastReplacedAt: string | null;
}

const CATEGORY_LABEL: Record<BrushCategory, string> = {
  verticaal_links: 'Verticaal links',
  verticaal_rechts: 'Verticaal rechts',
  horizontaal: 'Horizontaal',
};

const CATEGORIES: BrushCategory[] = ['verticaal_links', 'verticaal_rechts', 'horizontaal'];

// Slijtage-drempel: vanaf dit aantal wasbeurten sinds vervanging waarschuwen we.
const WEAR_WARNING_THRESHOLD = 20000;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function BrushesPanel({
  siteId,
  currentTellerstand,
  isOwner,
  initialBrushes,
}: {
  siteId: string;
  currentTellerstand: number;
  isOwner: boolean;
  initialBrushes: BrushItem[];
}) {
  const [brushes, setBrushes] = useState(initialBrushes);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<BrushCategory>('verticaal_links');
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  function suggestLabel(category: BrushCategory) {
    const n = brushes.filter((b) => b.category === category).length + 1;
    return `${CATEGORY_LABEL[category]} #${n}`;
  }

  async function handleAdd() {
    const label = newLabel.trim() || suggestLabel(newCategory);
    setSaving(true);
    try {
      const res = await fetch('/api/brushes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, category: newCategory, label, currentTellerstand }),
      });
      if (res.ok) {
        const { id } = (await res.json()) as { id: string };
        setBrushes((prev) => [
          ...prev,
          {
            id,
            category: newCategory,
            label,
            order: prev.filter((b) => b.category === newCategory).length,
            washesAtLastReplacement: currentTellerstand,
            lastReplacedAt: new Date().toISOString(),
          },
        ]);
        setNewLabel('');
        setFormOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReplace(brush: BrushItem) {
    setReplacingId(brush.id);
    setConfirmId(null);
    try {
      const res = await fetch(`/api/brushes/${brush.id}/replace`, { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { washesAtLastReplacement: number; lastReplacedAt: string };
        setBrushes((prev) => prev.map((b) => (b.id === brush.id
          ? { ...b, washesAtLastReplacement: data.washesAtLastReplacement, lastReplacedAt: data.lastReplacedAt }
          : b)));
      }
    } finally {
      setReplacingId(null);
    }
  }

  async function handleRename(id: string) {
    if (!editLabel.trim()) { setEditingId(null); return; }
    const res = await fetch(`/api/brushes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: editLabel.trim() }),
    });
    if (res.ok) {
      setBrushes((prev) => prev.map((b) => (b.id === id ? { ...b, label: editLabel.trim() } : b)));
    }
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/brushes/${id}`, { method: 'DELETE' });
      if (res.ok) setBrushes((prev) => prev.filter((b) => b.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const grouped = CATEGORIES.map((cat) => ({
    category: cat,
    items: brushes.filter((b) => b.category === cat).sort((a, b) => a.order - b.order),
  })).filter((g) => g.items.length > 0 || isOwner);

  return (
    <div className={styles.wrap}>
      {brushes.length === 0 && !isOwner && (
        <p className={styles.empty}>Geen borstels geconfigureerd.</p>
      )}

      {grouped.map(({ category, items }) => (
        <div key={category} className={styles.section}>
          <h2 className={styles.sectionTitle}>{CATEGORY_LABEL[category]}</h2>
          {items.length === 0 && <p className={styles.empty}>Nog geen borstels in deze categorie.</p>}
          {items.map((b) => {
            const washesSince = currentTellerstand > 0 ? Math.max(0, currentTellerstand - b.washesAtLastReplacement) : null;
            const worn = washesSince != null && washesSince >= WEAR_WARNING_THRESHOLD;
            return (
              <div key={b.id} className={[styles.brushCard, worn ? styles.worn : ''].filter(Boolean).join(' ')}>
                <div className={styles.brushBody}>
                  <div className={styles.brushTitleRow}>
                    {editingId === b.id ? (
                      <input
                        className={styles.editInput}
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onBlur={() => handleRename(b.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename(b.id)}
                        autoFocus
                      />
                    ) : (
                      <p
                        className={styles.brushLabel}
                        onClick={isOwner ? () => { setEditingId(b.id); setEditLabel(b.label); } : undefined}
                      >
                        {b.label}
                      </p>
                    )}
                    {worn && <Badge variant="amber" size="sm">Slijtage</Badge>}
                  </div>
                  <div className={styles.brushMeta}>
                    {washesSince != null && (
                      <span>{washesSince.toLocaleString('nl-BE')} wasbeurten sinds vervanging</span>
                    )}
                    {b.lastReplacedAt && <span>Laatste textiel: {fmtDate(b.lastReplacedAt)}</span>}
                  </div>
                </div>
                <div className={styles.brushActions}>
                  {confirmId === b.id ? (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>Nieuw textiel vandaag?</span>
                      <button type="button" className={styles.confirmYes} onClick={() => handleReplace(b)} disabled={replacingId === b.id}>
                        {replacingId === b.id ? '...' : 'Ja'}
                      </button>
                      <button type="button" className={styles.confirmNo} onClick={() => setConfirmId(null)}>Nee</button>
                    </div>
                  ) : (
                    <button type="button" className={styles.replaceBtn} onClick={() => setConfirmId(b.id)} disabled={replacingId === b.id}>
                      Nieuw textiel gestoken
                    </button>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(b.id)}
                      disabled={deletingId === b.id}
                      aria-label={`${b.label} verwijderen`}
                    >
                      {deletingId === b.id ? '...' : '✕'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {isOwner && (
        formOpen ? (
          <div className={styles.addForm}>
            <div className={styles.addFormRow}>
              <select className={styles.select} value={newCategory} onChange={(e) => setNewCategory(e.target.value as BrushCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
              <input
                className={styles.input}
                placeholder={suggestLabel(newCategory)}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
            <div className={styles.addFormActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => { setFormOpen(false); setNewLabel(''); }}>Annuleren</button>
              <button type="button" className={styles.saveBtn} onClick={handleAdd} disabled={saving}>
                {saving ? 'Bezig...' : 'Borstel toevoegen'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.openFormBtn} onClick={() => { setNewLabel(''); setFormOpen(true); }}>
            + Borstel toevoegen
          </button>
        )
      )}
    </div>
  );
}
