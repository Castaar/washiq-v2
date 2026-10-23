'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { SiteProgramManager } from '@/components/shared/WashProgramManager/WashProgramManager';
import type { WashProgramItem } from '@/components/shared/WashProgramManager/WashProgramManager';
import type { CounterReset } from '@/lib/counter';
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
  chemicals: { name: string; price_per_unit: number; price_unit?: 'stock' | 'kg'; liters_per_1000kg?: number }[];
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
  siteType: 'wasstraat' | 'selfcarwash';
  priceConfig: PriceConfigData | null;
  stocks: StockItem[];
  energyBills: EnergyBillData[];
  startCarCount: number;
  startWaterCount: number;
  counterResets?: CounterReset[];
  existingProductNames?: { name: string; unit: string }[];
  maintenanceTasks: MaintenanceTaskItem[];
  currentTotalWashes: number;
  programs: WashProgramItem[];
}

const MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
];

const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Display-only month names in the active locale. Dutch keeps the hardcoded
// lists above (unchanged output); other locales come from Intl.
function localeMonths(locale: string, style: 'long' | 'short'): string[] {
  if (locale !== 'fr') return style === 'long' ? MONTHS : MONTHS_SHORT;
  return Array.from({ length: 12 }, (_, i) => {
    const m = new Date(2000, i, 1).toLocaleDateString('fr-BE', { month: style });
    return style === 'long' ? m.charAt(0).toUpperCase() + m.slice(1) : m;
  });
}

type TFn = ReturnType<typeof useTranslations>;

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

