'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import styles from './LeveringenPanel.module.scss';

export interface StockItem {
  id: string;
  name: string;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
}

export interface TransferSite {
  id: string;
  name: string;
}

export function LeveringenPanel({
  stocks: initial,
  siteId,
  otherSites = [],
}: {
  stocks: StockItem[];
  siteId: string;
  otherSites?: TransferSite[];
}) {
  const { showToast } = useToast();
  const t = useTranslations('leveringen');
  const [stocks, setStocks] = useState(initial);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [transferOpen, setTransferOpen] = useState<Record<string, { toSiteId: string; qty: string }>>({});
  const [savingTransfer, setSavingTransfer] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<Record<string, string>>({});
  const [transferTargetHasProduct, setTransferTargetHasProduct] = useState<Record<string, boolean | null>>({});

  async function handleDeliver(id: string) {
    const qty = parseFloat(qtyDraft[id] ?? '');
    if (!qty || qty <= 0) return;
    setSaving(id);
    try {
      const res = await fetch(`/api/stock/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_quantity: qty }),
      });
      if (res.ok) {
        const updated = await res.json() as { current_stock: number };
        setStocks((prev) => prev.map((s) => s.id === id ? { ...s, current_stock: updated.current_stock } : s));
        setQtyDraft((prev) => { const n = { ...prev }; delete n[id]; return n; });
        setSaved(id);
        setTimeout(() => setSaved((v) => v === id ? null : v), 2000);
        showToast(t('leveringGeregistreerd'));
      }
    } finally {
      setSaving(null);
    }
  }

  async function checkTransferTarget(stockId: string, toSiteId: string, name: string) {
    if (!toSiteId) {
      setTransferTargetHasProduct((prev) => ({ ...prev, [stockId]: null }));
      return;
    }
    try {
      const res = await fetch(`/api/stock?siteId=${toSiteId}`);
      const targetStocks = res.ok ? ((await res.json()) as { name: string }[]) : [];
      setTransferTargetHasProduct((prev) => ({ ...prev, [stockId]: targetStocks.some((s) => s.name === name) }));
    } catch {
      setTransferTargetHasProduct((prev) => ({ ...prev, [stockId]: null }));
    }
  }

  async function handleConfirmTransfer(stockId: string, name: string) {
    const transfer = transferOpen[stockId];
    const qty = parseFloat(transfer?.qty ?? '');
    if (!transfer?.toSiteId || !qty || qty <= 0) return;
    if (transferTargetHasProduct[stockId] === false) {
      const targetName = otherSites.find((s) => s.id === transfer.toSiteId)?.name ?? t('deAndereCarwash');
      const ok = confirm(t('confirmAutoCreate', { name, target: targetName }));
      if (!ok) return;
    }
    setSavingTransfer(stockId);
    setTransferError((prev) => { const n = { ...prev }; delete n[stockId]; return n; });
    try {
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromSiteId: siteId, toSiteId: transfer.toSiteId, name, quantity: qty }),
      });
      if (res.ok) {
        const data = (await res.json()) as { from: { current_stock: number } };
        setStocks((prev) => prev.map((s) => (s.id === stockId ? { ...s, current_stock: data.from.current_stock } : s)));
        setTransferOpen((prev) => { const n = { ...prev }; delete n[stockId]; return n; });
        setTransferTargetHasProduct((prev) => { const n = { ...prev }; delete n[stockId]; return n; });
        showToast(t('voorraadVerplaatst'));
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setTransferError((prev) => ({ ...prev, [stockId]: err?.error ?? t('verplaatsenMislukt') }));
      }
    } finally {
      setSavingTransfer(null);
    }
  }

  if (stocks.length === 0) {
    return <p className={styles.empty}>{t('geenProducten')}</p>;
  }

  return (
    <div className={styles.list}>
      {stocks.map((s) => {
        const isLow = s.current_stock <= s.min_stock_alert && s.min_stock_alert > 0;
        const hasQty = !!qtyDraft[s.id];
        const isTransferOpen = s.id in transferOpen;
        return (
          <div key={s.id} className={[styles.row, isLow ? styles.low : ''].filter(Boolean).join(' ')}>
            <div className={styles.info}>
              <span className={styles.name}>{s.name}</span>
              <span className={[styles.stock, isLow ? styles.stockLow : ''].join(' ')}>
                {s.current_stock} {s.unit}
                {isLow && <span className={styles.lowBadge}>{t('laag')}</span>}
              </span>
            </div>

            {isTransferOpen ? (
              <div className={styles.transferRow}>
                <select
                  className={styles.qtyInput}
                  value={transferOpen[s.id].toSiteId}
                  onChange={(e) => {
                    const toSiteId = e.target.value;
                    setTransferOpen((prev) => ({ ...prev, [s.id]: { ...prev[s.id], toSiteId } }));
                    checkTransferTarget(s.id, toSiteId, s.name);
                  }}
                  style={{ width: 150 }}
                >
                  <option value="">{t('naarCarwash')}</option>
                  {otherSites.map((os) => (
                    <option key={os.id} value={os.id}>{os.name}</option>
                  ))}
                </select>
                <input
                  className={styles.qtyInput}
                  type="number"
                  min="0"
                  step="any"
                  placeholder={s.unit}
                  value={transferOpen[s.id].qty}
                  onChange={(e) => setTransferOpen((prev) => ({ ...prev, [s.id]: { ...prev[s.id], qty: e.target.value } }))}
                />
                <button
                  type="button"
                  className={styles.deliverBtn}
                  onClick={() => handleConfirmTransfer(s.id, s.name)}
                  disabled={savingTransfer === s.id}
                >
                  {savingTransfer === s.id ? '...' : 'OK'}
                </button>
                <button
                  type="button"
                  className={styles.cancelTransferBtn}
                  onClick={() => {
                    setTransferOpen((prev) => { const n = { ...prev }; delete n[s.id]; return n; });
                    setTransferTargetHasProduct((prev) => { const n = { ...prev }; delete n[s.id]; return n; });
                  }}
                >
                  ✕
                </button>
                {transferTargetHasProduct[s.id] === false && (
                  <span className={styles.transferHint}>
                    {t('bestaatNogNiet')}
                  </span>
                )}
                {transferError[s.id] && (
                  <span className={styles.transferError}>{transferError[s.id]}</span>
                )}
              </div>
            ) : (
              <div className={styles.deliveryRow}>
                <input
                  className={styles.qtyInput}
                  type="number"
                  min="0"
                  step="any"
                  placeholder={t('aantalEenheid', { unit: s.unit })}
                  value={qtyDraft[s.id] ?? ''}
                  onChange={(e) => setQtyDraft((prev) => ({ ...prev, [s.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className={styles.deliverBtn}
                  disabled={!hasQty || saving === s.id}
                  onClick={() => handleDeliver(s.id)}
                >
                  {saving === s.id ? '...' : saved === s.id ? t('opgeslagen') : t('levering')}
                </button>
                {otherSites.length > 0 && (
                  <button
                    type="button"
                    className={styles.transferBtn}
                    onClick={() => setTransferOpen((prev) => ({ ...prev, [s.id]: { toSiteId: '', qty: '' } }))}
                  >
                    {t('verplaatsen')}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
