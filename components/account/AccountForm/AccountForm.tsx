'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './AccountForm.module.scss';
import { IconEye, IconEyeOff } from '@/components/ui/icons';

interface UserItem {
  id: string;
  name: string;
}

interface PriceConfigData {
  id: string;
  energyPerKw: number;
  waterPerLiter: number;
  saltPerKg: number;
  flockPerKg: number;
  clothPerUnit: number;
  chemicalPrices: { name: string; price: number }[];
}

export interface EnergyBillItem {
  id: string;
  year: number;
  month: number;
  amount_euro: number;
}

export interface StockItem {
  id: string;
  name: string;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
}

export interface MaintenanceTaskItem {
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

export interface AccountFormProps {
  priceConfig: PriceConfigData | null;
  users: UserItem[];
  siteId: string;
  currentUser: { id: string; name: string; email: string } | null;
  role: 'developer' | 'owner' | 'employee';
  chemieLabels: string[];
  stockItems: StockItem[];
  maintenanceTasks: MaintenanceTaskItem[];
  currentTotalWashes: number;
  energyBills: EnergyBillItem[];
}

// ── Price field ──────────────────────────────────────────────
function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={styles.priceGroup}>
      <label className={styles.priceLabel}>{label}</label>
      <div className={styles.priceInputWrap}>
        <span className={styles.euroSign} aria-hidden="true">€</span>
        <input
          className={styles.priceInput}
          type="number"
          step="0.001"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0,000"
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function AccountForm({ priceConfig, users: initialUsers, siteId, currentUser, role, chemieLabels, stockItems: initialStock, maintenanceTasks: initialTasks, currentTotalWashes, energyBills: initialBills }: AccountFormProps) {
  const isEmployee = role === 'employee';

  // Accountgegevens
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [password, setPassword] = useState('');

  // Kostprijzen
  const [water, setWater] = useState(String(priceConfig?.waterPerLiter ?? ''));
  const [zout, setZout] = useState(String(priceConfig?.saltPerKg ?? ''));
  const [flock, setFlock] = useState(String(priceConfig?.flockPerKg ?? ''));
  const [ruitendoekjes, setRuitendoekjes] = useState(String(priceConfig?.clothPerUnit ?? ''));
  const [chemiePrices, setChemiePrices] = useState<string[]>(
    chemieLabels.map((label) => {
      const match = priceConfig?.chemicalPrices.find((c) => c.name === label);
      return String(match?.price ?? '');
    }),
  );

  // Personeelsgegevens
  const [users, setUsers] = useState(initialUsers);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

  // All tracked stock products: fixed ones + chemicals from programs
  const ALL_STOCK_PRODUCTS: { name: string; unit: string }[] = [
    { name: 'Zoutverzachter', unit: 'kg' },
    { name: 'Flockmiddel', unit: 'kg' },
    { name: 'Ruitendoekjes', unit: 'stuks' },
    ...chemieLabels.map((name) => ({ name, unit: 'L' })),
  ];

  // Energiefacturen
  const MAANDEN_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const [bills, setBills] = useState<EnergyBillItem[]>(initialBills);
  const [billYear, setBillYear] = useState(String(new Date().getFullYear()));
  const [billMonth, setBillMonth] = useState(String(new Date().getMonth() + 1));
  const [billAmount, setBillAmount] = useState('');
  const [savingBill, setSavingBill] = useState(false);
  const [editingBill, setEditingBill] = useState<string | null>(null);
  const [editBillAmount, setEditBillAmount] = useState('');

  async function handleSaveBill() {
    if (!billAmount) return;
    setSavingBill(true);
    try {
      const res = await fetch('/api/energy-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, year: Number(billYear), month: Number(billMonth), amount_euro: parseFloat(billAmount) }),
      });
      if (res.ok) {
        const data = (await res.json()) as EnergyBillItem;
        setBills((prev) => {
          const filtered = prev.filter((b) => !(b.year === data.year && b.month === data.month));
          return [data, ...filtered].sort((a, b) => b.year - a.year || b.month - a.month);
        });
        setBillAmount('');
      }
    } finally {
      setSavingBill(false);
    }
  }

