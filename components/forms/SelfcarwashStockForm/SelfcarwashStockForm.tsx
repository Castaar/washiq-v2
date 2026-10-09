'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { countInstantForDay } from '@/lib/dates';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import styles from '../WeeklyEntryForm/WeeklyEntryForm.module.scss';

interface Product {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
}

const brusselsDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(d);

// Selfcarwash has no wagen counts — its monthly ingave is a dated stock count per
// product. Counts go to the same ledger as the wasstraat ingave; an existing count
// on the chosen day is updated instead of duplicated.
export function SelfcarwashStockForm({ siteId, products }: { siteId: string; products: Product[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const today = brusselsDay(new Date());
  const [day, setDay] = useState(today);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, { id: string; quantity: number }>>({});
  const [saving, setSaving] = useState(false);
  // True while the chosen day's existing counts load; saving waits for it so an
  // existing count is updated instead of duplicated.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetch(`/api/stock/reading?siteId=${siteId}`);
      const rows = res.ok ? ((await res.json()) as { id: string; chemicalId: string; quantity: number; recordedAt: string }[]) : [];
      if (cancelled) return;
      const found: Record<string, { id: string; quantity: number }> = {};
      for (const r of rows) {
        if (brusselsDay(new Date(r.recordedAt)) === day && !found[r.chemicalId]) found[r.chemicalId] = { id: r.id, quantity: r.quantity };
      }
      setExisting(found);
      // Prefill only fields the user hasn't typed in yet — never overwrite input.
      setCounts((prev) => {
        const next = { ...prev };
        for (const [cid, v] of Object.entries(found)) if ((prev[cid] ?? '') === '') next[cid] = String(v.quantity);
        return next;
      });
      setLoading(false);
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteId, day]);

  const filled = products.filter((p) => (counts[p.id] ?? '').trim() !== '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (filled.length === 0) {
      setError('Vul minstens één product in.');
      return;
    }
    const at = countInstantForDay(day).toISOString();
    setSaving(true);
    try {
      const results = await Promise.all(filled.map((p) => {
        const qty = parseFloat((counts[p.id] ?? '').replace(',', '.'));
        if (!Number.isFinite(qty) || qty < 0) return Promise.resolve({ ok: false } as Response);
        const ex = existing[p.id];
        if (ex) {
          if (ex.quantity === qty) return Promise.resolve({ ok: true } as Response);
          return fetch(`/api/stock/reading/${ex.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: qty }),
          });
        }
        return fetch('/api/stock/reading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chemicalId: p.id, quantity: qty, recordedAt: at }),
        });
      }));
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        setError(`${failed} product(en) niet opgeslagen — controleer de ingevulde getallen.`);
        return;
      }
      showToast('Voorraad opgeslagen — verbruik is berekend');
      router.refresh();
      router.push(`/historiek?site=${siteId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.weekPickerRow}>
        <label htmlFor="selfDay" className={styles.weekPickerLabel}>Datum van de ingave</label>
        <input
          id="selfDay"
          className={styles.weekInput}
          type="date"
          value={day}
          max={today}
          disabled={saving}
          onChange={(e) => {
            if (!e.target.value) return;
            setDay(e.target.value);
            setCounts({});
            setExisting({});
          }}
        />
        <span className={styles.weekPickerHint}>De voorraad wordt vastgelegd op deze datum.</span>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Nieuwe voorraad per product</h2>
        <p className={styles.sectionHint}>
          Geef per product de getelde voorraad in. Het verbruik wordt automatisch berekend: vorige telling + leveringen ± verplaatsingen − nieuwe telling.
        </p>
        {products.length === 0 ? (
          <p className={styles.emptyHint}>Geen producten gevonden. Voeg eerst producten toe bij Instellingen.</p>
        ) : (
          <div className={styles.fieldsRow}>
            {products.map((p) => (
              <div key={p.id} className={styles.fieldGroup}>
                <label htmlFor={`cnt-${p.id}`} className={styles.fieldLabel}>
                  {p.name} ({p.unit}){existing[p.id] ? ' · al geteld op deze dag' : ''}
                </label>
                <div className={styles.inputWrap}>
                  <input
                    id={`cnt-${p.id}`}
                    className={styles.input}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    placeholder={`nu ${p.current_stock}`}
                    value={counts[p.id] ?? ''}
                    onChange={(e) => setCounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className={styles.tellerstandError}>{error}</p>}
      <div className={styles.footer}>
        <Link href={`/historiek?site=${siteId}`} className={styles.historyLink}>Historiek bekijken</Link>
        <button type="submit" className={styles.saveBtn} disabled={saving || loading || filled.length === 0}>
          {saving ? 'Opslaan...' : 'Voorraad opslaan'}
        </button>
      </div>
    </form>
  );
}
