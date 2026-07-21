'use client';

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
  return (
    <BottomSheet open onClose={onClose} title="Dagfiche">
      <p className={styles.meta}>
        <span className={styles.metaLabel}>Door</span>
        <span className={styles.metaValue}>{payload.submittedBy}</span>
        <span className={styles.metaSep}>·</span>
        <span className={styles.metaValue}>{payload.submittedAt}</span>
      </p>

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
    </BottomSheet>
  );
}
