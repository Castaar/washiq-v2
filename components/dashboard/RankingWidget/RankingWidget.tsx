'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { RankingModal } from '@/components/dashboard/RankingModal/RankingModal';
import styles from './RankingWidget.module.scss';

interface RankingWidgetProps {
  rank: number;
  total: number;
  isOwner: boolean;
  siteId: string;
}

export function RankingWidget({ rank, total, isOwner, siteId }: RankingWidgetProps) {
  const t = useTranslations('ranking');
  const [open, setOpen] = useState(false);
  const canClick = isOwner && total > 1;

  return (
    <>
      <div
        className={[styles.card, canClick ? styles.clickable : ''].join(' ')}
        onClick={canClick ? () => setOpen(true) : undefined}
        role={canClick ? 'button' : undefined}
        tabIndex={canClick ? 0 : undefined}
        onKeyDown={canClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); } : undefined}
        aria-label={canClick ? t('bekijkVergelijking') : undefined}
      >
        <span className={styles.label}>{t('titel')}</span>
        <div className={styles.body}>
          <span className={styles.position}>{t('nr', { rank })}</span>
          {isOwner && total > 1 && (
            <span className={styles.total}>{t('vanTotal', { total })}</span>
          )}
        </div>
        {canClick && <span className={styles.hint}>{t('meerInfo')}</span>}
      </div>
      {open && <RankingModal siteId={siteId} onClose={() => setOpen(false)} />}
    </>
  );
}
