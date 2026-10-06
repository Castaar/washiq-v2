'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import type { IncidentSchadePayload, IncidentEhboPayload, DefectPayload } from '@/lib/types/dashboard';
import { IncidentModal } from '@/components/dashboard/IncidentModal/IncidentModal';
import styles from './EventHistoryPanel.module.scss';

export interface DefectHistoryItem {
  id: string;
  omschrijving: string;
  ernst: string;
  isResolved: boolean;
  reportedByName: string;
  resolvedByName: string;
  createdAt: string;
  siteId: string;
  payload: DefectPayload;
}

export interface SchadeHistoryItem {
  id: string;
  kind: 'schade' | 'ehbo';
  title: string;
  subtitle: string;
  reportedByName: string;
  createdAt: string;
  siteId: string;
  payload: IncidentSchadePayload | IncidentEhboPayload;
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
  taskId: string;
  canUndo: boolean;
  description: string;
  notes: string;
  doneByName: string;
  doneAt: string;
}

export interface StockLedgerItem {
  id: string;
  kind: 'delivery' | 'transfer-in' | 'transfer-out' | 'reading' | 'adjustment';
  title: string;
  detail: string;
  // Set when the quantity can be corrected (tracked delivery or stock count)
  quantity?: number;
  byName: string;
  at: string;
}

interface EventHistoryPanelProps {
  defects: DefectHistoryItem[];
  schades: SchadeHistoryItem[];
  orders: OrderHistoryItem[];
  maintenance: MaintenanceHistoryItem[];
  stockLedger: StockLedgerItem[];
}

type Tab = 'pannes' | 'schade' | 'bestellingen' | 'leveringen' | 'onderhouden';

