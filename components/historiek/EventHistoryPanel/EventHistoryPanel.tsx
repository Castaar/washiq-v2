'use client';

import { useState } from 'react';
import styles from './EventHistoryPanel.module.scss';

export interface DefectHistoryItem {
  id: string;
  omschrijving: string;
  ernst: string;
  isResolved: boolean;
  reportedByName: string;
  resolvedByName: string;
  createdAt: string;
}

export interface SchadeHistoryItem {
  id: string;
  kind: 'schade' | 'ehbo';
  title: string;
  subtitle: string;
  reportedByName: string;
  createdAt: string;
}

export interface OrderHistoryItem {
  id: string;
  itemName: string;
  details: string;
  isHandled: boolean;
  requestedByName: string;
  requestedAt: string;
}

export interface MaintenanceHistoryItem {
  id: string;
  description: string;
  notes: string;
  doneByName: string;
  doneAt: string;
}

interface EventHistoryPanelProps {
  defects: DefectHistoryItem[];
  schades: SchadeHistoryItem[];
  orders: OrderHistoryItem[];
  maintenance: MaintenanceHistoryItem[];
}

type Tab = 'pannes' | 'schade' | 'bestellingen' | 'onderhouden';

const TAB_LABEL: Record<Tab, string> = {
  pannes: 'Pannes',
  schade: 'Schade / EHBO',
  bestellingen: 'Bestellingen',
  onderhouden: 'Onderhouden',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function EventHistoryPanel({ defects, schades, orders, maintenance }: EventHistoryPanelProps) {
  const [tab, setTab] = useState<Tab>('pannes');
  const counts: Record<Tab, number> = {
    pannes: defects.length,
    schade: schades.length,
    bestellingen: orders.length,
    onderhouden: maintenance.length,
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs} role="tablist">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={[styles.tab, tab === t ? styles.tabActive : ''].join(' ')}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]} <span className={styles.tabCount}>{counts[t]}</span>
          </button>
        ))}
      </div>

      {tab === 'pannes' && (
        <div className={styles.list}>
          {defects.length === 0 && <p className={styles.empty}>Geen pannes gevonden.</p>}
          {defects.map((d) => (
            <div key={d.id} className={[styles.row, d.isResolved ? styles.rowDone : ''].join(' ')}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{d.omschrijving}</span>
                <span className={styles.rowMeta}>{d.reportedByName} · {fmtDate(d.createdAt)}</span>
              </div>
              <span className={[styles.badge, d.isResolved ? styles.badgeDone : styles.badgeOpen].join(' ')}>
                {d.isResolved ? '✓ Opgelost' : 'Open'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'schade' && (
        <div className={styles.list}>
          {schades.length === 0 && <p className={styles.empty}>Geen schadegevallen of EHBO-incidenten gevonden.</p>}
          {schades.map((s) => (
            <div key={s.id} className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{s.title}</span>
                {s.subtitle && <span className={styles.rowSub}>{s.subtitle}</span>}
                <span className={styles.rowMeta}>{s.reportedByName} · {fmtDate(s.createdAt)}</span>
              </div>
              <span className={[styles.badge, s.kind === 'schade' ? styles.badgeSchade : styles.badgeEhbo].join(' ')}>
                {s.kind === 'schade' ? 'Schade' : 'EHBO'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'bestellingen' && (
        <div className={styles.list}>
          {orders.length === 0 && <p className={styles.empty}>Geen bestellingen gevonden.</p>}
          {orders.map((o) => (
            <div key={o.id} className={[styles.row, o.isHandled ? styles.rowDone : ''].join(' ')}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{o.itemName}</span>
                {o.details && <span className={styles.rowSub}>{o.details}</span>}
                <span className={styles.rowMeta}>{o.requestedByName} · {fmtDate(o.requestedAt)}</span>
              </div>
              <span className={[styles.badge, o.isHandled ? styles.badgeDone : styles.badgeOpen].join(' ')}>
                {o.isHandled ? '✓ Besteld' : 'Open'}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'onderhouden' && (
        <div className={styles.list}>
          {maintenance.length === 0 && <p className={styles.empty}>Geen uitgevoerde onderhouden gevonden.</p>}
          {maintenance.map((m) => (
            <div key={m.id} className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{m.description}</span>
                {m.notes && <span className={styles.rowSub}>{m.notes}</span>}
                <span className={styles.rowMeta}>{m.doneByName} · {fmtDate(m.doneAt)}</span>
              </div>
              <span className={[styles.badge, styles.badgeDone].join(' ')}>✓ Gedaan</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
