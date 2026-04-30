'use client';

import { useState } from 'react';
import styles from './InstellingenForm.module.scss';

// ─── Types ───────────────────────────────────────────────────

interface StockItem {
  id: string;
  name: string;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
}

interface PriceConfigData {
  id?: string;
  water_per_liter: number;
  salt_per_kg: number;
  flock_per_kg: number;
  cloth_per_unit: number;
  chemicals: { name: string; price_per_unit: number }[];
}

interface EnergyBillData {
  id: string;
  year: number;
  month: number;
  amount_euro: number;
}

interface InstellingenFormProps {
  siteId: string;
  priceConfig: PriceConfigData | null;
  stocks: StockItem[];
  energyBills: EnergyBillData[];
}

const MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];

// ─── Sub-components ───────────────────────────────────────────

function StepBadge({ num, done }: { num: number; done: boolean }) {
  return (
    <span className={[styles.stepBadge, done ? styles.badgeDone : styles.badgePending].join(' ')}>
      {done ? '✓' : num}
    </span>
  );
}

function PriceField({
  label, unit, value, onChange,
}: {
  label: string; unit: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className={styles.priceField}>
      <label className={styles.priceLabel}>{label}</label>
      <div className={styles.priceInputWrap}>
        <input
          className={styles.priceInput}
          type="number"
          step="0.0001"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
        />
        <span className={styles.priceUnit}>{unit}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function InstellingenForm({ siteId, priceConfig, stocks, energyBills }: InstellingenFormProps) {
  const isFirstTime = !priceConfig;

  // ── Prices state ──────────────────────────────────────────
  const [waterPrice, setWaterPrice] = useState(priceConfig?.water_per_liter ? String(priceConfig.water_per_liter) : '');
  const [saltPrice, setSaltPrice] = useState(priceConfig?.salt_per_kg ? String(priceConfig.salt_per_kg) : '');
  const [flockPrice, setFlockPrice] = useState(priceConfig?.flock_per_kg ? String(priceConfig.flock_per_kg) : '');
  const [clothPrice, setClothPrice] = useState(priceConfig?.cloth_per_unit ? String(priceConfig.cloth_per_unit) : '');
  const [chemPrices, setChemPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      stocks.map((s) => {
        const existing = priceConfig?.chemicals.find((c) => c.name === s.name);
        return [s.name, existing?.price_per_unit ? String(existing.price_per_unit) : ''];
      }),
    ),
  );
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesSaved, setPricesSaved] = useState(false);
  const [hasPriceConfig, setHasPriceConfig] = useState(!!priceConfig);

  // ── Stock state ───────────────────────────────────────────
  const [stockValues, setStockValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(stocks.map((s) => [s.id, s.current_stock > 0 ? String(s.current_stock) : ''])),
  );
  const [minAlertValues, setMinAlertValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(stocks.map((s) => [s.id, s.min_stock_alert > 0 ? String(s.min_stock_alert) : ''])),
  );
  const [savingStock, setSavingStock] = useState(false);
  const [stockSaved, setStockSaved] = useState(false);

  // ── Energy bill state ─────────────────────────────────────
  const now = new Date();
  const [billYear, setBillYear] = useState(String(now.getFullYear()));
  const [billMonth, setBillMonth] = useState(String(now.getMonth() + 1));
  const [billAmount, setBillAmount] = useState('');
  const [savingBill, setSavingBill] = useState(false);
  const [bills, setBills] = useState<EnergyBillData[]>(energyBills);

  // ── Derived state ─────────────────────────────────────────
  const hasPrices = hasPriceConfig || pricesSaved;
  const hasStock = stocks.length > 0 && stocks.some((s) => s.current_stock > 0 || stockSaved);

  // ── Handlers ──────────────────────────────────────────────

  async function handleSavePrices(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrices(true);
    setPricesSaved(false);
    const res = await fetch('/api/instellingen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId,
        water_per_liter: parseFloat(waterPrice) || 0,
        salt_per_kg: parseFloat(saltPrice) || 0,
        flock_per_kg: parseFloat(flockPrice) || 0,
        cloth_per_unit: parseFloat(clothPrice) || 0,
        chemicals: stocks.map((s) => ({
          name: s.name,
          price_per_unit: parseFloat(chemPrices[s.name] ?? '') || 0,
        })),
      }),
    });
    if (res.ok) {
      setPricesSaved(true);
      setHasPriceConfig(true);
    }
    setSavingPrices(false);
  }

  async function handleSaveStock(e: React.FormEvent) {
    e.preventDefault();
    setSavingStock(true);
    setStockSaved(false);
    await Promise.all(
      stocks.map((s) =>
        fetch(`/api/stock/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            set_stock: parseFloat(stockValues[s.id] ?? '') || 0,
            min_stock_alert: parseFloat(minAlertValues[s.id] ?? '') || 0,
          }),
        }),
      ),
    );
    setSavingStock(false);
    setStockSaved(true);
  }

  async function handleAddBill(e: React.FormEvent) {
    e.preventDefault();
    if (!billAmount) return;
    setSavingBill(true);
    const res = await fetch('/api/energy-bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId,
        year: parseInt(billYear),
        month: parseInt(billMonth),
        amount_euro: parseFloat(billAmount),
      }),
    });
    if (res.ok) {
      const newBill = await res.json();
      setBills((prev) => {
        const filtered = prev.filter((b) => !(b.year === newBill.year && b.month === newBill.month));
        return [newBill, ...filtered].sort((a, b) => b.year - a.year || b.month - a.month);
      });
      setBillAmount('');
    }
    setSavingBill(false);
  }

  return (
    <div className={styles.wrapper}>

      {/* ── First-time welcome ───────────────────────────────── */}
      {isFirstTime && !pricesSaved && (
        <div className={styles.firstTimeBanner}>
          <span className={styles.bannerTitle}>Eerste setup</span>
          <p className={styles.bannerText}>
            Volg de stappen hieronder om uw carwash in te stellen. Zodra prijzen en startvoorraad zijn ingegeven kunt u kosten berekenen op het dashboard.
          </p>
        </div>
      )}

      {/* ── Progress row ─────────────────────────────────────── */}
      <div className={styles.progressRow}>
        <div className={[styles.progressStep, hasPrices ? styles.stepDone : styles.stepActive].join(' ')}>
          <StepBadge num={1} done={hasPrices} />
          <span>Prijzen</span>
        </div>
        <div className={[styles.progressLine, hasPrices ? styles.lineDone : ''].join(' ')} />
        <div className={[styles.progressStep, hasStock ? styles.stepDone : hasPrices ? styles.stepActive : styles.stepIdle].join(' ')}>
          <StepBadge num={2} done={hasStock} />
          <span>Startvoorraad</span>
        </div>
        <div className={[styles.progressLine, hasStock ? styles.lineDone : ''].join(' ')} />
        <div className={[styles.progressStep, bills.length > 0 ? styles.stepDone : styles.stepIdle].join(' ')}>
          <StepBadge num={3} done={bills.length > 0} />
          <span>Energiefacturen</span>
        </div>
      </div>

      {/* ── Sectie 1: Prijzen ────────────────────────────────── */}
      <form className={styles.section} onSubmit={handleSavePrices} noValidate>
        <div className={styles.sectionHead}>
          <StepBadge num={1} done={hasPrices} />
          <h2 className={styles.sectionTitle}>Prijzen per eenheid</h2>
        </div>
        <p className={styles.sectionHint}>
          Deze prijzen worden gebruikt om de wekelijkse en maandelijkse kostprijzen te berekenen.
        </p>

        <div className={styles.priceGrid}>
          <PriceField label="Water" unit="€ / liter" value={waterPrice} onChange={setWaterPrice} />
          <PriceField label="Zoutverzachter" unit="€ / kg" value={saltPrice} onChange={setSaltPrice} />
          <PriceField label="Flockmiddel" unit="€ / kg" value={flockPrice} onChange={setFlockPrice} />
          <PriceField label="Ruitendoekjes" unit="€ / stuk" value={clothPrice} onChange={setClothPrice} />
          {stocks.map((s) => (
            <PriceField
              key={s.name}
              label={s.name}
              unit={`€ / ${s.unit}`}
              value={chemPrices[s.name] ?? ''}
              onChange={(v) => setChemPrices((prev) => ({ ...prev, [s.name]: v }))}
            />
          ))}
        </div>

        <div className={styles.sectionFooter}>
          {pricesSaved && <span className={styles.savedMsg}>Opgeslagen</span>}
          <button type="submit" className={styles.saveBtn} disabled={savingPrices}>
            {savingPrices ? 'Opslaan...' : 'Prijzen opslaan'}
          </button>
        </div>
      </form>

      {/* ── Sectie 2: Startvoorraad ──────────────────────────── */}
      <form className={styles.section} onSubmit={handleSaveStock} noValidate>
        <div className={styles.sectionHead}>
          <StepBadge num={2} done={hasStock} />
          <h2 className={styles.sectionTitle}>Startvoorraad</h2>
        </div>
        <p className={styles.sectionHint}>
          Geef de huidige hoeveelheid in voor elk product. Dit is de startbasis voor voorraadberekeningen.
        </p>

        {stocks.length === 0 ? (
          <p className={styles.emptyHint}>
            Geen producten gevonden. Voeg eerst producten toe via de developer panel.
          </p>
        ) : (
          <>
            <div className={styles.stockTable}>
              <div className={styles.stockHeaderRow}>
                <span>Product</span>
                <span>Huidige voorraad</span>
                <span>Min. alert</span>
                <span>Eenheid</span>
              </div>
              {stocks.map((s) => (
                <div key={s.id} className={styles.stockRow}>
                  <span className={styles.stockName}>{s.name}</span>
                  <input
                    className={styles.stockInput}
                    type="number"
                    min="0"
                    value={stockValues[s.id] ?? ''}
                    onChange={(e) => setStockValues((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    placeholder="0"
                  />
                  <input
                    className={styles.stockInput}
                    type="number"
                    min="0"
                    value={minAlertValues[s.id] ?? ''}
                    onChange={(e) => setMinAlertValues((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    placeholder="0"
                  />
                  <span className={styles.stockUnit}>{s.unit}</span>
                </div>
              ))}
            </div>

            <div className={styles.sectionFooter}>
              {stockSaved && <span className={styles.savedMsg}>Opgeslagen</span>}
              <button type="submit" className={styles.saveBtn} disabled={savingStock}>
                {savingStock ? 'Opslaan...' : 'Voorraad opslaan'}
              </button>
            </div>
          </>
        )}
      </form>

      {/* ── Sectie 3: Energiefacturen ────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <StepBadge num={3} done={bills.length > 0} />
          <h2 className={styles.sectionTitle}>Energiefacturen</h2>
        </div>
        <p className={styles.sectionHint}>
          Voeg uw maandelijkse energiefactuur toe zodra u deze ontvangt. Het systeem verdeelt de kost automatisch over de wagens van die maand.
        </p>

        <form className={styles.billForm} onSubmit={handleAddBill} noValidate>
          <select
            className={styles.billSelect}
            value={billMonth}
            onChange={(e) => setBillMonth(e.target.value)}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>
          <select
            className={styles.billSelect}
            value={billYear}
            onChange={(e) => setBillYear(e.target.value)}
          >
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <div className={styles.billAmountWrap}>
            <span className={styles.billEuro}>€</span>
            <input
              className={styles.billAmountInput}
              type="number"
              min="0"
              step="0.01"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              placeholder="Bedrag factuur"
            />
          </div>
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={savingBill || !billAmount}
          >
            {savingBill ? 'Opslaan...' : 'Toevoegen'}
          </button>
        </form>

        {bills.length > 0 && (
          <div className={styles.billsList}>
            {bills.map((b) => (
              <div key={b.id} className={styles.billRow}>
                <span className={styles.billPeriod}>{MONTHS[b.month - 1]} {b.year}</span>
                <span className={styles.billAmount}>€ {b.amount_euro.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
