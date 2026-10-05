'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { DagfichePayload } from '@/lib/types/dashboard';
import { IconCheck } from '@/components/ui/icons';
import { ActivitySection } from '@/components/dashboard/ActivitySection/ActivitySection';
import { BottomSheet } from '@/components/ui/BottomSheet/BottomSheet';
import styles from './DagficheModal.module.scss';

interface DagficheModalProps {
  payload: DagfichePayload;
  refId: string;
  refType: string;
  siteId: string;
  onClose: () => void;
}

export function DagficheModal({ payload, refId, refType, siteId, onClose }: DagficheModalProps) {
  const t = useTranslations('modals');
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState(payload.items.map((i) => ({ ...i, opmerking: i.opmerking ?? '' })));
  const [dagrapport, setDagrapport] = useState(payload.defectNote ?? '');

  function failMessage(status: number) {
    return status === 403 ? t('enkelMelderOfBeheerder') : t('actieMislukt');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/dagfiche/${refId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, dagrapport }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(failMessage(res.status));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t('bevestigVerwijderenDagfiche'))) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/dagfiche/${refId}`, { method: 'DELETE' });
      if (res.ok) {
        onClose();
        router.refresh();
      } else {
        setError(failMessage(res.status));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={t('dagfiche')}>
      <p className={styles.meta}>
        <span className={styles.metaLabel}>{t('door')}</span>
        <span className={styles.metaValue}>{payload.submittedBy}</span>
        <span className={styles.metaSep}>·</span>
        <span className={styles.metaValue}>{payload.submittedAt}</span>
      </p>

      <div className={styles.actions}>
        {editing ? (
          <>
            <button type="button" className={styles.actionBtn} onClick={() => { setEditing(false); setItems(payload.items.map((i) => ({ ...i, opmerking: i.opmerking ?? '' }))); setDagrapport(payload.defectNote ?? ''); }} disabled={saving}>{t('annuleren')}</button>
            <button type="button" className={styles.actionBtnPrimary} onClick={handleSave} disabled={saving}>{saving ? '...' : t('opslaan')}</button>
          </>
        ) : (
          <>
            <button type="button" className={styles.actionBtn} onClick={() => setEditing(true)} disabled={saving}>{t('bewerken')}</button>
            <button type="button" className={styles.actionBtn} onClick={handleDelete} disabled={saving}>{t('verwijderen')}</button>
          </>
        )}
      </div>
      {error && <p className={styles.meta}><span className={styles.metaValue}>{error}</span></p>}

      <div className={styles.body}>
        {editing ? (
          <>
            <ul className={styles.list}>
              {items.map((item, i) => (
                <li key={i} className={styles.item}>
                  <label className={styles.itemContent}>
                    <span className={styles.itemLabel}>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                      />{' '}
                      {item.label}
                    </span>
                    <input
                      className={styles.editInput}
                      placeholder={t('opmerking')}
                      value={item.opmerking}
                      onChange={(e) => setItems((prev) => prev.map((x, j) => (j === i ? { ...x, opmerking: e.target.value } : x)))}
                    />
                  </label>
                </li>
              ))}
            </ul>
            <div className={styles.dagrapport}>
              <p className={styles.dagrapportLabel}>{t('dagrapport')}</p>
              <textarea className={styles.editTextarea} value={dagrapport} onChange={(e) => setDagrapport(e.target.value)} />
            </div>
          </>
        ) : (<>
        {/* Checklist items */}
        <ul className={styles.list}>
          {payload.items.map((item, i) => {
            const hasOpmerking = item.opmerking && item.opmerking.trim();
            const state = !item.checked ? 'unchecked' : hasOpmerking ? 'remark' : 'checked';
            return (
              <li key={i} className={[styles.item, styles[`item-${state}`]].join(' ')}>
                <span className={styles.itemIcon}>
                  {item.checked ? <IconCheck size={14} /> : <span className={styles.crossIcon}>✕</span>}
                </span>
                <div className={styles.itemContent}>
                  <span className={styles.itemLabel}>{item.label}</span>
                  {hasOpmerking && (
                    <span className={styles.itemOpmerking}>{item.opmerking}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Dagrapport */}
        {payload.defectNote && payload.defectNote.trim() && (
          <div className={styles.dagrapport}>
            <p className={styles.dagrapportLabel}>{t('dagrapport')}</p>
            <p className={styles.dagrapportText}>{payload.defectNote}</p>
          </div>
        )}

        </>)}
        {/* Historiek + reacties */}
        <ActivitySection refId={refId} refType={refType} siteId={siteId} />
      </div>
    </BottomSheet>
  );
}
