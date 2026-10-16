'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge/Badge';
import { BRUSH_CATEGORIES, BRUSH_CATEGORY_KEYS, brushCategoryInfo, type BrushCategory } from '@/lib/brushes';
import styles from './BrushesPanel.module.scss';

export type { BrushCategory };

export interface BrushItem {
  id: string;
  category: BrushCategory;
  label: string;
  order: number;
  washesAtLastReplacement: number;
  lastReplacedAt: string | null;
}

const CATEGORIES = BRUSH_CATEGORY_KEYS;

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
  const t = useTranslations('brushes');
  const tAlerts = useTranslations('alerts');
  const tCommon = useTranslations('common');
  const CATEGORY_LABEL = Object.fromEntries(BRUSH_CATEGORIES.map((c) => [c.key, c.label])) as Record<BrushCategory, string>;
  const [brushes, setBrushes] = useState(initialBrushes);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<BrushCategory>('dak');
  const [addError, setAddError] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newAlreadyUsed, setNewAlreadyUsed] = useState('');
  const [saving, setSaving] = useState(false);

  function suggestLabel(category: BrushCategory) {
    const n = brushes.filter((b) => b.category === category).length + 1;
    return (brushCategoryInfo(category)?.max ?? 1) > 1 ? `${CATEGORY_LABEL[category]} ${n}` : CATEGORY_LABEL[category];
  }

  async function handleAdd() {
    const label = newLabel.trim() || suggestLabel(newCategory);
    const alreadyUsed = Math.max(0, Number(newAlreadyUsed) || 0);
    setAddError('');
    setSaving(true);
    try {
      const res = await fetch('/api/brushes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, category: newCategory, label, currentTellerstand, alreadyUsed }),
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
            washesAtLastReplacement: currentTellerstand - alreadyUsed,
            lastReplacedAt: new Date().toISOString(),
          },
        ]);
        setNewLabel('');
        setNewAlreadyUsed('');
        setFormOpen(false);
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setAddError(err?.error ?? 'Toevoegen mislukt');
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

  // Only positions this carwash actually has (plus any legacy category on old data)
  const knownCats = new Set<string>(CATEGORIES);
  const legacy = [...new Set(brushes.map((b) => b.category).filter((c) => !knownCats.has(c)))];
  const grouped = [...CATEGORIES, ...legacy].map((cat) => ({
    category: cat as BrushCategory,
    items: brushes.filter((b) => b.category === cat).sort((a, b) => a.order - b.order),
  })).filter((g) => g.items.length > 0);
  const availableCats = CATEGORIES.filter((c) => brushes.filter((b) => b.category === c).length < (brushCategoryInfo(c)?.max ?? 1));

  return (
    <div className={styles.wrap}>
      {brushes.length === 0 && !isOwner && (
        <p className={styles.empty}>{t('geenBorstels')}</p>
      )}

      {grouped.map(({ category, items }) => (
        <div key={category} className={styles.section}>
          <h2 className={styles.sectionTitle}>{CATEGORY_LABEL[category] ?? category}</h2>
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
                    {worn && <Badge variant="amber" size="sm">{t('slijtage')}</Badge>}
                  </div>
                  <div className={styles.brushMeta}>
                    {washesSince != null && (
                      <span>{t('wasbeurtenSindsVervanging', { count: washesSince.toLocaleString('nl-BE') })}</span>
                    )}
                    {b.lastReplacedAt && <span>{t('laatsteTextiel', { date: fmtDate(b.lastReplacedAt) })}</span>}
                  </div>
                </div>
                <div className={styles.brushActions}>
                  {confirmId === b.id ? (
                    <div className={styles.confirmRow}>
                      <span className={styles.confirmText}>{t('nieuwTextielVandaag')}</span>
                      <button type="button" className={styles.confirmYes} onClick={() => handleReplace(b)} disabled={replacingId === b.id}>
                        {replacingId === b.id ? '...' : tAlerts('ja')}
                      </button>
                      <button type="button" className={styles.confirmNo} onClick={() => setConfirmId(null)}>{tAlerts('nee')}</button>
                    </div>
                  ) : (
                    <button type="button" className={styles.replaceBtn} onClick={() => setConfirmId(b.id)} disabled={replacingId === b.id}>
                      {t('nieuwTextielGestoken')}
                    </button>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(b.id)}
                      disabled={deletingId === b.id}
                      aria-label={t('verwijderen', { label: b.label })}
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
                {availableCats.map((c) => (
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
            <div className={styles.addFormRow}>
              <input
                type="number"
                min="0"
                className={styles.input}
                placeholder={t('reedsGebruikt')}
                value={newAlreadyUsed}
                onChange={(e) => setNewAlreadyUsed(e.target.value)}
              />
            </div>
            <p className={styles.addFormHint}>{t('reedsGebruiktHint')}</p>
            {addError && <p className={styles.addFormHint}>{addError}</p>}
            <div className={styles.addFormActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => { setFormOpen(false); setNewLabel(''); }}>{tCommon('annuleren')}</button>
              <button type="button" className={styles.saveBtn} onClick={handleAdd} disabled={saving}>
                {saving ? tCommon('bezig') : t('borstelToevoegen')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.openFormBtn} onClick={() => { setNewLabel(''); setAddError(''); if (availableCats[0] && !availableCats.includes(newCategory)) setNewCategory(availableCats[0]); setFormOpen(true); }} disabled={availableCats.length === 0}>
            {t('openBorstelToevoegen')}
          </button>
        )
      )}
    </div>
  );
}
