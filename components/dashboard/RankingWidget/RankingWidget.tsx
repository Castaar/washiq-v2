'use client';

import { useState } from 'react';
import { RankingModal } from '@/components/dashboard/RankingModal/RankingModal';
import styles from './RankingWidget.module.scss';

interface RankingWidgetProps {
  rank: number;
  total: number;
  isOwner: boolean;
  siteId: string;
}

export function RankingWidget({ rank, total, isOwner, siteId }: RankingWidgetProps) {
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
        aria-label={canClick ? 'Bekijk ranking vergelijking' : undefined}
      >
        <span className={styles.label}>Ranking</span>
        <div className={styles.body}>
          <span className={styles.position}>Nr.&nbsp;{rank}</span>
          {isOwner && total > 1 && (
            <span className={styles.total}>van {total}</span>
          )}
        </div>
        {canClick && <span className={styles.hint}>Meer info</span>}
      </div>
      {open && <RankingModal siteId={siteId} onClose={() => setOpen(false)} />}
    </>
  );
}
