'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DagficheModal } from '@/components/dashboard/DagficheModal/DagficheModal';
import type { DagfichePayload } from '@/lib/types/dashboard';
import styles from './DagfichesPanel.module.scss';

export interface DagficheOverviewItem {
  id: string;
  userName: string;
  submittedAt: string;
  dateKey: string;
  uncheckedCount: number;
  hasDefectNote: boolean;
  payload: DagfichePayload;
}

export function DagfichesPanel({ items, siteId }: { items: DagficheOverviewItem[]; siteId: string }) {
  const [open, setOpen] = useState<DagficheOverviewItem | null>(null);

  // Deep-link from a push notification: /dagfiches?item=<id> opens that
  // specific submitted dagfiche directly.
  const searchParams = useSearchParams();
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (!itemId) return;
    const match = items.find((i) => i.id === itemId);
    if (match) setOpen(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (items.length === 0) {
    return <p className={styles.empty}>Geen dagfiches gevonden voor de afgelopen 30 dagen.</p>;
  }

  const grouped = new Map<string, DagficheOverviewItem[]>();
  for (const item of items) {
    if (!grouped.has(item.dateKey)) grouped.set(item.dateKey, []);
    grouped.get(item.dateKey)!.push(item);
  }

  return (
    <div className={styles.list}>
      {open && (
        <DagficheModal
          payload={open.payload}
          refId={open.id}
          refType="daily_checklist"
          siteId={siteId}
          onClose={() => setOpen(null)}
        />
      )}
      {[...grouped.entries()].map(([dateKey, dayItems]) => (
        <div key={dateKey} className={styles.dayGroup}>
          <div className={styles.dayHeader}>{dateKey}</div>
          {dayItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.row}
              onClick={() => setOpen(item)}
            >
              <span className={styles.rowName}>{item.userName}</span>
              <span className={styles.rowTime}>{item.submittedAt.split(' ').pop()}</span>
              {item.uncheckedCount > 0 ? (
                <span className={[styles.badge, styles.badgeWarn].join(' ')}>
                  ⚠ {item.uncheckedCount} niet afgevinkt
                </span>
              ) : (
                <span className={[styles.badge, styles.badgeOk].join(' ')}>✓ Volledig</span>
              )}
              {item.hasDefectNote && <span className={styles.defectDot} title="Dagrapport ingevuld" />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
