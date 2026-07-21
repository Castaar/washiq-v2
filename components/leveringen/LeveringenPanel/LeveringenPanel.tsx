'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import styles from './LeveringenPanel.module.scss';

export interface StockItem {
  id: string;
  name: string;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
}

export function LeveringenPanel({ stocks: initial }: { stocks: StockItem[] }) {
  const { showToast } = useToast();
  const [stocks, setStocks] = useState(initial);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

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
        showToast('Levering geregistreerd');
      }
    } finally {
      setSaving(null);
    }
  }

  if (stocks.length === 0) {
    return <p className={styles.empty}>Geen producten gevonden. Voeg eerst producten toe in instellingen.</p>;
  }

  return (
    <div className={styles.list}>
      {stocks.map((s) => {
        const isLow = s.current_stock <= s.min_stock_alert && s.min_stock_alert > 0;
        const hasQty = !!qtyDraft[s.id];
        return (
          <div key={s.id} className={[styles.row, isLow ? styles.low : ''].filter(Boolean).join(' ')}>
            <div className={styles.info}>
              <span className={styles.name}>{s.name}</span>
              <span className={[styles.stock, isLow ? styles.stockLow : ''].join(' ')}>
                {s.current_stock} {s.unit}
                {isLow && <span className={styles.lowBadge}>Laag</span>}
              </span>
            </div>
            <div className={styles.deliveryRow}>
              <input
                className={styles.qtyInput}
                type="number"
                min="0"
                step="any"
                placeholder={`Aantal (${s.unit})`}
                value={qtyDraft[s.id] ?? ''}
                onChange={(e) => setQtyDraft((prev) => ({ ...prev, [s.id]: e.target.value }))}
              />
              <button
                type="button"
                className={styles.deliverBtn}
                disabled={!hasQty || saving === s.id}
                onClick={() => handleDeliver(s.id)}
              >
                {saving === s.id ? '...' : saved === s.id ? '✓ Opgeslagen' : '+ Levering'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
