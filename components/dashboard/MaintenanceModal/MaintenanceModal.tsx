'use client';

import { useEffect } from 'react';
import type { MaintenanceTaskPayload } from '@/lib/types/dashboard';
import { IconX } from '@/components/ui/icons';
import { ActivitySection } from '@/components/dashboard/ActivitySection/ActivitySection';
import styles from './MaintenanceModal.module.scss';

interface MaintenanceModalProps {
  payload: MaintenanceTaskPayload;
  refId: string;
  refType: string;
  siteId: string;
  onClose: () => void;
}

const MONTH_NAMES = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function triggerLabel(payload: MaintenanceTaskPayload): string {
  switch (payload.triggerType) {
    case 'washes':
      return `Elke ${payload.triggerValue} wassingen`;
    case 'months':
      if (payload.triggerValue === 12) return '1× per jaar';
      if (payload.triggerValue === 24) return 'Om de 2 jaar';
      return `Elke ${payload.triggerValue} maanden`;
    case 'fixed_date':
      return `${payload.triggerDay} ${MONTH_NAMES[(payload.triggerMonth ?? 1) - 1]} (jaarlijks)`;
    case 'fixed_months': {
      const months = (payload.triggerMonthList ?? []).map((m) => MONTH_NAMES[m - 1]).join(' + ');
      return months || '—';
    }
    default:
      return '—';
  }
}

export function MaintenanceModal({ payload, refId, refType, siteId, onClose }: MaintenanceModalProps) {
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
        <div className={styles.header}>
          <div>
            <div className={styles.headerTop}>
              <span className={styles.badge}>Onderhoud</span>
            </div>
            <p className={styles.meta}>{payload.description}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Sluiten">
            <IconX size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Details</p>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Frequentie</span>
              <span className={styles.rowValue}>{triggerLabel(payload)}</span>
            </div>
            {payload.lastDoneAt ? (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Laatst gedaan</span>
                <span className={styles.rowValue}>{payload.lastDoneAt}</span>
              </div>
            ) : (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Laatst gedaan</span>
                <span className={[styles.rowValue, styles.never].join(' ')}>Nog nooit</span>
              </div>
            )}
            {payload.triggerType === 'washes' && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Wassingen bij laatste uitvoering</span>
                <span className={styles.rowValue}>{payload.washesAtLastDone ?? 0}</span>
              </div>
            )}
          </div>

          <ActivitySection refId={refId} refType={refType} siteId={siteId} />
        </div>
      </div>
    </div>
  );
}
