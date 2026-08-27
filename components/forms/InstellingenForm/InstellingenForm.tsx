'use client';

import { useState } from 'react';
import { SiteProgramManager } from '@/components/shared/WashProgramManager/WashProgramManager';
import type { WashProgramItem } from '@/components/shared/WashProgramManager/WashProgramManager';
import styles from './InstellingenForm.module.scss';

// ─── Types ───────────────────────────────────────────────────

interface MaintenanceTaskItem {
  id: string;
  description: string;
  trigger_type: 'washes' | 'months' | 'fixed_date' | 'fixed_months';
  trigger_value: number;
  trigger_day: number;
  trigger_month: number;
  trigger_month_list: number[];
  last_done_at: string | null;
  washes_at_last_done: number;
}

interface NewTaskDraft {
  description: string;
  trigger_type: 'washes' | 'months' | 'fixed_date';
  trigger_value: number;
  trigger_day: number;
  trigger_month: number;
  last_done_at: string;
  washes_at_last_done: number;
}

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
  energy_per_kw: number;
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
  siteName: string;
  priceConfig: PriceConfigData | null;
  stocks: StockItem[];
  energyBills: EnergyBillData[];
  startCarCount: number;
  startWaterCount: number;
  existingProductNames?: { name: string; unit: string }[];
  maintenanceTasks: MaintenanceTaskItem[];
  currentTotalWashes: number;
  programs: WashProgramItem[];
  allowedSites?: { id: string; name: string }[];
}

const MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];

const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function emptyTask(): NewTaskDraft {
  return {
    description: '',
    trigger_type: 'washes',
    trigger_value: 0,
    trigger_day: 1,
    trigger_month: 1,
    last_done_at: '',
    washes_at_last_done: 0,
  };
}

function taskTriggerLabel(t: MaintenanceTaskItem): string {
  if (t.trigger_type === 'washes') return `Elke ${t.trigger_value.toLocaleString('nl-BE')} wassen`;
  if (t.trigger_type === 'months') {
    if (t.trigger_value === 12) return '1× per jaar';
    if (t.trigger_value === 24) return 'Om de 2 jaar';
    return `Elke ${t.trigger_value} maanden`;
  }
  if (t.trigger_type === 'fixed_date') return `${t.trigger_day} ${MONTHS[(t.trigger_month ?? 1) - 1]} (jaarlijks)`;
  if (t.trigger_type === 'fixed_months') return (t.trigger_month_list ?? []).map((m) => MONTHS[m - 1]).join(' + ');
  return '';
}

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