  async function handleUpdateBill(id: string) {
    const res = await fetch(`/api/energy-bills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_euro: parseFloat(editBillAmount) }),
    });
    if (res.ok) {
      const data = (await res.json()) as EnergyBillItem;
      setBills((prev) => prev.map((b) => (b.id === id ? data : b)));
      setEditingBill(null);
    }
  }

  async function handleDeleteBill(id: string) {
    await fetch(`/api/energy-bills/${id}`, { method: 'DELETE' });
    setBills((prev) => prev.filter((b) => b.id !== id));
  }

  // Voorraad (stock)
  const [stocks, setStocks] = useState<StockItem[]>(initialStock);
  const [deliveryOpen, setDeliveryOpen] = useState<Record<string, string>>({}); // stockId -> qty string
  const [savingDelivery, setSavingDelivery] = useState<string | null>(null);
  // Per-chemical init form for chemicals without a stock entry yet
  const [initOpen, setInitOpen] = useState<Record<string, { quantity: string; alert: string }>>({}); // chemName -> fields
  const [savingInit, setSavingInit] = useState<string | null>(null);

  function updateChemiePrice(index: number, value: string) {
    setChemiePrices((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          priceConfigId: priceConfig?.id,
          waterPerLiter: parseFloat(water) || 0,
          saltPerKg: parseFloat(zout) || 0,
          flockPerKg: parseFloat(flock) || 0,
          clothPerUnit: parseFloat(ruitendoekjes) || 0,
          chemicalPrices: chemieLabels.map((name, i) => ({
            name,
            price: parseFloat(chemiePrices[i] ?? '0') || 0,
          })),
          currentUserId: currentUser?.id,
          email: email || undefined,
          newPassword: password || undefined,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeUser(userId: string) {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeSiteId: siteId }),
    });
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  async function handleAddUser(e: React.MouseEvent) {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) return;
    setAddingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteIds: [siteId], name: newName, email: newEmail, password: newPassword, role: 'employee' }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        setUsers((prev) => [...prev, { id: data.id, name: newName }]);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
      }
    } finally {
      setAddingUser(false);
    }
  }

  // ── Stock handlers ─────────────────────────────────────────
  function toggleDelivery(id: string) {
    setDeliveryOpen((prev) =>
      id in prev ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)) : { ...prev, [id]: '' },
    );
  }

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
        setStocks((prev) => prev.map((s) => (s.id === stockId ? { ...s, current_stock: updated.current_stock } : s)));
        setDeliveryOpen((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== stockId)));
      }
    } finally {
      setSavingDelivery(null);
    }
  }

  async function handleDeleteStock(stockId: string) {
    await fetch(`/api/stock/${stockId}`, { method: 'DELETE' });
    setStocks((prev) => prev.filter((s) => s.id !== stockId));
  }

  function toggleInit(name: string) {
    setInitOpen((prev) =>
      name in prev
        ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== name))
        : { ...prev, [name]: { quantity: '', alert: '' } },
    );
  }

  async function handleCreateStock(name: string) {
    const fields = initOpen[name];
    const unit = ALL_STOCK_PRODUCTS.find((p) => p.name === name)?.unit ?? 'L';
    setSavingInit(name);
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          name,
          unit,
          min_stock_alert: parseFloat(fields.alert) || 0,
          current_stock: parseFloat(fields.quantity) || 0,
        }),
      });
      if (res.ok) {
        const item = (await res.json()) as StockItem;
        setStocks((prev) => [...prev, item]);
        setInitOpen((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== name)));
      }
    } finally {
      setSavingInit(null);
    }
  }

  // ── Maintenance task state ─────────────────────────────────
  const [tasks, setTasks] = useState<MaintenanceTaskItem[]>(initialTasks);
  // markOpen: taskId → { date: string, washes: string }
  const [markOpen, setMarkOpen] = useState<Record<string, { date: string; washes: string }>>({});
  const [savingMark, setSavingMark] = useState<string | null>(null);

  const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  function taskTriggerLabel(t: MaintenanceTaskItem): string {
    if (t.trigger_type === 'washes') return `Elke ${(t.trigger_value ?? 0).toLocaleString('nl-BE')} wassingen`;
    if (t.trigger_type === 'months') {
      if (t.trigger_value === 12) return '1× per jaar';
      if (t.trigger_value === 24) return 'Om de 2 jaar';
      return `Elke ${t.trigger_value} maanden`;
    }
    if (t.trigger_type === 'fixed_date') return `${t.trigger_day} ${MAANDEN[(t.trigger_month ?? 1) - 1]} (jaarlijks)`;
    if (t.trigger_type === 'fixed_months') return (t.trigger_month_list ?? []).map((m) => MAANDEN[m - 1]).join(' + ');
    return '';
  }

  function computeNextDue(t: MaintenanceTaskItem): { label: string; overdue: boolean } {
    const now = new Date();
    if (t.trigger_type === 'washes') {
      const next = (t.washes_at_last_done ?? 0) + t.trigger_value;
      const overdue = currentTotalWashes >= next;
      return {
        label: `Bij ${next.toLocaleString('nl-BE')} wgn (nu ${currentTotalWashes.toLocaleString('nl-BE')})`,
        overdue,
      };
    }
    if (t.trigger_type === 'months') {
      if (!t.last_done_at) return { label: 'Nog niet gedaan', overdue: true };
      const next = new Date(t.last_done_at);
      next.setMonth(next.getMonth() + t.trigger_value);
      const overdue = now >= next;
      return { label: next.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }), overdue };
    }
    if (t.trigger_type === 'fixed_date') {
      const d = t.trigger_day ?? 1;
      const m = (t.trigger_month ?? 1) - 1;
      let next = new Date(now.getFullYear(), m, d);
      if (next <= now) next = new Date(now.getFullYear() + 1, m, d);
      return { label: next.toLocaleDateString('nl-BE', { day: '2-digit', month: 'long', year: 'numeric' }), overdue: false };
    }
    if (t.trigger_type === 'fixed_months') {
      const months = t.trigger_month_list ?? [];
      if (months.length === 0) return { label: '—', overdue: false };
      let next: Date | null = null;
      for (const m of months) {
        let candidate = new Date(now.getFullYear(), m - 1, 1);
        if (candidate <= now) candidate = new Date(now.getFullYear() + 1, m - 1, 1);
        if (!next || candidate < next) next = candidate;
      }
      return { label: next!.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' }), overdue: false };
    }
    return { label: '—', overdue: false };
  }

  function toggleMark(id: string) {
    setMarkOpen((prev) =>
      id in prev
        ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id))
        : { ...prev, [id]: { date: new Date().toISOString().slice(0, 10), washes: String(currentTotalWashes) } },
    );
  }

  async function handleMarkDone(taskId: string) {
    const fields = markOpen[taskId];
    if (!fields?.date) return;
    setSavingMark(taskId);
    try {
      const task = tasks.find((t) => t.id === taskId);
      const body: Record<string, unknown> = { last_done_at: fields.date };
      if (task?.trigger_type === 'washes') body.washes_at_last_done = parseInt(fields.washes) || 0;
      await fetch(`/api/maintenance/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, last_done_at: new Date(fields.date).toISOString(), washes_at_last_done: parseInt(fields.washes) || t.washes_at_last_done }
            : t,
        ),
      );
      setMarkOpen((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== taskId)));
    } finally {
      setSavingMark(null);
    }
  }

  if (isEmployee) {
    return (
      <div className={styles.card}>
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Accountgegevens</h2>
          <div className={styles.row}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Gebruikersnaam</label>
              <input
                className={styles.input}
                type="text"
                value={currentUser?.name ?? ''}
                readOnly
                disabled
              />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <form className={styles.card} onSubmit={handleSave} noValidate>

      {/* ── Accountgegevens ─────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Accountgegevens</h2>
        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Gebruikersnaam</label>
            <input
              className={styles.input}
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Password</label>
            <div className={styles.passwordWrap}>
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
              >
                {showPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Kostprijzen ─────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Kostprijzen</h2>
        <div className={styles.priceRow}>
          <PriceField label="Water" value={water} onChange={setWater} />
          <PriceField label="Zoutverzachter (kg)" value={zout} onChange={setZout} />
          <PriceField label="Flockmiddel (kg)" value={flock} onChange={setFlock} />
          <PriceField label="Ruitendoekjes (stuks)" value={ruitendoekjes} onChange={setRuitendoekjes} />
        </div>
        <div className={styles.priceRow}>
          {chemieLabels.map((label, i) => (
            <PriceField
              key={label}
              label={label}
              value={chemiePrices[i] ?? ''}
              onChange={(v) => updateChemiePrice(i, v)}
            />
          ))}
        </div>
      </section>

      {/* ── Energiefacturen ─────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Energiefacturen</h2>

        {/* Add / upsert row */}
        <div className={styles.addUserRow} style={{ alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
          <div className={styles.fieldGroup} style={{ flex: '0 0 100px' }}>
            <label className={styles.fieldLabel}>Jaar</label>
            <input
              className={styles.input}
              type="number"
              min="2020"
              max="2099"
              value={billYear}
              onChange={(e) => setBillYear(e.target.value)}
            />
          </div>
          <div className={styles.fieldGroup} style={{ flex: '0 0 130px' }}>
            <label className={styles.fieldLabel}>Maand</label>
            <select className={styles.input} value={billMonth} onChange={(e) => setBillMonth(e.target.value)}>
              {MAANDEN_SHORT.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className={styles.fieldGroup} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Bedrag (€)</label>
            <div className={styles.priceInputWrap}>
              <span className={styles.euroSign} aria-hidden="true">€</span>
              <input
                className={styles.priceInput}
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className={styles.addUserBtn}
            onClick={handleSaveBill}
            disabled={savingBill || !billAmount}
            style={{ flexShrink: 0 }}
          >
            {savingBill ? 'Bezig...' : 'Opslaan'}
          </button>
        </div>

        {/* Bill list */}
        <div className={styles.stockList}>
          {bills.length === 0 && (
            <p style={{ opacity: 0.5, fontSize: 13 }}>Nog geen facturen ingevoerd.</p>
          )}
          {bills.map((b) => (
            <div key={b.id} className={styles.stockRow}>
              <span className={styles.stockName}>{MAANDEN_SHORT[b.month - 1]} {b.year}</span>
              {editingBill === b.id ? (
                <div className={styles.deliveryInline}>
                  <span className={styles.euroSign} aria-hidden="true">€</span>
                  <input
                    className={styles.deliveryInput}
                    type="number"
                    step="0.01"
                    min="0"
                    value={editBillAmount}
                    onChange={(e) => setEditBillAmount(e.target.value)}
                    autoFocus
                    style={{ width: 100 }}
                  />
                  <button type="button" className={styles.confirmDeliveryBtn} onClick={() => handleUpdateBill(b.id)}>OK</button>
                  <button type="button" className={styles.deleteStockBtn} onClick={() => setEditingBill(null)}>✕</button>
                </div>
              ) : (
                <>
                  <span className={styles.stockMeta}>€ {b.amount_euro.toFixed(2)}</span>
                  <div className={styles.stockActions}>
                    <button
                      type="button"
                      className={styles.addDeliveryBtn}
                      onClick={() => { setEditingBill(b.id); setEditBillAmount(String(b.amount_euro)); }}
                    >
                      Wijzigen
                    </button>
                    <button type="button" className={styles.deleteStockBtn} onClick={() => handleDeleteBill(b.id)}>✕</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Personeelsgegevens ──────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Personeelsgegevens</h2>
        <div className={styles.userList}>
          {users.map((u) => (
            <div key={u.id} className={styles.userRow}>
              <span className={styles.userName}>{u.name}</span>
              <button
                type="button"
                className={styles.revokeBtn}
                onClick={() => handleRevokeUser(u.id)}
              >
                Toegang opzeggen
              </button>
            </div>
          ))}
        </div>
        <div className={styles.addUserBlock}>
          <span className={styles.addUserLabel}>Nieuwe gebruiker toevoegen</span>
          <div className={styles.addUserRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="John Dhoe"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className={styles.input}
              type="email"
              placeholder="john.dhoe@domain.com"
              autoComplete="off"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <div className={styles.passwordWrap}>
              <input
                className={styles.input}
                type={showNewUserPassword ? 'text' : 'password'}
                placeholder="••••••••••"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowNewUserPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showNewUserPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
              >
                {showNewUserPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
              </button>
            </div>
          </div>
          <button
            type="button"
            className={styles.addUserBtn}
            onClick={handleAddUser}
            disabled={addingUser}
          >
            {addingUser ? 'Bezig...' : 'Opslaan'}
          </button>
        </div>
      </section>

      {/* ── Voorraad beheer ─────────────────────────────────── */}
      {(true) && (
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Chemie voorraad</h2>
          <div className={styles.stockList}>
            {ALL_STOCK_PRODUCTS.map(({ name }) => {
              const s = stocks.find((x) => x.name === name);
              if (s) {
                // Existing stock entry
                const isLow = s.min_stock_alert > 0 && s.current_stock <= s.min_stock_alert;
                const isDeliveryOpen = s.id in deliveryOpen;
                return (
                  <div key={name} className={styles.stockRow}>
                    <span className={styles.stockName}>{s.name}</span>
                    <span className={[styles.stockMeta, isLow ? styles.stockLow : ''].filter(Boolean).join(' ')}>
                      {s.current_stock} {s.unit}
                    </span>
                    {s.min_stock_alert > 0 && (
                      <span className={styles.stockAlert}>min. {s.min_stock_alert} {s.unit}</span>
                    )}
                    <div className={styles.stockActions}>
                      {isDeliveryOpen ? (
                        <div className={styles.deliveryInline}>
                          <input
                            className={styles.deliveryInput}
                            type="number"
                            min="0"
                            step="any"
                            placeholder={s.unit}
                            value={deliveryOpen[s.id]}
                            onChange={(e) => setDeliveryOpen((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            autoFocus
                          />
                          <button
                            type="button"
                            className={styles.confirmDeliveryBtn}
                            onClick={() => handleConfirmDelivery(s.id)}
                            disabled={savingDelivery === s.id}
                          >
                            {savingDelivery === s.id ? '...' : 'OK'}
                          </button>
                          <button
                            type="button"
                            className={styles.deleteStockBtn}
                            onClick={() => toggleDelivery(s.id)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.addDeliveryBtn}
                          onClick={() => toggleDelivery(s.id)}
                        >
                          + Levering
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.deleteStockBtn}
                        onClick={() => handleDeleteStock(s.id)}
                        title="Verwijderen"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              }

              // No stock entry yet — show inline init form
              const init = initOpen[name];
              return (
                <div key={name} className={styles.stockRow}>
                  <span className={styles.stockName}>{name}</span>
                  <span className={styles.stockMeta} style={{ opacity: 0.4 }}>Niet ingesteld</span>
                  <div className={styles.stockActions}>
                    {init ? (
                      <div className={styles.deliveryInline}>
                        <input
                          className={styles.deliveryInput}
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Hoeveelheid"
                          value={init.quantity}
                          style={{ width: 110 }}
                          onChange={(e) => setInitOpen((prev) => ({ ...prev, [name]: { ...prev[name], quantity: e.target.value } }))}
                          autoFocus
                        />
                        <input
                          className={styles.deliveryInput}
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Min. alert"
                          value={init.alert}
                          style={{ width: 90 }}
                          onChange={(e) => setInitOpen((prev) => ({ ...prev, [name]: { ...prev[name], alert: e.target.value } }))}
                        />
                        <button
                          type="button"
                          className={styles.confirmDeliveryBtn}
                          onClick={() => handleCreateStock(name)}
                          disabled={savingInit === name}
                        >
                          {savingInit === name ? '...' : 'OK'}
                        </button>
                        <button
                          type="button"
                          className={styles.deleteStockBtn}
                          onClick={() => toggleInit(name)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.addDeliveryBtn}
                        onClick={() => toggleInit(name)}
                      >
                        Instellen
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Onderhoud installatie ────────────────────────── */}
      {tasks.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Onderhoud installatie</h2>
          <div className={styles.maintenanceList}>
            {tasks.map((t) => {
              const { label: nextLabel, overdue } = computeNextDue(t);
              const isMarkOpen = t.id in markOpen;
              const lastDate = t.last_done_at
                ? new Date(t.last_done_at).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : null;
              return (
                <div key={t.id} className={[styles.maintenanceRow, overdue ? styles.maintenanceOverdue : ''].filter(Boolean).join(' ')}>
                  <div className={styles.maintenanceInfo}>
                    <span className={styles.maintenanceDesc}>{t.description}</span>
                    <span className={styles.maintenanceTrigger}>{taskTriggerLabel(t)}</span>
                  </div>
                  <div className={styles.maintenanceMeta}>
                    <span className={[styles.maintenanceStatus, overdue ? styles.statusOverdue : styles.statusOk].join(' ')}>
                      {overdue ? 'Te laat' : 'In orde'}
                    </span>
                    <span className={styles.maintenanceNext}>Volgende: {nextLabel}</span>
                    {lastDate && <span className={styles.maintenanceLast}>Laatste: {lastDate}</span>}
                  </div>
                  <div className={styles.maintenanceActions}>
                    {isMarkOpen ? (
                      <div className={styles.markInline}>
                        <input
                          className={styles.deliveryInput}
                          type="date"
                          value={markOpen[t.id].date}
                          onChange={(e) => setMarkOpen((prev) => ({ ...prev, [t.id]: { ...prev[t.id], date: e.target.value } }))}
                          style={{ width: 130 }}
                        />
                        {t.trigger_type === 'washes' && (
                          <input
                            className={styles.deliveryInput}
                            type="number"
                            min="0"
                            placeholder="wagens"
                            value={markOpen[t.id].washes}
                            onChange={(e) => setMarkOpen((prev) => ({ ...prev, [t.id]: { ...prev[t.id], washes: e.target.value } }))}
                            style={{ width: 90 }}
                          />
                        )}
                        <button
                          type="button"
                          className={styles.confirmDeliveryBtn}
                          onClick={() => handleMarkDone(t.id)}
                          disabled={savingMark === t.id}
                        >
                          {savingMark === t.id ? '...' : 'OK'}
                        </button>
                        <button
                          type="button"
                          className={styles.deleteStockBtn}
                          onClick={() => toggleMark(t.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={[styles.addDeliveryBtn, overdue ? styles.markDoneUrgent : ''].filter(Boolean).join(' ')}
                        onClick={() => toggleMark(t.id)}
                      >
                        Gedaan op…
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className={styles.footer}>
        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
        <Link href={`/handleiding${siteId ? `?site=${siteId}` : ''}`} className={styles.helpLink}>
          Handleiding bekijken
        </Link>
      </div>
    </form>
  );
}
