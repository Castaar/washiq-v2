'use client';

import { useState } from 'react';
import styles from './OpdrachtenPanel.module.scss';

export interface OpdrachtItem {
  id: string;
  date: string;
  text: string;
  createdByName: string;
  assignedToIds: string[];
  isDone: boolean;
  doneByName: string;
  doneAt: string | null;
}

export interface SiteEmployee {
  id: string;
  name: string;
}

interface OpdrachtenPanelProps {
  siteId: string;
  userRole: string;
  opdrachten: OpdrachtItem[];
  employees: SiteEmployee[];
  activeDate: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function OpdrachtenPanel({ siteId, userRole, opdrachten: initial, employees, activeDate }: OpdrachtenPanelProps) {
  const [items, setItems] = useState<OpdrachtItem[]>(initial);
  const [newText, setNewText] = useState('');
  const [newDate, setNewDate] = useState(activeDate);
  const [newAssigned, setNewAssigned] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(activeDate);

  const isOwner = userRole === 'owner' || userRole === 'developer';

  const visibleItems = items.filter((o) => o.date === selectedDate);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSaving(true);
    const res = await fetch('/api/opdrachten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, date: newDate, text: newText, assignedToIds: newAssigned }),
    });
    if (res.ok) {
      const item = (await res.json()) as OpdrachtItem;
      setItems((prev) => [...prev, item]);
      setNewText('');
      setNewAssigned([]);
    }
    setSaving(false);
  }

  async function toggleDone(item: OpdrachtItem) {
    const res = await fetch(`/api/opdrachten/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: !item.isDone }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((o) => o.id === item.id ? { ...o, isDone: !o.isDone } : o),
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Opdracht verwijderen?')) return;
    const res = await fetch(`/api/opdrachten/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((o) => o.id !== id));
  }

  function toggleEmployee(id: string) {
    setNewAssigned((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  // Build unique dates from items + selected dates for navigation
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dateOptions = Array.from(new Set([today, tomorrow, ...items.map((o) => o.date)])).sort();

  return (
    <div className={styles.wrapper}>
      {/* ── Date navigation ─────────────────────────────── */}
      <div className={styles.dateNav}>
        {dateOptions.map((d) => (
          <button
            key={d}
            className={[styles.dateBtn, d === selectedDate ? styles.active : ''].join(' ')}
            onClick={() => setSelectedDate(d)}
          >
            {d === today ? 'Vandaag' : d === tomorrow ? 'Morgen' : new Date(d + 'T00:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
          </button>
        ))}
      </div>

      <p className={styles.dateLabel}>{fmtDate(selectedDate)}</p>

      {/* ── Opdrachten lijst ─────────────────────────────── */}
      <div className={styles.list}>
        {visibleItems.length === 0 && (
          <p className={styles.empty}>
            {isOwner ? 'Geen opdrachten voor deze dag. Voeg er een toe hieronder.' : 'Geen opdrachten voor vandaag.'}
          </p>
        )}
        {visibleItems.map((o) => (
          <div key={o.id} className={[styles.item, o.isDone ? styles.done : ''].join(' ')}>
            <button
              className={[styles.checkbox, o.isDone ? styles.checked : ''].join(' ')}
              onClick={() => toggleDone(o)}
              aria-label={o.isDone ? 'Markeer als open' : 'Markeer als gedaan'}
            >
              {o.isDone && <span>✓</span>}
            </button>
            <div className={styles.itemBody}>
              <p className={styles.itemText}>{o.text}</p>
              {o.isDone && o.doneByName && (
                <p className={styles.itemMeta}>Gedaan door {o.doneByName}</p>
              )}
              {!o.isDone && o.assignedToIds.length > 0 && (
                <p className={styles.itemMeta}>
                  Voor: {o.assignedToIds.map((id) => employees.find((e) => e.id === id)?.name ?? id).join(', ')}
                </p>
              )}
            </div>
            {isOwner && (
              <button className={styles.deleteBtn} onClick={() => handleDelete(o.id)} aria-label="Verwijderen">✕</button>
            )}
          </div>
        ))}
      </div>

      {/* ── Nieuwe opdracht (owner only) ─────────────────── */}
      {isOwner && (
        <form className={styles.createForm} onSubmit={handleCreate} noValidate>
          <h3 className={styles.createTitle}>Nieuwe opdracht</h3>

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.label}>Datum</label>
              <input
                type="date"
                className={styles.input}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          </div>

          <textarea
            className={styles.textarea}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Omschrijving opdracht (bv. Droogzone volledig reinigen)"
            rows={3}
          />

          {employees.length > 0 && (
            <div className={styles.assignSection}>
              <label className={styles.label}>Toewijzen aan (optioneel — leeg = iedereen)</label>
              <div className={styles.employeeGrid}>
                {employees.map((emp) => (
                  <label key={emp.id} className={styles.empCheck}>
                    <input
                      type="checkbox"
                      checked={newAssigned.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                    />
                    {emp.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={saving || !newText.trim()}>
            {saving ? 'Opslaan...' : 'Opdracht toevoegen'}
          </button>
        </form>
      )}
    </div>
  );
}
