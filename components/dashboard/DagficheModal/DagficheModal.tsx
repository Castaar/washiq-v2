'use client';

import { useEffect } from 'react';
import type { DagfichePayload } from '@/lib/types/dashboard';
import { IconCheck, IconX } from '@/components/ui/icons';
import { ActivitySection } from '@/components/dashboard/ActivitySection/ActivitySection';
import styles from './DagficheModal.module.scss';

interface DagficheModalProps {
  payload: DagfichePayload;
  refId: string;
  refType: string;
  siteId: string;
  onClose: () => void;
}

export function DagficheModal({ payload, refId, refType, siteId, onClose }: DagficheModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Dagfiche</h2>
            <p className={styles.meta}>
              <span className={styles.metaLabel}>Door</span>
              <span className={styles.metaValue}>{payload.submittedBy}</span>
              <span className={styles.metaSep}>·</span>
              <span className={styles.metaValue}>{payload.submittedAt}</span>
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Sluiten">
            <IconX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
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
              <p className={styles.dagrapportLabel}>Dagrapport</p>
              <p className={styles.dagrapportText}>{payload.defectNote}</p>
            </div>
          )}

          {/* Historiek + reacties */}
          <ActivitySection refId={refId} refType={refType} siteId={siteId} />
        </div>
      </div>
    </div>
  );
}