const TAB_LABEL: Record<Tab, string> = {
  pannes: 'Pannes',
  schade: 'Schade / EHBO',
  bestellingen: 'Bestellingen',
  leveringen: 'Voorraad',
  onderhouden: 'Onderhouden',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const LEDGER_ENDPOINT: Record<StockLedgerItem['kind'], string> = {
  delivery: '/api/stock/delivery',
  'transfer-in': '/api/stock/transfer',
  'transfer-out': '/api/stock/transfer',
  reading: '/api/stock/reading',
  adjustment: '/api/stock/adjustment',
};

export function EventHistoryPanel({ defects, schades, orders, maintenance, stockLedger }: EventHistoryPanelProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('pannes');

  async function ledgerRequest(item: StockLedgerItem, method: 'DELETE' | 'PATCH', body?: unknown) {
    setBusyId(item.id);
    try {
      const res = await fetch(`${LEDGER_ENDPOINT[item.kind]}/${item.id}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        showToast(method === 'DELETE' ? 'Verwijderd — voorraad en verbruik zijn herberekend' : 'Aangepast — voorraad en verbruik zijn herberekend');
        router.refresh();
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        showToast(err?.error ?? 'Mislukt, probeer opnieuw');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function simpleAction(id: string, url: string, method: 'DELETE' | 'POST', confirmText: string, okText: string) {
    if (!confirm(confirmText)) return;
    setBusyId(id);
    try {
      const res = await fetch(url, { method });
      if (res.ok) {
        showToast(okText);
        router.refresh();
      } else {
        showToast(res.status === 403 ? 'Enkel de maker of een beheerder kan dit doen' : 'Mislukt, probeer opnieuw');
      }
    } finally {
      setBusyId(null);
    }
  }

  function handleDeleteLedger(item: StockLedgerItem) {
    const extra = item.kind === 'reading'
      ? '\n\nDe voorraad keert terug naar de vorige telling.'
      : item.kind === 'delivery' ? '\n\nDe voorraad wordt met deze levering verminderd.'
      : item.kind === 'adjustment' ? '\n\nDe correctie wordt ongedaan gemaakt.' : '\n\nDe voorraad gaat terug naar de oorspronkelijke carwash.';
    if (!confirm(`"${item.title}" verwijderen?${extra}`)) return;
    void ledgerRequest(item, 'DELETE');
  }

  function handleEditLedger(item: StockLedgerItem) {
    const input = prompt('Juiste hoeveelheid:', String(item.quantity ?? ''));
    if (input === null) return;
    const qty = parseFloat(input.replace(',', '.'));
    if (!Number.isFinite(qty) || qty < 0) return;
    void ledgerRequest(item, 'PATCH', { quantity: qty });
  }

  const [openSchade, setOpenSchade] = useState<SchadeHistoryItem | null>(null);
  const [openDefect, setOpenDefect] = useState<DefectHistoryItem | null>(null);
  const counts: Record<Tab, number> = {
    pannes: defects.length,
    schade: schades.length,
    bestellingen: orders.length,
    leveringen: stockLedger.length,
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
            <div key={d.id} className={[styles.row, styles.rowClickable, d.isResolved ? styles.rowDone : ''].join(' ')} onClick={() => setOpenDefect(d)}>
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
            <div key={s.id} className={[styles.row, styles.rowClickable, s.payload.isResolved ? styles.rowDone : ''].join(' ')} onClick={() => setOpenSchade(s)}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{s.title}</span>
                {s.subtitle && <span className={styles.rowSub}>{s.subtitle}</span>}
                <span className={styles.rowMeta}>{s.reportedByName} · {fmtDate(s.createdAt)}</span>
              </div>
              <span className={[styles.badge, s.payload.isResolved ? styles.badgeDone : (s.kind === 'schade' ? styles.badgeSchade : styles.badgeEhbo)].join(' ')}>
                {s.payload.isResolved ? '✓ Opgelost' : s.kind === 'schade' ? 'Schade' : 'EHBO'}
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
              <button
                type="button"
                className={styles.tab}
                disabled={busyId === o.id}
                onClick={() => simpleAction(o.id, `/api/orders/requests/${o.id}`, 'DELETE', `"${o.itemName}" verwijderen?`, 'Bestelling verwijderd')}
              >Verwijder</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'leveringen' && (
        <div className={styles.list}>
          {stockLedger.length === 0 && <p className={styles.empty}>Nog geen leveringen, verplaatsingen of tellingen.</p>}
          {stockLedger.map((d) => (
            <div key={`${d.kind}-${d.id}`} className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{d.title}</span>
                {d.detail && <span className={styles.rowSub}>{d.detail}</span>}
                <span className={styles.rowMeta}>{d.byName ? `${d.byName} · ` : ''}{fmtDate(d.at)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {d.quantity !== undefined && (
                  <button type="button" className={styles.tab} disabled={busyId === d.id} onClick={() => handleEditLedger(d)}>Corrigeer</button>
                )}
                <button type="button" className={styles.tab} disabled={busyId === d.id} onClick={() => handleDeleteLedger(d)}>Verwijder</button>
              </div>
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
              {m.canUndo && m.taskId && (
                <button
                  type="button"
                  className={styles.tab}
                  disabled={busyId === m.id}
                  onClick={() => simpleAction(m.id, `/api/maintenance/${m.taskId}/undo-complete`, 'POST', `"${m.description}" als niet uitgevoerd terugzetten?`, 'Onderhoud teruggezet')}
                >Ongedaan maken</button>
              )}
            </div>
          ))}
        </div>
      )}

      {openSchade && (
        <IncidentModal
          payload={openSchade.payload}
          refId={openSchade.id}
          refType={openSchade.kind === 'schade' ? 'incident_schade' : 'incident_ehbo'}
          siteId={openSchade.siteId}
          onClose={() => setOpenSchade(null)}
        />
      )}

      {openDefect && (
        <IncidentModal
          payload={openDefect.payload}
          refId={openDefect.id}
          refType="defect"
          siteId={openDefect.siteId}
          onClose={() => setOpenDefect(null)}
        />
      )}
    </div>
  );
}
