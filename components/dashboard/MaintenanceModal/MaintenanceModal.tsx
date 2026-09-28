'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const taskId = payload.taskId ?? refId;
  // Overdue/approaching tasks (not yet done today) have no canUndo flag —
  // that's exactly when a "mark as done" action needs to be offered.
  const canComplete = !payload.canUndo;

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

  async function handleComplete() {
    setConfirmingComplete(false);
    setCompleting(true);
    try {
      const res = await fetch(`/api/maintenance/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' }),
      });
      if (res.ok) {
        setCompleted(true);
        router.refresh();
      }
    } finally {
      setCompleting(false);
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
        {canComplete && !confirmingComplete && (
          <button
            type="button"
            className={styles.completeBtn}
            onClick={() => setConfirmingComplete(true)}
            disabled={completing || completed}
          >
            {completed ? t('gedaanGezet') : completing ? '...' : t('markeerUitgevoerd')}
          </button>
        )}
        {canComplete && confirmingComplete && (
          <div className={styles.confirmRow}>
            <span className={styles.confirmText}>{t('bevestigen')}</span>
            <button type="button" className={styles.confirmYesBtn} onClick={handleComplete}>{t('ja')}</button>
            <button type="button" className={styles.confirmNoBtn} onClick={() => setConfirmingComplete(false)}>{t('nee')}</button>
          </div>
        )}
      </div>
      <Link href={`/onderhouden/${taskId}?site=${siteId}`} className={styles.historyLink}>
        {t('historiekBekijken')}
      </Link>

      <div className={styles.body}>
        <div className={styles.section}>
            <p className={styles.sectionTitle}>{t('details')}</p>
            <div className={styles.row}>
              <span className={styles.rowLabel}>{t('frequentie')}</span>
              <span className={styles.rowValue}>{triggerLabel(payload, t)}</span>
            </div>
            {payload.lastDoneAt ? (
              <>
                <div className={styles.row}>
                  <span className={styles.rowLabel}>{t('laatstGedaan')}</span>
                  <span className={styles.rowValue}>{payload.lastDoneAt}</span>
                </div>
                {payload.doneByName && (
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>{t('doorWie')}</span>
                    <span className={styles.rowValue}>{payload.doneByName}</span>
                  </div>
                )}
              </>
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