export function InstellingenForm({ siteId, siteName, priceConfig, stocks, energyBills, startCarCount, startWaterCount, existingProductNames = [], maintenanceTasks: initialTasks, currentTotalWashes, programs: initialPrograms, allowedSites = [] }: InstellingenFormProps) {
  const isFirstTime = !priceConfig;

  // ── Wasprogramma's state ──────────────────────────────────
  const [programs, setPrograms] = useState<WashProgramItem[]>(initialPrograms);
  const site = { id: siteId, name: siteName };

  // ── Prices state ──────────────────────────────────────────
  const [waterPrice, setWaterPrice] = useState(priceConfig?.water_per_liter ? String(priceConfig.water_per_liter) : '');
  const [energyPrice, setEnergyPrice] = useState(priceConfig?.energy_per_kw ? String(priceConfig.energy_per_kw) : '');
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

  // ── Product list state (owner can add/remove products) ───
  const [productList, setProductList] = useState<StockItem[]>(stocks);
  const [newProductName, setNewProductName] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('L');
  const [addingProduct, setAddingProduct] = useState(false);
  const [productError, setProductError] = useState('');

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    const name = newProductName.trim();
    if (!name) return;
    if (productList.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setProductError('Product bestaat al');
      return;
    }
    setProductError('');
    setAddingProduct(true);
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, name, unit: newProductUnit, current_stock: 0, min_stock_alert: 0 }),
    });
    if (res.ok) {
      const data = (await res.json()) as StockItem;
      setProductList((prev) => [...prev, data]);
      setStockValues((prev) => ({ ...prev, [data.id]: '' }));
      setMinAlertValues((prev) => ({ ...prev, [data.id]: '' }));
      setChemPrices((prev) => ({ ...prev, [data.name]: '' }));
      setNewProductName('');
    } else {
      setProductError('Opslaan mislukt');
    }
    setAddingProduct(false);
  }

  async function handleDeleteProduct(id: string) {
    const product = productList.find((p) => p.id === id);
    if (!product) return;
    if (!confirm(`Product "${product.name}" verwijderen? Historische data blijft bewaard.`)) return;
    const res = await fetch(`/api/stock/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProductList((prev) => prev.filter((p) => p.id !== id));
      setStockValues((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setMinAlertValues((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setChemPrices((prev) => { const n = { ...prev }; delete n[product.name]; return n; });
    }
  }

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

  // ── Delivery state ────────────────────────────────────────
  const [deliveryOpen, setDeliveryOpen] = useState<Record<string, string>>({});
  const [savingDelivery, setSavingDelivery] = useState<string | null>(null);

  async function handleConfirmDelivery(stockId: string) {
    const qty = parseFloat(deliveryOpen[stockId] ?? '');
    if (!qty || qty <= 0) return;
    setSavingDelivery(stockId);
    try {
      const res = await fetch(`/api/stock/${stockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_quantity: qty }),
      });
      if (res.ok) {
        const updated = (await res.json()) as StockItem;
        setProductList((prev) => prev.map((s) => (s.id === stockId ? { ...s, current_stock: updated.current_stock } : s)));
        setDeliveryOpen((prev) => { const n = { ...prev }; delete n[stockId]; return n; });
      }
    } finally {
      setSavingDelivery(null);
    }
  }

  // ── Transfer (verplaatsing tussen carwashes) state ─────────
  const otherSites = allowedSites.filter((s) => s.id !== siteId);
  const [transferOpen, setTransferOpen] = useState<Record<string, { toSiteId: string; qty: string }>>({});
  const [savingTransfer, setSavingTransfer] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<Record<string, string>>({});
  const [transferTargetHasProduct, setTransferTargetHasProduct] = useState<Record<string, boolean | null>>({});

  async function checkTransferTarget(stockId: string, toSiteId: string, name: string) {
    if (!toSiteId) {
      setTransferTargetHasProduct((prev) => ({ ...prev, [stockId]: null }));
      return;
    }
    try {
      const res = await fetch(`/api/stock?siteId=${toSiteId}`);
      const stocks = res.ok ? ((await res.json()) as { name: string }[]) : [];
      setTransferTargetHasProduct((prev) => ({ ...prev, [stockId]: stocks.some((s) => s.name === name) }));
    } catch {
      setTransferTargetHasProduct((prev) => ({ ...prev, [stockId]: null }));
    }
  }

  async function handleConfirmTransfer(stockId: string, name: string) {
    const t = transferOpen[stockId];
    const qty = parseFloat(t?.qty ?? '');
    if (!t?.toSiteId || !qty || qty <= 0) return;
    if (transferTargetHasProduct[stockId] === false) {
      const targetName = otherSites.find((s) => s.id === t.toSiteId)?.name ?? 'de andere carwash';
      const ok = confirm(
        `"${name}" bestaat nog niet bij ${targetName}. Het wordt daar automatisch aangemaakt, maar zonder prijs en zonder koppeling aan een wasprogramma — dat moet je nadien nog zelf instellen. Doorgaan?`,
      );
      if (!ok) return;
    }
    setSavingTransfer(stockId);
    setTransferError((prev) => { const n = { ...prev }; delete n[stockId]; return n; });
    try {
      const res = await fetch('/api/stock/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromSiteId: siteId, toSiteId: t.toSiteId, name, quantity: qty }),
      });
      if (res.ok) {
        const data = (await res.json()) as { from: { current_stock: number } };
        setProductList((prev) => prev.map((s) => (s.id === stockId ? { ...s, current_stock: data.from.current_stock } : s)));
        setTransferOpen((prev) => { const n = { ...prev }; delete n[stockId]; return n; });
        setTransferTargetHasProduct((prev) => { const n = { ...prev }; delete n[stockId]; return n; });
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setTransferError((prev) => ({ ...prev, [stockId]: err?.error ?? 'Verplaatsen mislukt' }));
      }
    } finally {
      setSavingTransfer(null);
    }
  }

  // ── Car count state ───────────────────────────────────────
  const [carCount, setCarCount] = useState(startCarCount > 0 ? String(startCarCount) : '');
  const [savingCarCount, setSavingCarCount] = useState(false);
  const [carCountSaved, setCarCountSaved] = useState(false);

  async function handleSaveCarCount(e: React.FormEvent) {
    e.preventDefault();
    setSavingCarCount(true);
    setCarCountSaved(false);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_car_count: parseInt(carCount) || 0 }),
    });
    setSavingCarCount(false);
    setCarCountSaved(true);
  }

  // ── Water count state ────────────────────────────────────
  const [waterCount, setWaterCount] = useState(startWaterCount > 0 ? String(startWaterCount) : '');
  const [savingWaterCount, setSavingWaterCount] = useState(false);
  const [waterCountSaved, setWaterCountSaved] = useState(false);

  async function handleSaveWaterCount(e: React.FormEvent) {
    e.preventDefault();
    setSavingWaterCount(true);
    setWaterCountSaved(false);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_water_count: parseInt(waterCount) || 0 }),
    });
    setSavingWaterCount(false);
    setWaterCountSaved(true);
  }

  // ── Maintenance task state ─────────────────────────────────
  const [tasks, setTasks] = useState<MaintenanceTaskItem[]>(initialTasks);
  const [addingTask, setAddingTask] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [newTask, setNewTask] = useState<NewTaskDraft>(emptyTask());
  const [deletingTask, setDeletingTask] = useState<string | null>(null);

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.description.trim()) return;
    setSavingTask(true);
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          description: newTask.description.trim(),
          trigger_type: newTask.trigger_type,
          trigger_value: newTask.trigger_value,
          trigger_day: newTask.trigger_day,
          trigger_month: newTask.trigger_month,
          last_done_at: newTask.last_done_at || undefined,
          washes_at_last_done: newTask.washes_at_last_done,
        }),
      });
      if (res.ok) {
        const { id } = (await res.json()) as { id: string };
        const created: MaintenanceTaskItem = {
          id,
          description: newTask.description.trim(),
          trigger_type: newTask.trigger_type,
          trigger_value: newTask.trigger_value,
          trigger_day: newTask.trigger_day,
          trigger_month: newTask.trigger_month,
          trigger_month_list: [],
          last_done_at: newTask.last_done_at || null,
          washes_at_last_done: newTask.washes_at_last_done,
        };
        setTasks((prev) => [...prev, created]);
        setNewTask(emptyTask());
        setAddingTask(false);
      }
    } finally {
      setSavingTask(false);
    }
  }

  async function handleDeleteTask(id: string) {
    setDeletingTask(id);
    try {
      await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingTask(null);
    }
  }

  // ── Derived state ─────────────────────────────────────────
  const hasPrices = hasPriceConfig || pricesSaved;
  const hasStock = productList.length > 0 && productList.some((s) => s.current_stock > 0 || stockSaved);

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
        energy_per_kw: parseFloat(energyPrice) || 0,
        salt_per_kg: parseFloat(saltPrice) || 0,
        flock_per_kg: parseFloat(flockPrice) || 0,
        cloth_per_unit: parseFloat(clothPrice) || 0,
        chemicals: productList.map((s) => ({
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
      productList.map((s) =>
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
          <span className={styles.bannerTitle}>Instellingen in 3 stappen</span>
          <p className={styles.bannerText}>
            Volg de stappen hieronder om uw carwash in te stellen:
          </p>
          <ol className={styles.bannerSteps}>
            <li>Prijzen per eenheid instellen</li>
            <li>Startvoorraad ingeven</li>
            <li>Eerste energiefactuur toevoegen</li>
          </ol>
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
          <PriceField label="Water" unit="€ / m³" value={waterPrice} onChange={setWaterPrice} />
          <PriceField label="Elektriciteit" unit="€ / kWh" value={energyPrice} onChange={setEnergyPrice} />
          <PriceField label="Zoutverzachter" unit="€ / kg" value={saltPrice} onChange={setSaltPrice} />
          <PriceField label="Flockmiddel" unit="€ / kg" value={flockPrice} onChange={setFlockPrice} />
          <PriceField label="Ruitendoekjes" unit="€ / stuk" value={clothPrice} onChange={setClothPrice} />
          {productList.map((s) => (
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

      {/* ── Sectie 1b: Producten beheren ─────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Producten beheren</h2>
        </div>
        <p className={styles.sectionHint}>
          Voeg de chemische producten toe die uw carwash gebruikt. Elk product verschijnt automatisch in de maandelijkse ingave en de prijsberekening.
        </p>

        <div className={styles.productList}>
          {productList.length === 0 && (
            <p className={styles.emptyHint}>Nog geen producten toegevoegd.</p>
          )}
          {productList.map((p) => (
            <div key={p.id} className={styles.productRow}>
              <span className={styles.productName}>{p.name}</span>
              <span className={styles.productUnit}>{p.unit}</span>
              <button
                type="button"
                className={styles.deleteProductBtn}
                onClick={() => handleDeleteProduct(p.id)}
                aria-label={`${p.name} verwijderen`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <form className={styles.addProductForm} onSubmit={handleAddProduct} noValidate>
          <input
            className={styles.productInput}
            type="text"
            list="existing-product-names"
            value={newProductName}
            onChange={(e) => {
              const val = e.target.value;
              setNewProductName(val);
              setProductError('');
              const match = existingProductNames.find((p) => p.name.toLowerCase() === val.trim().toLowerCase());
              if (match) setNewProductUnit(match.unit);
            }}
            placeholder="Productnaam (bv. Shampoo Pro)"
          />
          <datalist id="existing-product-names">
            {existingProductNames.map((p) => (
              <option key={p.name} value={p.name} />
            ))}
          </datalist>
          <select
            className={styles.productUnitSelect}
            value={newProductUnit}
            onChange={(e) => setNewProductUnit(e.target.value)}
          >
            <option value="L">L (liter)</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="st">st (stuk)</option>
            <option value="rol">rol</option>
          </select>
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={addingProduct || !newProductName.trim()}
          >
            {addingProduct ? 'Toevoegen...' : '+ Product toevoegen'}
          </button>
        </form>
        {productError && <p className={styles.errorMsg}>{productError}</p>}
        {!productError && (() => {
          const trimmed = newProductName.trim();
          if (!trimmed) return null;
          const caseMatch = existingProductNames.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
          if (!caseMatch || caseMatch.name === trimmed) return null;
          return (
            <p className={styles.sectionHint} style={{ margin: '4px 0 0' }}>
              Bestaat elders als &quot;{caseMatch.name}&quot; —{' '}
              <button
                type="button"
                onClick={() => { setNewProductName(caseMatch.name); setNewProductUnit(caseMatch.unit); }}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
              >
                gebruik dezelfde schrijfwijze
              </button>
            </p>
          );
        })()}
      </div>

      {/* ── Sectie 1c: Wasprogramma's ────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Wasprogramma&apos;s</h2>
        </div>
        <p className={styles.sectionHint}>
          Stel de wasprogramma&apos;s in voor deze site: naam, tier en welke producten erbij gebruikt worden.
        </p>
        <SiteProgramManager
          site={site}
          allSites={[site]}
          programs={programs}
          availableProducts={productList}
          onDeleteProgram={(id) => setPrograms((prev) => prev.filter((p) => p.id !== id))}
          onUpdateProgram={(id, updated) => setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)))}
          onAddProgram={(program) => setPrograms((prev) => [...prev, program])}
          showCopy={false}
        />
      </div>

      {/* ── Sectie 2: Startvoorraad ──────────────────────────── */}
      <form className={styles.section} onSubmit={handleSaveStock} noValidate>
        <div className={styles.sectionHead}>
          <StepBadge num={2} done={hasStock} />
          <h2 className={styles.sectionTitle}>Startvoorraad</h2>
        </div>
        <p className={styles.sectionHint}>
          Geef de huidige hoeveelheid in voor elk product. Dit is de startbasis voor voorraadberekeningen.
        </p>

        {productList.length === 0 ? (
          <p className={styles.emptyHint}>
            Geen producten gevonden. Voeg eerst producten toe via &quot;Producten beheren&quot; hierboven.
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
              {productList.map((s) => (
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

      {/* ── Sectie 2b: Chemie voorraad ───────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Chemie voorraad</h2>
        </div>
        <p className={styles.sectionHint}>
          Registreer een levering om de voorraad bij te werken, of verplaats voorraad naar een andere carwash.
        </p>
        {productList.length === 0 ? (
          <p className={styles.emptyHint}>Geen producten gevonden. Voeg eerst producten toe via &quot;Producten beheren&quot; hierboven.</p>
        ) : (
          <div className={styles.stockTable}>
            <div className={styles.stockHeaderRow}>
              <span>Product</span>
              <span>Huidige voorraad</span>
              <span>Eenheid</span>
              <span></span>
            </div>
            {productList.map((s) => {
              const isDeliveryOpen = s.id in deliveryOpen;
              const isTransferOpen = s.id in transferOpen;
              const isLow = s.min_stock_alert > 0 && s.current_stock <= s.min_stock_alert;
              return (
                <div key={s.id} className={styles.stockRow}>
                  <span className={styles.stockName}>{s.name}</span>
                  <span className={[styles.stockName, isLow ? styles.stockLow : ''].filter(Boolean).join(' ')}>
                    {s.current_stock}
                  </span>
                  <span className={styles.stockUnit}>{s.unit}</span>
                  {isDeliveryOpen ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className={styles.stockInput}
                        type="number"
                        min="0"
                        step="any"
                        placeholder={s.unit}
                        value={deliveryOpen[s.id]}
                        onChange={(e) => setDeliveryOpen((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        autoFocus
                        style={{ width: 90 }}
                      />
                      <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={() => handleConfirmDelivery(s.id)}
                        disabled={savingDelivery === s.id}
                        style={{ padding: '4px 10px' }}
                      >
                        {savingDelivery === s.id ? '...' : 'OK'}
                      </button>
                      <button
                        type="button"
                        className={styles.deleteProductBtn}
                        onClick={() => setDeliveryOpen((prev) => { const n = { ...prev }; delete n[s.id]; return n; })}
                      >
                        ✕
                      </button>
                    </div>
                  ) : isTransferOpen ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        className={styles.stockInput}
                        value={transferOpen[s.id].toSiteId}
                        onChange={(e) => {
                          const toSiteId = e.target.value;
                          setTransferOpen((prev) => ({ ...prev, [s.id]: { ...prev[s.id], toSiteId } }));
                          checkTransferTarget(s.id, toSiteId, s.name);
                        }}
                        style={{ width: 140 }}
                      >
                        <option value="">Naar carwash...</option>
                        {otherSites.map((os) => (
                          <option key={os.id} value={os.id}>{os.name}</option>
                        ))}
                      </select>
                      <input
                        className={styles.stockInput}
                        type="number"
                        min="0"
                        step="any"
                        placeholder={s.unit}
                        value={transferOpen[s.id].qty}
                        onChange={(e) => setTransferOpen((prev) => ({ ...prev, [s.id]: { ...prev[s.id], qty: e.target.value } }))}
                        style={{ width: 90 }}
                      />
                      <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={() => handleConfirmTransfer(s.id, s.name)}
                        disabled={savingTransfer === s.id}
                        style={{ padding: '4px 10px' }}
                      >
                        {savingTransfer === s.id ? '...' : 'OK'}
                      </button>
                      <button
                        type="button"
                        className={styles.deleteProductBtn}
                        onClick={() => {
                          setTransferOpen((prev) => { const n = { ...prev }; delete n[s.id]; return n; });
                          setTransferTargetHasProduct((prev) => { const n = { ...prev }; delete n[s.id]; return n; });
                        }}
                      >
                        ✕
                      </button>
                      {transferTargetHasProduct[s.id] === false && (
                        <span className={styles.sectionHint} style={{ width: '100%', margin: 0 }}>
                          Bestaat nog niet bij deze carwash — wordt automatisch aangemaakt zonder prijs en zonder wasprogramma-koppeling.
                        </span>
                      )}
                      {transferError[s.id] && (
                        <span className={styles.errorMsg} style={{ width: '100%' }}>{transferError[s.id]}</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={() => setDeliveryOpen((prev) => ({ ...prev, [s.id]: '' }))}
                        style={{ padding: '4px 10px' }}
                      >
                        + Levering
                      </button>
                      {otherSites.length > 0 && (
                        <button
                          type="button"
                          className={styles.saveBtn}
                          onClick={() => setTransferOpen((prev) => ({ ...prev, [s.id]: { toSiteId: '', qty: '' } }))}
                          style={{ padding: '4px 10px' }}
                        >
                          ⇄ Verplaatsen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      {/* ── Sectie 3b: Watervoorraad ──────────────────────────── */}
      <form className={styles.section} onSubmit={handleSaveWaterCount} noValidate>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Watervoorraad</h2>
        </div>
        <p className={styles.sectionHint}>
          Geef de start tellerstand water in van vóór u met deze app begon te registreren. Dit wordt gebruikt als vorige tellerstand voor de eerste ingave.
        </p>

        <div className={styles.priceField}>
          <label className={styles.priceLabel}>Tellerstand water</label>
          <div className={styles.priceInputWrap}>
            <input
              className={styles.priceInput}
              type="number"
              min="0"
              step="1"
              value={waterCount}
              onChange={(e) => { setWaterCount(e.target.value); setWaterCountSaved(false); }}
              placeholder="0"
            />
            <span className={styles.priceUnit}>m³</span>
          </div>
        </div>

        <div className={styles.sectionFooter}>
          {waterCountSaved && <span className={styles.savedMsg}>Opgeslagen</span>}
          <button type="submit" className={styles.saveBtn} disabled={savingWaterCount}>
            {savingWaterCount ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </form>

      {/* ── Sectie 4: Start hoeveelheid wagens ──────────────── */}
      <form className={styles.section} onSubmit={handleSaveCarCount} noValidate>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Start hoeveelheid wagens</h2>
        </div>
        <p className={styles.sectionHint}>
          Geef het totale aantal wagens in dat gewassen is vóór u met deze app begon te registreren. Dit wordt opgeteld bij de tellerstand in het dashboard.
        </p>

        <div className={styles.priceField}>
          <label className={styles.priceLabel}>Aantal wagens</label>
          <div className={styles.priceInputWrap}>
            <input
              className={styles.priceInput}
              type="number"
              min="0"
              step="1"
              value={carCount}
              onChange={(e) => { setCarCount(e.target.value); setCarCountSaved(false); }}
              placeholder="0"
            />
            <span className={styles.priceUnit}>wagens</span>
          </div>
        </div>

        <div className={styles.sectionFooter}>
          {carCountSaved && <span className={styles.savedMsg}>Opgeslagen</span>}
          <button type="submit" className={styles.saveBtn} disabled={savingCarCount}>
            {savingCarCount ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </form>

      {/* ── Sectie 5: Onderhoudstaken ────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Onderhoudstaken</h2>
        </div>
        <p className={styles.sectionHint}>
          Beheer de terugkerende onderhoudstaken voor deze site. Huidig tellerstand: <strong>{currentTotalWashes.toLocaleString('nl-BE')} wassen</strong>.
        </p>

        {/* Task list */}
        {tasks.length > 0 && (
          <div className={styles.taskList}>
            {tasks.map((t) => (
              <div key={t.id} className={styles.taskRow}>
                <div className={styles.taskInfo}>
                  <span className={styles.taskDesc}>{t.description}</span>
                  <span className={styles.taskTrigger}>
                    {taskTriggerLabel(t)}
                    {t.last_done_at && ` — laatste: ${new Date(t.last_done_at).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                    {t.trigger_type === 'washes' && t.washes_at_last_done > 0 && ` (${t.washes_at_last_done.toLocaleString('nl-BE')} wgn.)`}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.deleteProductBtn}
                  onClick={() => handleDeleteTask(t.id)}
                  disabled={deletingTask === t.id}
                  aria-label={`${t.description} verwijderen`}
                >
                  {deletingTask === t.id ? '...' : '✕'}
                </button>
              </div>
            ))}
          </div>
        )}
        {tasks.length === 0 && !addingTask && (
          <p className={styles.emptyHint}>Nog geen onderhoudstaken geconfigureerd.</p>
        )}

        {/* Add task form */}
        {addingTask ? (
          <form className={styles.addTaskForm} onSubmit={handleAddTask} noValidate>
            <div className={styles.taskFormField}>
              <label className={styles.priceLabel}>Omschrijving</label>
              <input
                className={styles.productInput}
                type="text"
                placeholder="bijv. Borstels nakijken"
                value={newTask.description}
                onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                autoFocus
              />
            </div>

            <div className={styles.taskFormField}>
              <label className={styles.priceLabel}>Type trigger</label>
              <div className={styles.radioGroup}>
                {([['washes', 'Op aantal wassen'], ['months', 'Op aantal maanden'], ['fixed_date', 'Vaste datum per jaar']] as [NewTaskDraft['trigger_type'], string][]).map(([val, lbl]) => (
                  <label key={val} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="task_trigger_type"
                      value={val}
                      checked={newTask.trigger_type === val}
                      onChange={() => setNewTask((t) => ({ ...t, trigger_type: val }))}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>

            {newTask.trigger_type === 'washes' && (
              <div className={styles.taskFormRow}>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>Interval (wassen)</label>
                  <input
                    className={styles.stockInput}
                    type="number"
                    min={1}
                    placeholder="bijv. 5000"
                    value={newTask.trigger_value || ''}
                    onChange={(e) => setNewTask((t) => ({ ...t, trigger_value: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>Tellerstand laatste keer</label>
                  <input
                    className={styles.stockInput}
                    type="number"
                    min={0}
                    placeholder="bijv. 120000"
                    value={newTask.washes_at_last_done || ''}
                    onChange={(e) => setNewTask((t) => ({ ...t, washes_at_last_done: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>Datum laatste keer</label>
                  <input
                    className={styles.stockInput}
                    type="date"
                    value={newTask.last_done_at}
                    onChange={(e) => setNewTask((t) => ({ ...t, last_done_at: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {newTask.trigger_type === 'months' && (
              <div className={styles.taskFormRow}>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>Interval (maanden)</label>
                  <input
                    className={styles.stockInput}
                    type="number"
                    min={1}
                    placeholder="bijv. 3"
                    value={newTask.trigger_value || ''}
                    onChange={(e) => setNewTask((t) => ({ ...t, trigger_value: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>Datum laatste uitvoering</label>
                  <input
                    className={styles.stockInput}
                    type="date"
                    value={newTask.last_done_at}
                    onChange={(e) => setNewTask((t) => ({ ...t, last_done_at: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {newTask.trigger_type === 'fixed_date' && (
              <div className={styles.taskFormRow}>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>Dag</label>
                  <input
                    className={styles.stockInput}
                    type="number"
                    min={1}
                    max={31}
                    value={newTask.trigger_day || ''}
                    onChange={(e) => setNewTask((t) => ({ ...t, trigger_day: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>Maand</label>
                  <select
                    className={styles.stockInput}
                    value={newTask.trigger_month}
                    onChange={(e) => setNewTask((t) => ({ ...t, trigger_month: parseInt(e.target.value) }))}
                  >
                    {MONTHS_SHORT.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>Datum laatste uitvoering</label>
                  <input
                    className={styles.stockInput}
                    type="date"
                    value={newTask.last_done_at}
                    onChange={(e) => setNewTask((t) => ({ ...t, last_done_at: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className={styles.taskFormActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => { setAddingTask(false); setNewTask(emptyTask()); }}
              >
                Annuleren
              </button>
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={savingTask || !newTask.description.trim()}
              >
                {savingTask ? 'Opslaan...' : 'Taak toevoegen'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className={styles.saveBtn}
            style={{ marginTop: 8 }}
            onClick={() => setAddingTask(true)}
          >
            + Onderhoudstaak toevoegen
          </button>
        )}
      </div>

    </div>
  );
}
