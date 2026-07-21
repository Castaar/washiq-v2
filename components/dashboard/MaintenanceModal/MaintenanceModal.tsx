'use client';

import type { MaintenanceTaskPayload } from '@/lib/types/dashboard';
import { ActivitySection } from '@/components/dashboard/ActivitySection/ActivitySection';
import { BottomSheet } from '@/components/ui/BottomSheet/BottomSheet';
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
  return (
    <BottomSheet open onClose={onClose} title="Onderhoud">
      <p className={styles.meta}>{payload.description}</p>

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
              <>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>Wassingen bij laatste uitvoering</span>
                  <span className={styles.rowValue}>{(payload.washesAtLastDone ?? 0).toLocaleString('nl-BE')}</span>
                </div>
                {payload.currentTellerstand !== undefined && (
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>Huidige tellerstand</span>
                    <span className={styles.rowValue}>{payload.currentTellerstand.toLocaleString('nl-BE')}</span>
                  </div>
                )}
                {payload.washesRemaining !== undefined && payload.washesRemaining > 0 && (
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>Nog te gaan</span>
                    <span className={styles.rowValue}>{payload.washesRemaining.toLocaleString('nl-BE')} wagens</span>
                  </div>
                )}
                {payload.washesRemaining === 0 && (
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>Status</span>
                    <span className={[styles.rowValue, styles.overdueLabel].join(' ')}>Vervallen — voer onderhoud uit</span>
                  </div>
                )}
              </>
            )}
        </div>

        <ActivitySection refId={refId} refType={refType} siteId={siteId} />
      </div>
    </BottomSheet>
  );
}
