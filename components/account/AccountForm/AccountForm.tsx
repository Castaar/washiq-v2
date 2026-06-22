'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './AccountForm.module.scss';
import { IconEye, IconEyeOff } from '@/components/ui/icons';

interface UserItem {
  id: string;
  name: string;
  role: string;
}

export interface EnergyBillItem {
  id: string;
  year: number;
  month: number;
  amount_euro: number;
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
  users: UserItem[];
  siteId: string;
  currentUser: { id: string; name: string; email: string; birthday?: string } | null;
  role: 'developer' | 'owner' | 'employee' | 'technician';
  maintenanceTasks: MaintenanceTaskItem[];
  currentTotalWashes: number;
  energyBills: EnergyBillItem[];
}

// ── Main component ────────────────────────────────────────────
export function AccountForm({ users: initialUsers, siteId, currentUser, role, maintenanceTasks: initialTasks, currentTotalWashes, energyBills: initialBills }: AccountFormProps) {
  const isEmployee = role === 'employee';

  // Accountgegevens
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [birthday, setBirthday] = useState(currentUser?.birthday ?? '');

  // Personeelsgegevens
  const [users, setUsers] = useState(initialUsers);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'employee' | 'technician'>('employee');
  const [saving, setSaving] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [addUserSuccess, setAddUserSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId: currentUser?.id,
          email: email || undefined,
          newPassword: password || undefined,
          birthday: birthday || undefined,
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
    setAddUserError('');
    setAddUserSuccess('');
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      setAddUserError('Vul naam, e-mailadres en wachtwoord in.');
      return;
    }
    setAddingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteIds: siteId ? [siteId] : [], name: newName.trim(), email: newEmail.trim(), password: newPassword, role: newRole }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (res.ok && data.id) {
        setUsers((prev) => [...prev, { id: data.id!, name: newName.trim(), role: newRole }]);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('employee');
        setAddUserSuccess(`${newName.trim()} is toegevoegd.`);
        setTimeout(() => setAddUserSuccess(''), 4000);
      } else {
        setAddUserError(data.error ?? `Fout (${res.status}) — probeer opnieuw.`);
      }
    } catch {
      setAddUserError('Netwerkfout — probeer opnieuw.');
    } finally {
      setAddingUser(false);
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
      if (task?.trigger_type === 'washes') body.washes_at_last_done = currentTotalWashes;
      await fetch(`/api/maintenance/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, last_done_at: new Date(fields.date).toISOString(), washes_at_last_done: task?.trigger_type === 'washes' ? currentTotalWashes : t.washes_at_last_done }
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
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Verjaardag</label>
              <input
                className={styles.input}
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                onBlur={() =>
                  fetch('/api/account', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentUserId: currentUser?.id, birthday }),
                  })
                }
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
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Verjaardag</label>
            <input
              className={styles.input}
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
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
          {users.map((u) => {
            const canRevoke =
              u.id !== currentUser?.id &&
              (role === 'developer' || u.role === 'employee' || u.role === 'technician');
            return (
              <div key={u.id} className={styles.userRow}>
                <span className={styles.userName}>
                  {u.name}
                  {u.role === 'technician' && <span className={styles.roleBadge}> Technieker</span>}
                </span>
                {canRevoke && (
                  <button
                    type="button"
                    className={styles.revokeBtn}
                    onClick={() => handleRevokeUser(u.id)}
                  >
                    Toegang opzeggen
                  </button>
                )}
              </div>
            );
          })}
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
            <select
              className={styles.input}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'employee' | 'technician')}
            >
              <option value="employee">Medewerker</option>
              <option value="technician">Technieker</option>
            </select>
          </div>
          <button
            type="button"
            className={styles.addUserBtn}
            onClick={handleAddUser}
            disabled={addingUser}
          >
            {addingUser ? 'Bezig...' : 'Opslaan'}
          </button>
          {addUserError && <p className={styles.addUserError}>{addUserError}</p>}
          {addUserSuccess && <p className={styles.addUserSuccess}>{addUserSuccess}</p>}
        </div>
      </section>

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
