'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

function triggerLabel(payload: MaintenanceTaskPayload, t: (key: string, values?: Record<string, string | number>) => string): string {
  switch (payload.triggerType) {
    case 'washes':
      return t('elkeWassingen', { count: payload.triggerValue });
    case 'months':
      if (payload.triggerValue === 12) return t('eenKeerPerJaar');
      if (payload.triggerValue === 24) return t('omDe2Jaar');
      return t('elkeMaanden', { count: payload.triggerValue });
    case 'fixed_date':
      return t('jaarlijks', { date: `${payload.triggerDay} ${MONTH_NAMES[(payload.triggerMonth ?? 1) - 1]}` });
    case 'fixed_months': {
      const months = (payload.triggerMonthList ?? []).map((m) => MONTH_NAMES[m - 1]).join(' + ');
      return months || '—';
    }
    default:
      return '—';
  }
}

export function MaintenanceModal({ payload, refId, refType, siteId, onClose }: MaintenanceModalProps) {
  const t = useTranslations('modals');
  const router = useRouter();
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);
  const taskId = payload.taskId ?? refId;

  async function handleUndo() {
    setUndoing(true);
    try {
      const res = await fetch(`/api/maintenance/${taskId}/undo-complete`, { method: 'POST' });
      if (res.ok) {
        setUndone(true);
        router.refresh();
      }
    } finally {
      setUndoing(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} title={t('onderhoud')}>
      <div className={styles.headerTop}>
        <p className={styles.meta}>{payload.description}</p>
        {payload.canUndo && (
          <button
            type="button"
            className={styles.undoBtn}
            onClick={handleUndo}
            disabled={undoing || undone}
          >
            {undone ? t('nietGedaanGezet') : undoing ? '...' : t('markeerNietGedaan')}
          </button>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('details')}</p>
            <div className={styles.row}>
              <span className={styles.rowLabel}>{t('frequentie')}</span>
              <span className={styles.rowValue}>{triggerLabel(payload, t)}</span>
            </div>
            {payload.lastDoneAt ? (
              <div className={styles.row}>
                <span className={styles.rowLabel}>{t('laatstGedaan')}</span>
                <span className={styles.rowValue}>{payload.lastDoneAt}</span>
              </div>
            ) : (
              <div className={styles.row}>
                <span className={styles.rowLabel}>{t('laatstGedaan')}</span>
                <span className={[styles.rowValue, styles.never].join(' ')}>{t('nogNooit')}</span>
              </div>
            )}
            {payload.triggerType === 'washes' && (
              <>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>{t('wassingenBijLaatste')}</span>
                  <span className={styles.rowValue}>{(payload.washesAtLastDone ?? 0).toLocaleString('nl-BE')}</span>
                </div>
                {payload.currentTellerstand !== undefined && (
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>{t('huidigeTellerstand')}</span>
                    <span className={styles.rowValue}>{payload.currentTellerstand.toLocaleString('nl-BE')}</span>
                  </div>
                )}
                {payload.washesRemaining !== undefined && payload.washesRemaining > 0 && (
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>{t('nogTeGaan')}</span>
                    <span className={styles.rowValue}>{payload.washesRemaining.toLocaleString('nl-BE')} {t('wagens')}</span>
                  </div>
                )}
                {payload.washesRemaining === 0 && (
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>{t('status')}</span>
                    <span className={[styles.rowValue, styles.overdueLabel].join(' ')}>{t('vervallen')}</span>
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