function taskTriggerLabel(t: MaintenanceTaskItem, tr: TFn, months: string[], numLocale: string): string {
  if (t.trigger_type === 'washes') return tr('elkeWasbeurten', { count: t.trigger_value.toLocaleString(numLocale) });
  if (t.trigger_type === 'months') {
    if (t.trigger_value === 12) return tr('eenKeerPerJaar');
    if (t.trigger_value === 24) return tr('omDe2Jaar');
    return tr('elkeMaanden', { count: String(t.trigger_value) });
  }
  if (t.trigger_type === 'fixed_date') return tr('jaarlijks', { date: `${t.trigger_day} ${months[(t.trigger_month ?? 1) - 1]}` });
  if (t.trigger_type === 'fixed_months') return (t.trigger_month_list ?? []).map((m) => months[m - 1]).join(' + ');
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
  label, unit, value, onChange, children,
}: {
  label: string; unit: string; value: string; onChange: (v: string) => void; children?: React.ReactNode;
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
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function InstellingenForm({ siteId, siteName, siteType, priceConfig, stocks, energyBills, startCarCount, startWaterCount, counterResets: initialResets = [], existingProductNames = [], maintenanceTasks: initialTasks, currentTotalWashes, programs: initialPrograms }: InstellingenFormProps) {
  const tr = useTranslations('instellingen');
  const tCommon = useTranslations('common');
  const tAccount = useTranslations('account');
  const locale = useLocale();
  const numLocale = locale === 'fr' ? 'fr-BE' : 'nl-BE';
  const monthsLong = localeMonths(locale, 'long');
  const monthsShort = localeMonths(locale, 'short');
  const isFirstTime = !priceConfig;

  // ── Wasprogramma's state ──────────────────────────────────
  const [programs, setPrograms] = useState<WashProgramItem[]>(initialPrograms);
  const site = { id: siteId, name: siteName };

  // ── Prices state ──────────────────────────────────────────
  const [waterPrice, setWaterPrice] = useState(priceConfig?.water_per_liter ? String(priceConfig.water_per_liter) : '');
  const [chemPrices, setChemPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      stocks.map((s) => {
        const existing = priceConfig?.chemicals.find((c) => c.name === s.name);
        return [s.name, existing?.price_per_unit ? String(existing.price_per_unit) : ''];
      }),
    ),
  );
  // Products bought per kg but counted in liters: price per kg + "1000 kg = X L"
  const [chemPriceUnit, setChemPriceUnit] = useState<Record<string, 'stock' | 'kg'>>(() =>
    Object.fromEntries(stocks.map((s) => [s.name, priceConfig?.chemicals.find((c) => c.name === s.name)?.price_unit === 'kg' ? 'kg' : 'stock'])),
  );
  const [chemLiters, setChemLiters] = useState<Record<string, string>>(() =>
    Object.fromEntries(stocks.map((s) => {
      const l = priceConfig?.chemicals.find((c) => c.name === s.name)?.liters_per_1000kg ?? 0;
      return [s.name, l > 0 ? String(l) : ''];
    })),
  );
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesSaved, setPricesSaved] = useState(false);
  const [priceMode, setPriceMode] = useState<'correctie' | 'nieuw'>('correctie');
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
      setProductError(tr('productBestaatAl'));
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
      setProductError(tr('opslaanMislukt'));
    }
    setAddingProduct(false);
  }

  async function handleDeleteProduct(id: string) {
    const product = productList.find((p) => p.id === id);
    if (!product) return;
    if (!confirm(tr('confirmProductVerwijderen', { name: product.name }))) return;
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
  // ── Stock reading (maandelijkse voorraadopname) state ──────
  const [readingOpen, setReadingOpen] = useState<Record<string, string>>({});
  const [savingReading, setSavingReading] = useState<string | null>(null);
  const [readingResult, setReadingResult] = useState<Record<string, { consumption: number; unit: string; isFirstReading: boolean }>>({});
  const [readingError, setReadingError] = useState<Record<string, string>>({});

  async function handleConfirmReading(stockId: string) {
    const qtyRaw = readingOpen[stockId];
    const qty = parseFloat(qtyRaw ?? '');
    if (qtyRaw === undefined || isNaN(qty) || qty < 0) return;
    setSavingReading(stockId);
    setReadingError((prev) => { const n = { ...prev }; delete n[stockId]; return n; });
    try {
      const res = await fetch('/api/stock/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chemicalId: stockId, quantity: qty }),
      });
      if (res.ok) {
        const data = (await res.json()) as { quantity: number; consumption: number; isFirstReading: boolean };
        const unit = productList.find((s) => s.id === stockId)?.unit ?? '';
        setProductList((prev) => prev.map((s) => (s.id === stockId ? { ...s, current_stock: data.quantity } : s)));
        setReadingOpen((prev) => { const n = { ...prev }; delete n[stockId]; return n; });
        setReadingResult((prev) => ({ ...prev, [stockId]: { consumption: data.consumption, unit, isFirstReading: data.isFirstReading } }));
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setReadingError((prev) => ({ ...prev, [stockId]: err?.error ?? tr('opslaanMislukt') }));
      }
    } finally {
      setSavingReading(null);
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

  // ── Counter reset state ──────────────────────────────────
  const [resets, setResets] = useState<CounterReset[]>(initialResets);
  const [resetDate, setResetDate] = useState('');
  const [resetEnd, setResetEnd] = useState('');
  const [savingReset, setSavingReset] = useState(false);
  const [resetError, setResetError] = useState('');

  async function saveResets(body: Record<string, unknown>) {
    setSavingReset(true);
    setResetError('');
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { counter_resets?: CounterReset[]; error?: string } | null;
      if (!res.ok) { setResetError(data?.error ?? tr('opslaanMislukt')); return false; }
      setResets(data?.counter_resets ?? []);
      return true;
    } finally {
      setSavingReset(false);
    }
  }

  async function handleAddReset(e: React.FormEvent) {
    e.preventDefault();
    const endValue = parseInt(resetEnd);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(resetDate) || !(endValue > 0)) { setResetError(tr('vulDatumEindstand')); return; }
    if (await saveResets({ add_counter_reset: { date: resetDate, end_value: endValue } })) {
      setResetDate('');
      setResetEnd('');
    }
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<NewTaskDraft>(emptyTask());
  const [savingEditTask, setSavingEditTask] = useState(false);

  // Deep-link from a push notification:
  // — /instellingen?product=<id> scrolls to and highlights a low-stock product
  // — /instellingen?task=<id> scrolls to and highlights an overdue onderhoudstaak
  const searchParams = useSearchParams();
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const productRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const taskRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const productId = searchParams.get('product');
    const taskId = searchParams.get('task');
    if (productId) setHighlightProductId(productId);
    if (taskId) setHighlightTaskId(taskId);
    const targetId = productId ?? taskId;
    if (!targetId) return;
    const timeout = setTimeout(() => {
      (productId ? productRowRefs : taskRowRefs).current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    const clear = setTimeout(() => { setHighlightProductId(null); setHighlightTaskId(null); }, 4000);
    return () => { clearTimeout(timeout); clearTimeout(clear); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleStartEditTask(t: MaintenanceTaskItem) {
    setAddingTask(false);
    setEditingTaskId(t.id);
    setEditTask({
      description: t.description,
      trigger_type: t.trigger_type === 'fixed_months' ? 'washes' : t.trigger_type,
      trigger_value: t.trigger_value,
      trigger_day: t.trigger_day,
      trigger_month: t.trigger_month || 1,
      last_done_at: t.last_done_at ? t.last_done_at.slice(0, 10) : '',
      washes_at_last_done: t.washes_at_last_done,
    });
  }

  async function handleSaveEditTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTaskId || !editTask.description.trim()) return;
    setSavingEditTask(true);
    try {
      const res = await fetch(`/api/maintenance/${editingTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editTask.description.trim(),
          trigger_type: editTask.trigger_type,
          trigger_value: editTask.trigger_value,
          trigger_day: editTask.trigger_day,
          trigger_month: editTask.trigger_month,
          last_done_at: editTask.last_done_at || undefined,
          washes_at_last_done: editTask.washes_at_last_done,
        }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === editingTaskId
              ? {
                  ...t,
                  description: editTask.description.trim(),
                  trigger_type: editTask.trigger_type,
                  trigger_value: editTask.trigger_value,
                  trigger_day: editTask.trigger_day,
                  trigger_month: editTask.trigger_month,
                  last_done_at: editTask.last_done_at ? new Date(editTask.last_done_at).toISOString() : t.last_done_at,
                  washes_at_last_done: editTask.washes_at_last_done,
                }
              : t,
          ),
        );
        setEditingTaskId(null);
      }
    } finally {
      setSavingEditTask(false);
    }
  }

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
        mode: priceMode,
        water_per_liter: parseFloat(waterPrice) || 0,
        chemicals: productList.map((s) => ({
          name: s.name,
          price_per_unit: parseFloat(chemPrices[s.name] ?? '') || 0,
          price_unit: chemPriceUnit[s.name] === 'kg' ? 'kg' : 'stock',
          liters_per_1000kg: chemPriceUnit[s.name] === 'kg' ? parseFloat((chemLiters[s.name] ?? '').replace(',', '.')) || 0 : 0,
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
    // Only send a stock value when it was actually changed — once a product has
    // counts, a changed value is booked as a correction (+/- difference).
    const results = await Promise.all(
      productList.map(async (s) => {
        const raw = (stockValues[s.id] ?? '').trim();
        const val = parseFloat(raw.replace(',', '.'));
        const changed = raw !== '' && Number.isFinite(val) && val !== s.current_stock;
        const res = await fetch(`/api/stock/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(changed ? { set_stock: val, note: 'Correctie via Instellingen' } : {}),
            min_stock_alert: parseFloat(minAlertValues[s.id] ?? '') || 0,
          }),
        });
        return res.ok ? ((await res.json()) as { id: string; current_stock: number }) : null;
      }),
    );
    setProductList((prev) => prev.map((p) => {
      const r = results.find((x) => x?.id === p.id);
      return r ? { ...p, current_stock: r.current_stock } : p;
    }));
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
          <span className={styles.bannerTitle}>{tr('bannerTitel')}</span>
          <p className={styles.bannerText}>
            {tr('bannerTekst')}
          </p>
          <ol className={styles.bannerSteps}>
            <li>{tr('bannerStap1')}</li>
            <li>{tr('bannerStap2')}</li>
            <li>{tr('bannerStap3')}</li>
          </ol>
        </div>
      )}

      {/* ── Progress row ─────────────────────────────────────── */}
      <div className={styles.progressRow}>
        <div className={[styles.progressStep, hasPrices ? styles.stepDone : styles.stepActive].join(' ')}>
          <StepBadge num={1} done={hasPrices} />
          <span>{tr('prijzen')}</span>
        </div>
        <div className={[styles.progressLine, hasPrices ? styles.lineDone : ''].join(' ')} />
        <div className={[styles.progressStep, hasStock ? styles.stepDone : hasPrices ? styles.stepActive : styles.stepIdle].join(' ')}>
          <StepBadge num={2} done={hasStock} />
          <span>{tr('startvoorraad')}</span>
        </div>
        <div className={[styles.progressLine, hasStock ? styles.lineDone : ''].join(' ')} />
        <div className={[styles.progressStep, bills.length > 0 ? styles.stepDone : styles.stepIdle].join(' ')}>
          <StepBadge num={3} done={bills.length > 0} />
          <span>{tAccount('energiefacturen')}</span>
        </div>
      </div>

      {/* ── Sectie 1: Prijzen ────────────────────────────────── */}
      <form className={styles.section} onSubmit={handleSavePrices} noValidate>
        <div className={styles.sectionHead}>
          <StepBadge num={1} done={hasPrices} />
          <h2 className={styles.sectionTitle}>{tr('prijzenPerEenheid')}</h2>
        </div>
        <p className={styles.sectionHint}>
          {tr('prijzenHint')}
        </p>

        <div className={styles.priceGrid}>
          <PriceField label={tr('water')} unit="€ / m³" value={waterPrice} onChange={setWaterPrice} />
          {productList.map((s) => {
            const perKg = chemPriceUnit[s.name] === 'kg';
            const canUseKg = s.unit.toLowerCase() === 'l';
            return (
              <PriceField
                key={s.name}
                label={s.name}
                unit={perKg ? '€ / kg' : `€ / ${s.unit}`}
                value={chemPrices[s.name] ?? ''}
                onChange={(v) => setChemPrices((prev) => ({ ...prev, [s.name]: v }))}
              >
                {canUseKg && (
                  <label className={styles.priceKgToggle}>
                    <input
                      type="checkbox"
                      checked={perKg}
                      onChange={(e) => setChemPriceUnit((prev) => ({ ...prev, [s.name]: e.target.checked ? 'kg' : 'stock' }))}
                    />
                    {tr('prijsPerKg')}
                  </label>
                )}
                {canUseKg && perKg && (
                  <div className={styles.priceKgRow}>
                    <span>1000 kg =</span>
                    <input
                      className={styles.priceKgInput}
                      type="number"
                      step="any"
                      min="0"
                      placeholder="930"
                      value={chemLiters[s.name] ?? ''}
                      onChange={(e) => setChemLiters((prev) => ({ ...prev, [s.name]: e.target.value }))}
                    />
                    <span>L</span>
                  </div>
                )}
                {canUseKg && perKg && !(parseFloat(chemLiters[s.name] ?? '') > 0) && (
                  <span className={styles.priceKgHint}>{tr('vulLiter1000kg')}</span>
                )}
                {canUseKg && perKg && parseFloat(chemLiters[s.name] ?? '') > 0 && parseFloat(chemPrices[s.name] ?? '') > 0 && (
                  <span className={styles.priceKgHint}>
                    = € {(parseFloat(chemPrices[s.name]) * 1000 / parseFloat(chemLiters[s.name])).toFixed(4).replace('.', ',')} / L
                  </span>
                )}
              </PriceField>
            );
          })}
        </div>

        {hasPriceConfig && (
          <div className={styles.priceModeGroup} role="radiogroup" aria-label={tr('soortAanpassing')}>
            <label className={styles.priceModeOption}>
              <input type="radio" name="priceMode" checked={priceMode === 'correctie'} onChange={() => setPriceMode('correctie')} />
              <span>
                {tr.rich('rechtzetting', { b: (chunks) => <strong>{chunks}</strong> })}
              </span>
            </label>
            <label className={styles.priceModeOption}>
              <input type="radio" name="priceMode" checked={priceMode === 'nieuw'} onChange={() => setPriceMode('nieuw')} />
              <span>
                {tr.rich('nieuwePrijs', { b: (chunks) => <strong>{chunks}</strong> })}
              </span>
            </label>
          </div>
        )}

        <div className={styles.sectionFooter}>
          {pricesSaved && <span className={styles.savedMsg}>{tr('opgeslagen')}</span>}
          <button type="submit" className={styles.saveBtn} disabled={savingPrices}>
            {savingPrices ? `${tCommon('opslaan')}...` : tr('prijzenOpslaan')}
          </button>
        </div>
      </form>

      {/* ── Sectie 1b: Producten beheren ─────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{tr('productenBeheren')}</h2>
        </div>
        <p className={styles.sectionHint}>
          {tr('productenHint')}
        </p>

        <div className={styles.productList}>
          {productList.length === 0 && (
            <p className={styles.emptyHint}>{tr('nogGeenProducten')}</p>
          )}
          {productList.map((p) => (
            <div key={p.id} className={styles.productRow}>
              <span className={styles.productName}>{p.name}</span>
              <span className={styles.productUnit}>{p.unit}</span>
              <button
                type="button"
                className={styles.deleteProductBtn}
                onClick={() => handleDeleteProduct(p.id)}
                aria-label={tr('itemVerwijderen', { name: p.name })}
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
            placeholder={tr('productnaamPlaceholder')}
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
            <option value="L">{tr('eenheidLiter')}</option>
            <option value="kg">kg</option>
            <option value="ml">ml</option>
            <option value="st">{tr('eenheidStuk')}</option>
            <option value="rol">{tr('eenheidRol')}</option>
          </select>
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={addingProduct || !newProductName.trim()}
          >
            {addingProduct ? `${tCommon('toevoegen')}...` : tr('productToevoegen')}
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
              {tr.rich('bestaatElders', {
                name: caseMatch.name,
                btn: (chunks) => (
                  <button
                    type="button"
                    onClick={() => { setNewProductName(caseMatch.name); setNewProductUnit(caseMatch.unit); }}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    {chunks}
                  </button>
                ),
              })}
            </p>
          );
        })()}
      </div>

      {/* ── Sectie 1c: Wasprogramma's (niet voor selfcarwash — geen wagens per programma) ── */}
      {siteType !== 'selfcarwash' && (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{tAccount('wasprogrammas')}</h2>
          </div>
          <p className={styles.sectionHint}>
            {tr('wasprogrammasHint')}
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
      )}

      {/* ── Sectie 2: Startvoorraad ──────────────────────────── */}
      <form className={styles.section} onSubmit={handleSaveStock} noValidate>
        <div className={styles.sectionHead}>
          <StepBadge num={2} done={hasStock} />
          <h2 className={styles.sectionTitle}>{tr('startvoorraad')}</h2>
        </div>
        <p className={styles.sectionHint}>
          {tr('startvoorraadHint')}
        </p>

        {productList.length === 0 ? (
          <p className={styles.emptyHint}>
            {tr('geenProductenGevonden')}
          </p>
        ) : (
          <>
            <div className={styles.startStockTable}>
              <div className={styles.startStockHeaderRow}>
                <span>{tr('product')}</span>
                <span>{tr('huidigeVoorraad')}</span>
                <span>{tr('minAlert')}</span>
                <span>{tr('eenheid')}</span>
              </div>
              {productList.map((s) => (
                <div key={s.id} className={styles.startStockRow}>
                  <span className={styles.stockName}>{s.name}</span>
                  <div className={styles.startStockField}>
                    <span className={styles.startStockFieldLabel}>{tr('huidigeVoorraad')}</span>
                    <input
                      className={styles.stockInput}
                      type="number"
                      min="0"
                      value={stockValues[s.id] ?? ''}
                      onChange={(e) => setStockValues((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className={styles.startStockField}>
                    <span className={styles.startStockFieldLabel}>{tr('minAlert')}</span>
                    <input
                      className={styles.stockInput}
                      type="number"
                      min="0"
                      value={minAlertValues[s.id] ?? ''}
                      onChange={(e) => setMinAlertValues((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className={styles.startStockField}>
                    <span className={styles.startStockFieldLabel}>{tr('eenheid')}</span>
                    <span className={styles.stockUnit}>{s.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.sectionFooter}>
              {stockSaved && <span className={styles.savedMsg}>{tr('opgeslagen')}</span>}
              <button type="submit" className={styles.saveBtn} disabled={savingStock}>
                {savingStock ? `${tCommon('opslaan')}...` : tr('voorraadOpslaan')}
              </button>
            </div>
          </>
        )}
      </form>

      {/* ── Sectie 2b: Chemie voorraad ───────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{tr('chemieVoorraad')}</h2>
        </div>
        <p className={styles.sectionHint}>
          {tr('chemieHint')}
        </p>
        {productList.length === 0 ? (
          <p className={styles.emptyHint}>{tr('geenProductenGevonden')}</p>
        ) : (
          <div className={styles.stockTable}>
            {productList.map((s) => {
              const isDeliveryOpen = s.id in deliveryOpen;
              const isReadingOpen = s.id in readingOpen;
              const isLow = s.min_stock_alert > 0 && s.current_stock <= s.min_stock_alert;
              return (
                <div
                  key={s.id}
                  ref={(el) => { productRowRefs.current[s.id] = el; }}
                  className={[styles.stockRow, highlightProductId === s.id ? styles.rowHighlight : ''].filter(Boolean).join(' ')}
                >
                  <div className={styles.stockTop}>
                    <span className={styles.stockName}>{s.name}</span>
                    <span className={styles.stockAmount}>
                      <span className={[styles.stockName, isLow ? styles.stockLow : ''].filter(Boolean).join(' ')}>
                        {s.current_stock}
                      </span>
                      <span className={styles.stockUnit}>{s.unit}</span>
                    </span>
                  </div>

                  {isReadingOpen ? (
                    <div className={styles.stockInlineForm}>
                      <input
                        className={styles.stockInput}
                        type="number"
                        min="0"
                        step="any"
                        placeholder={tr('nieuweTelling', { unit: s.unit })}
                        value={readingOpen[s.id]}
                        onChange={(e) => setReadingOpen((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        autoFocus
                        style={{ width: 160 }}
                      />
                      <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={() => handleConfirmReading(s.id)}
                        disabled={savingReading === s.id}
                        style={{ height: 34, padding: '0 var(--space-4)' }}
                      >
                        {savingReading === s.id ? '...' : 'OK'}
                      </button>
                      <button
                        type="button"
                        className={styles.deleteProductBtn}
                        onClick={() => setReadingOpen((prev) => { const n = { ...prev }; delete n[s.id]; return n; })}
                      >
                        ✕
                      </button>
                      {readingError[s.id] && (
                        <span className={styles.errorMsg} style={{ width: '100%' }}>{readingError[s.id]}</span>
                      )}
                    </div>
                  ) : isDeliveryOpen ? (
                    <div className={styles.stockInlineForm}>
                      <input
                        className={styles.stockInput}
                        type="number"
                        min="0"
                        step="any"
                        placeholder={s.unit}
                        value={deliveryOpen[s.id]}
                        onChange={(e) => setDeliveryOpen((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        autoFocus
                        style={{ width: 110 }}
                      />
                      <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={() => handleConfirmDelivery(s.id)}
                        disabled={savingDelivery === s.id}
                        style={{ height: 34, padding: '0 var(--space-4)' }}
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
                  ) : (
                    <>
                      <div className={styles.stockActions}>
                        <button
                          type="button"
                          className={styles.stockActionBtn}
                          onClick={() => setReadingOpen((prev) => ({ ...prev, [s.id]: '' }))}
                        >
                          {tr('voorraadOpnemen')}
                        </button>
                        <button
                          type="button"
                          className={styles.stockActionBtn}
                          onClick={() => setDeliveryOpen((prev) => ({ ...prev, [s.id]: '' }))}
                        >
                          {tr('levering')}
                        </button>
                      </div>
                      {readingResult[s.id] && (
                        <span
                          className={styles.sectionHint}
                          style={{ margin: 0, color: readingResult[s.id].consumption < 0 ? 'var(--color-accent-red)' : undefined }}
                        >
                          {readingResult[s.id].isFirstReading
                            ? tr('eersteTelling')
                            : readingResult[s.id].consumption < 0
                              ? tr('negatiefVerbruik', { amount: String(readingResult[s.id].consumption), unit: readingResult[s.id].unit })
                              : tr('verbruikSinds', { amount: String(readingResult[s.id].consumption), unit: readingResult[s.id].unit })}
                        </span>
                      )}
                    </>
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
          <h2 className={styles.sectionTitle}>{tAccount('energiefacturen')}</h2>
        </div>
        <p className={styles.sectionHint}>
          {tr('energieHint')}
        </p>

        <form className={styles.billForm} onSubmit={handleAddBill} noValidate>
          <select
            className={styles.billSelect}
            value={billMonth}
            onChange={(e) => setBillMonth(e.target.value)}
          >
            {monthsLong.map((m, i) => (
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
              placeholder={tr('bedragFactuur')}
            />
          </div>
          <button
            type="submit"
            className={styles.saveBtn}
            disabled={savingBill || !billAmount}
          >
            {savingBill ? `${tCommon('opslaan')}...` : tCommon('toevoegen')}
          </button>
        </form>

        {bills.length > 0 && (
          <div className={styles.billsList}>
            {bills.map((b) => (
              <div key={b.id} className={styles.billRow}>
                <span className={styles.billPeriod}>{monthsLong[b.month - 1]} {b.year}</span>
                <span className={styles.billAmount}>€ {b.amount_euro.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sectie 3b: Watervoorraad ──────────────────────────── */}
      <form className={styles.section} onSubmit={handleSaveWaterCount} noValidate>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{tr('watervoorraad')}</h2>
        </div>
        <p className={styles.sectionHint}>
          {tr('waterHint')}
        </p>

        <div className={styles.priceField}>
          <label className={styles.priceLabel}>{tr('tellerstandWater')}</label>
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
          {waterCountSaved && <span className={styles.savedMsg}>{tr('opgeslagen')}</span>}
          <button type="submit" className={styles.saveBtn} disabled={savingWaterCount}>
            {savingWaterCount ? `${tCommon('opslaan')}...` : tCommon('opslaan')}
          </button>
        </div>
      </form>

      {/* ── Sectie 4: Start hoeveelheid wagens (niet voor selfcarwash) ── */}
      {siteType !== 'selfcarwash' && (
        <form className={styles.section} onSubmit={handleSaveCarCount} noValidate>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{tr('startWagens')}</h2>
          </div>
          <p className={styles.sectionHint}>
            {tr('startWagensHint')}
          </p>

          <div className={styles.priceField}>
            <label className={styles.priceLabel}>{tr('aantalWagens')}</label>
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
              <span className={styles.priceUnit}>{tr('wagens')}</span>
            </div>
          </div>

          <div className={styles.sectionFooter}>
            {carCountSaved && <span className={styles.savedMsg}>{tr('opgeslagen')}</span>}
            <button type="submit" className={styles.saveBtn} disabled={savingCarCount}>
              {savingCarCount ? `${tCommon('opslaan')}...` : tCommon('opslaan')}
            </button>
          </div>
        </form>
      )}

      {/* ── Teller op 0 gezet (niet voor selfcarwash) ── */}
      {siteType !== 'selfcarwash' && (
        <form className={styles.section} onSubmit={handleAddReset} noValidate>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{tr('tellerOpNul')}</h2>
          </div>
          <p className={styles.sectionHint}>
            {tr('tellerOpNulHint')}
          </p>

          {resets.length > 0 && (
            <div className={styles.taskList}>
              {resets.map((r) => (
                <div key={r.date} className={styles.taskRow}>
                  <div className={styles.taskInfo}>
                    <span className={styles.taskDesc}>{tr('tellerOpNulOp', { date: r.date.split('-').reverse().join('/') })}</span>
                    <span className={styles.taskTrigger}>{tr('eindstandWagens', { count: r.end_value.toLocaleString(numLocale) })}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.deleteProductBtn}
                    disabled={savingReset}
                    onClick={() => { if (confirm(tr('confirmResetVerwijderen'))) saveResets({ remove_counter_reset: r.date }); }}
                    aria-label={tr('resetVerwijderen')}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.priceGrid}>
            <div className={styles.priceField}>
              <label className={styles.priceLabel}>{tr('datumReset')}</label>
              <div className={styles.priceInputWrap}>
                <input
                  className={styles.priceInput}
                  type="date"
                  value={resetDate}
                  onChange={(e) => setResetDate(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.priceField}>
              <label className={styles.priceLabel}>{tr('eindstandVoorReset')}</label>
              <div className={styles.priceInputWrap}>
                <input
                  className={styles.priceInput}
                  type="number"
                  min="1"
                  step="1"
                  value={resetEnd}
                  onChange={(e) => setResetEnd(e.target.value)}
                  placeholder="0"
                />
                <span className={styles.priceUnit}>{tr('wagens')}</span>
              </div>
            </div>
          </div>

          <div className={styles.sectionFooter}>
            {resetError && <span className={styles.savedMsg}>{resetError}</span>}
            <button type="submit" className={styles.saveBtn} disabled={savingReset}>
              {savingReset ? `${tCommon('opslaan')}...` : tr('resetToevoegen')}
            </button>
          </div>
        </form>
      )}

      {/* ── Sectie 5: Onderhoudstaken ────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{tAccount('onderhoudstaken')}</h2>
        </div>
        <p className={styles.sectionHint}>
          {tr.rich('onderhoudstakenHint', { count: currentTotalWashes.toLocaleString(numLocale), b: (chunks) => <strong>{chunks}</strong> })}
        </p>

        {/* Task list */}
        {tasks.length > 0 && (
          <div className={styles.taskList}>
            {tasks.map((t) =>
              editingTaskId === t.id ? (
                <form key={t.id} className={styles.addTaskForm} onSubmit={handleSaveEditTask} noValidate>
                  <div className={styles.taskFormField}>
                    <label className={styles.priceLabel}>{tr('omschrijving')}</label>
                    <input
                      className={styles.productInput}
                      type="text"
                      value={editTask.description}
                      onChange={(e) => setEditTask((d) => ({ ...d, description: e.target.value }))}
                      autoFocus
                    />
                  </div>

                  <div className={styles.taskFormField}>
                    <label className={styles.priceLabel}>{tr('typeTrigger')}</label>
                    <div className={styles.radioGroup}>
                      {([['washes', tr('triggerWasbeurten')], ['months', tr('triggerMaanden')], ['fixed_date', tr('triggerVasteDatum')]] as [NewTaskDraft['trigger_type'], string][]).filter(([val]) => siteType !== 'selfcarwash' || val !== 'washes').map(([val, lbl]) => (
                        <label key={val} className={styles.radioLabel}>
                          <input
                            type="radio"
                            name="edit_task_trigger_type"
                            value={val}
                            checked={editTask.trigger_type === val}
                            onChange={() => setEditTask((d) => ({ ...d, trigger_type: val }))}
                          />
                          {lbl}
                        </label>
                      ))}
                    </div>
                  </div>

                  {editTask.trigger_type === 'washes' && (
                    <div className={styles.taskFormRow}>
                      <div className={styles.taskFormField}>
                        <label className={styles.priceLabel}>{tr('intervalWasbeurten')}</label>
                        <input
                          className={styles.stockInput}
                          type="number"
                          min={1}
                          value={editTask.trigger_value || ''}
                          onChange={(e) => setEditTask((d) => ({ ...d, trigger_value: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className={styles.taskFormField}>
                        <label className={styles.priceLabel}>{tr('tellerstandLaatsteKeer')}</label>
                        <input
                          className={styles.stockInput}
                          type="number"
                          min={0}
                          value={editTask.washes_at_last_done || ''}
                          onChange={(e) => setEditTask((d) => ({ ...d, washes_at_last_done: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className={styles.taskFormField}>
                        <label className={styles.priceLabel}>{tr('datumLaatsteKeer')}</label>
                        <input
                          className={styles.stockInput}
                          type="date"
                          value={editTask.last_done_at}
                          onChange={(e) => setEditTask((d) => ({ ...d, last_done_at: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  {editTask.trigger_type === 'months' && (
                    <div className={styles.taskFormRow}>
                      <div className={styles.taskFormField}>
                        <label className={styles.priceLabel}>{tr('intervalMaanden')}</label>
                        <input
                          className={styles.stockInput}
                          type="number"
                          min={1}
                          value={editTask.trigger_value || ''}
                          onChange={(e) => setEditTask((d) => ({ ...d, trigger_value: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className={styles.taskFormField}>
                        <label className={styles.priceLabel}>{tr('datumLaatsteUitvoering')}</label>
                        <input
                          className={styles.stockInput}
                          type="date"
                          value={editTask.last_done_at}
                          onChange={(e) => setEditTask((d) => ({ ...d, last_done_at: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  {editTask.trigger_type === 'fixed_date' && (
                    <div className={styles.taskFormRow}>
                      <div className={styles.taskFormField}>
                        <label className={styles.priceLabel}>{tr('dag')}</label>
                        <input
                          className={styles.stockInput}
                          type="number"
                          min={1}
                          max={31}
                          value={editTask.trigger_day || ''}
                          onChange={(e) => setEditTask((d) => ({ ...d, trigger_day: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                      <div className={styles.taskFormField}>
                        <label className={styles.priceLabel}>{tAccount('maand')}</label>
                        <select
                          className={styles.stockInput}
                          value={editTask.trigger_month}
                          onChange={(e) => setEditTask((d) => ({ ...d, trigger_month: parseInt(e.target.value) }))}
                        >
                          {monthsShort.map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.taskFormField}>
                        <label className={styles.priceLabel}>{tr('datumLaatsteUitvoering')}</label>
                        <input
                          className={styles.stockInput}
                          type="date"
                          value={editTask.last_done_at}
                          onChange={(e) => setEditTask((d) => ({ ...d, last_done_at: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  <div className={styles.taskFormActions}>
                    <button type="button" className={styles.cancelBtn} onClick={() => setEditingTaskId(null)}>
                      {tCommon('annuleren')}
                    </button>
                    <button type="submit" className={styles.saveBtn} disabled={savingEditTask || !editTask.description.trim()}>
                      {savingEditTask ? `${tCommon('opslaan')}...` : tr('wijzigingenOpslaan')}
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  key={t.id}
                  ref={(el) => { taskRowRefs.current[t.id] = el; }}
                  className={[styles.taskRow, highlightTaskId === t.id ? styles.rowHighlight : ''].filter(Boolean).join(' ')}
                >
                  <div className={styles.taskInfo}>
                    <span className={styles.taskDesc}>{t.description}</span>
                    <span className={styles.taskTrigger}>
                      {taskTriggerLabel(t, tr, monthsLong, numLocale)}
                      {t.last_done_at && ` — ${tr('laatsteDatum', { date: new Date(t.last_done_at).toLocaleDateString(numLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }) })}`}
                      {t.trigger_type === 'washes' && t.washes_at_last_done > 0 && ` (${tr('wgn', { count: t.washes_at_last_done.toLocaleString(numLocale) })})`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.deleteProductBtn}
                    onClick={() => handleStartEditTask(t)}
                    aria-label={tr('itemWijzigen', { name: t.description })}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className={styles.deleteProductBtn}
                    onClick={() => handleDeleteTask(t.id)}
                    disabled={deletingTask === t.id}
                    aria-label={tr('itemVerwijderen', { name: t.description })}
                  >
                    {deletingTask === t.id ? '...' : '✕'}
                  </button>
                </div>
              ),
            )}
          </div>
        )}
        {tasks.length === 0 && !addingTask && (
          <p className={styles.emptyHint}>{tr('nogGeenTaken')}</p>
        )}

        {/* Add task form */}
        {addingTask ? (
          <form className={styles.addTaskForm} onSubmit={handleAddTask} noValidate>
            <div className={styles.taskFormField}>
              <label className={styles.priceLabel}>{tr('omschrijving')}</label>
              <input
                className={styles.productInput}
                type="text"
                placeholder={tr('omschrijvingPlaceholder')}
                value={newTask.description}
                onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                autoFocus
              />
            </div>

            <div className={styles.taskFormField}>
              <label className={styles.priceLabel}>{tr('typeTrigger')}</label>
              <div className={styles.radioGroup}>
                {([['washes', tr('triggerWasbeurten')], ['months', tr('triggerMaanden')], ['fixed_date', tr('triggerVasteDatum')]] as [NewTaskDraft['trigger_type'], string][]).filter(([val]) => siteType !== 'selfcarwash' || val !== 'washes').map(([val, lbl]) => (
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
                  <label className={styles.priceLabel}>{tr('intervalWasbeurten')}</label>
                  <input
                    className={styles.stockInput}
                    type="number"
                    min={1}
                    placeholder={tr('bijv', { value: '5000' })}
                    value={newTask.trigger_value || ''}
                    onChange={(e) => setNewTask((t) => ({ ...t, trigger_value: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>{tr('tellerstandLaatsteKeer')}</label>
                  <input
                    className={styles.stockInput}
                    type="number"
                    min={0}
                    placeholder={tr('bijv', { value: '120000' })}
                    value={newTask.washes_at_last_done || ''}
                    onChange={(e) => setNewTask((t) => ({ ...t, washes_at_last_done: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>{tr('datumLaatsteKeer')}</label>
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
                  <label className={styles.priceLabel}>{tr('intervalMaanden')}</label>
                  <input
                    className={styles.stockInput}
                    type="number"
                    min={1}
                    placeholder={tr('bijv', { value: '3' })}
                    value={newTask.trigger_value || ''}
                    onChange={(e) => setNewTask((t) => ({ ...t, trigger_value: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>{tr('datumLaatsteUitvoering')}</label>
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
                  <label className={styles.priceLabel}>{tr('dag')}</label>
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
                  <label className={styles.priceLabel}>{tAccount('maand')}</label>
                  <select
                    className={styles.stockInput}
                    value={newTask.trigger_month}
                    onChange={(e) => setNewTask((t) => ({ ...t, trigger_month: parseInt(e.target.value) }))}
                  >
                    {monthsShort.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.taskFormField}>
                  <label className={styles.priceLabel}>{tr('datumLaatsteUitvoering')}</label>
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
                {tCommon('annuleren')}
              </button>
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={savingTask || !newTask.description.trim()}
              >
                {savingTask ? `${tCommon('opslaan')}...` : tr('taakToevoegen')}
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
            {tr('onderhoudstaakToevoegen')}
          </button>
        )}
      </div>

    </div>
  );
}
