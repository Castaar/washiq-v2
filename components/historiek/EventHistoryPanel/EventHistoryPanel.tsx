'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { brusselsInstant, parseDayInput } from '@/lib/dates';
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
  invalid?: boolean;
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

// Tab order; labels come from historiek.events.tabs.<key>
const TABS: Tab[] = ['pannes', 'schade', 'bestellingen', 'leveringen', 'onderhouden'];

function fmtDate(iso: string, loc: string) {
  return new Date(iso).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  const t = useTranslations('historiek.events');
  const loc = useLocale() === 'fr' ? 'fr-BE' : 'nl-BE';
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
        showToast(method === 'DELETE' ? t('verwijderdHerberekend') : t('aangepastHerberekend'));
        router.refresh();
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        showToast(err?.error ?? t('mislukt'));
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
        showToast(res.status === 403 ? t('geenRechten') : t('mislukt'));
      }
    } finally {
      setBusyId(null);
    }
  }

  function handleDeleteLedger(item: StockLedgerItem) {
    const extra = item.kind === 'reading'
      ? `\n\n${t('deleteReading')}`
      : item.kind === 'delivery' ? `\n\n${t('deleteDelivery')}`
      : item.kind === 'adjustment' ? `\n\n${t('deleteAdjustment')}` : `\n\n${t('deleteTransfer')}`;
    if (!confirm(`${t('confirmVerwijderen', { title: item.title })}${extra}`)) return;
    void ledgerRequest(item, 'DELETE');
  }

  function handleEditLedger(item: StockLedgerItem) {
    const question = item.kind === 'reading'
      ? `${item.title}\n\n${t('editReading', { date: fmtDate(item.at, loc) })}`
      : `${item.title}\n\n${t('editDelivery')}`;
    const input = prompt(question, String(item.quantity ?? ''));
    if (input === null) return;
    const qty = parseFloat(input.replace(',', '.'));
    if (!Number.isFinite(qty) || qty < 0) return;
    void ledgerRequest(item, 'PATCH', { quantity: qty });
  }

  function handleToggleInvalid(item: StockLedgerItem) {
    const msg = item.invalid
      ? `${item.title}\n\n${t('weerMeetellen')}`
      : `${item.title}\n\n${t('ongeldigVerklaren')}`;
    if (!confirm(msg)) return;
    void ledgerRequest(item, 'PATCH', { invalid: !item.invalid });
  }

  function handleEditLedgerDate(item: StockLedgerItem) {
    const cur = new Date(item.at).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Brussels' });
    const input = prompt(`${item.title}\n\n${t('juisteDatum')}`, cur);
    if (input === null) return;
    const day = parseDayInput(input);
    if (!day) {
      showToast(t('ongeldigeDatum'));
      return;
    }
    // A count belongs to the end of its day; a delivery to midday, so a delivery and
    // a count on the same day always end up in the right order.
    const at = brusselsInstant(day, item.kind === 'reading' ? '23:59:00' : '12:00:00');
    const at2 = at.getTime() > Date.now() ? new Date() : at;
    void ledgerRequest(item, 'PATCH', item.kind === 'reading' ? { recordedAt: at2.toISOString() } : { deliveredAt: at2.toISOString() });
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
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={[styles.tab, tab === k ? styles.tabActive : ''].join(' ')}
            onClick={() => setTab(k)}
          >
            {t(`tabs.${k}`)} <span className={styles.tabCount}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {tab === 'pannes' && (
        <div className={styles.list}>
          {defects.length === 0 && <p className={styles.empty}>{t('geenPannes')}</p>}
          {defects.map((d) => (
            <div key={d.id} className={[styles.row, styles.rowClickable, d.isResolved ? styles.rowDone : ''].join(' ')} onClick={() => setOpenDefect(d)}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{d.omschrijving}</span>
                <span className={styles.rowMeta}>{d.reportedByName} · {fmtDate(d.createdAt, loc)}</span>
              </div>
              <span className={[styles.badge, d.isResolved ? styles.badgeDone : styles.badgeOpen].join(' ')}>
                {d.isResolved ? t('opgelost') : t('open')}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'schade' && (
        <div className={styles.list}>
          {schades.length === 0 && <p className={styles.empty}>{t('geenSchade')}</p>}
          {schades.map((s) => (
            <div key={s.id} className={[styles.row, styles.rowClickable, s.payload.isResolved ? styles.rowDone : ''].join(' ')} onClick={() => setOpenSchade(s)}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{s.title}</span>
                {s.subtitle && <span className={styles.rowSub}>{s.subtitle}</span>}
                <span className={styles.rowMeta}>{s.reportedByName} · {fmtDate(s.createdAt, loc)}</span>
              </div>
              <span className={[styles.badge, s.payload.isResolved ? styles.badgeDone : (s.kind === 'schade' ? styles.badgeSchade : styles.badgeEhbo)].join(' ')}>
                {s.payload.isResolved ? t('opgelost') : s.kind === 'schade' ? t('schade') : t('ehbo')}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'bestellingen' && (
        <div className={styles.list}>
          {orders.length === 0 && <p className={styles.empty}>{t('geenBestellingen')}</p>}
          {orders.map((o) => (
            <div key={o.id} className={[styles.row, o.isHandled ? styles.rowDone : ''].join(' ')}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{o.itemName}</span>
                {o.details && <span className={styles.rowSub}>{o.details}</span>}
                <span className={styles.rowMeta}>{o.requestedByName} · {fmtDate(o.requestedAt, loc)}</span>
              </div>
              <span className={[styles.badge, o.isHandled ? styles.badgeDone : styles.badgeOpen].join(' ')}>
                {o.isHandled ? t('besteld') : t('open')}
              </span>
              <button
                type="button"
                className={styles.tab}
                disabled={busyId === o.id}
                onClick={() => simpleAction(o.id, `/api/orders/requests/${o.id}`, 'DELETE', t('confirmVerwijderen', { title: o.itemName }), t('bestellingVerwijderd'))}
              >{t('verwijder')}</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'leveringen' && (
        <div className={styles.list}>
          {stockLedger.length === 0 && <p className={styles.empty}>{t('geenLeveringen')}</p>}
          {stockLedger.map((d) => (
            <div key={`${d.kind}-${d.id}`} className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{d.title}</span>
                {d.detail && <span className={styles.rowSub}>{d.detail}</span>}
                <span className={styles.rowMeta}>{d.byName ? `${d.byName} · ` : ''}{fmtDate(d.at, loc)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {d.quantity !== undefined && (
                  <button type="button" className={styles.tab} disabled={busyId === d.id} onClick={() => handleEditLedger(d)}>
                    {d.kind === 'reading' ? t('tellingWijzigen') : t('corrigeer')}
                  </button>
                )}
                {(d.kind === 'reading' || d.kind === 'delivery') && (
                  <button type="button" className={styles.tab} disabled={busyId === d.id} onClick={() => handleEditLedgerDate(d)}>{t('datum')}</button>
                )}
                {d.kind === 'reading' && (
                  <button type="button" className={styles.tab} disabled={busyId === d.id} onClick={() => handleToggleInvalid(d)}>
                    {d.invalid ? t('weerGeldig') : t('ongeldig')}
                  </button>
                )}
                <button type="button" className={styles.tab} disabled={busyId === d.id} onClick={() => handleDeleteLedger(d)}>{t('verwijder')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'onderhouden' && (
        <div className={styles.list}>
          {maintenance.length === 0 && <p className={styles.empty}>{t('geenOnderhouden')}</p>}
          {maintenance.map((m) => (
            <div key={m.id} className={styles.row}>
              <div className={styles.rowBody}>
                <span className={styles.rowTitle}>{m.description}</span>
                {m.notes && <span className={styles.rowSub}>{m.notes}</span>}
                <span className={styles.rowMeta}>{m.doneByName} · {fmtDate(m.doneAt, loc)}</span>
              </div>
              <span className={[styles.badge, styles.badgeDone].join(' ')}>{t('gedaan')}</span>
              {m.canUndo && m.taskId && (
                <button
                  type="button"
                  className={styles.tab}
                  disabled={busyId === m.id}
                  onClick={() => simpleAction(m.id, `/api/maintenance/${m.taskId}/undo-complete`, 'POST', t('confirmUndo', { name: m.description }), t('onderhoudTeruggezet'))}
                >{t('ongedaanMaken')}</button>
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
