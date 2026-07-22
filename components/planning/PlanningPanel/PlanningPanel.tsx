'use client';

import { useState } from 'react';
import styles from './PlanningPanel.module.scss';

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
}

export interface PlanningEmployee {
  id: string;
  name: string;
  siteIds?: string[];
}

export interface AllowedSite {
  id: string;
  name: string;
}

interface PlanningPanelProps {
  siteId: string;
  userRole: string;
  currentUserId: string;
  shifts: Shift[];
  employees: PlanningEmployee[];
  weekStart: string;
  allowedSites?: AllowedSite[];
}

const DAY_NAMES = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const DAY_NAMES_LONG = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

function fmtDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
}

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00').getDay();
  return d === 0 || d === 6;
}

// Count weekend days worked in the last N weeks for a given employee across all shifts
function weekendsInWindow(shifts: Shift[], userId: string, windowWeeks: number, refDate: string): number {
  const ref = new Date(refDate + 'T00:00:00');
  const from = new Date(ref);
  from.setDate(from.getDate() - windowWeeks * 7);
  const days = new Set(
    shifts.filter((s) => s.userId === userId && isWeekend(s.date) && new Date(s.date + 'T00:00:00') >= from).map((s) => s.date),
  );
  return days.size;
}

export function PlanningPanel({ siteId, userRole, currentUserId, shifts: initialShifts, employees, weekStart: initialWeekStart, allowedSites = [] }: PlanningPanelProps) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [weekStart, setWeekStart] = useState(getMondayOf(initialWeekStart));

  // New shift form
  const [newSiteId, setNewSiteId] = useState(siteId);
  const siteEmployees = employees.filter((e) => !e.siteIds || e.siteIds.includes(newSiteId));
  const [newUserId, setNewUserId] = useState(employees.find((e) => !e.siteIds || e.siteIds.includes(siteId))?.id ?? employees[0]?.id ?? '');
  const [newDate, setNewDate] = useState(initialWeekStart);
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwner = userRole === 'owner' || userRole === 'developer';
  const today = new Date().toISOString().slice(0, 10);

  // Build 7-day week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filter shifts to current week
  const weekShifts = shifts.filter((s) => weekDays.includes(s.date));

  // My shifts (for employee view)
  const myShifts = shifts
    .filter((s) => s.userId === currentUserId)
    .sort((a, b) => a.date.localeCompare(b.date));

  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserId || !newDate) return;
    const emp = employees.find((em) => em.id === newUserId);
    setSaving(true);
    const res = await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: newSiteId,
        userId: newUserId,
        userName: emp?.name ?? '',
        date: newDate,
        startTime: newStart,
        endTime: newEnd,
        note: newNote,
      }),
    });
    if (res.ok) {
      const shift = (await res.json()) as Shift;
      setShifts((prev) => [...prev, shift]);
      setNewNote('');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/planning/${id}`, { method: 'DELETE' });
    if (res.ok) setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  function prevWeek() { setWeekStart((w) => addDays(w, -7)); }
  function nextWeek() { setWeekStart((w) => addDays(w, 7)); }

  if (!isOwner) {
    // ── Employee view: my upcoming shifts ───────────────────
    return (
      <div className={styles.wrapper}>
        <div className={styles.myShiftsCard}>
          <h2 className={styles.cardTitle}>Mijn werkschema</h2>
          {myShifts.length === 0 ? (
            <p className={styles.empty}>Geen geplande shiften voor de komende 2 weken.</p>
          ) : (
            <div className={styles.myList}>
              {myShifts.map((s) => {
                const isPast = s.date < today;
                const isToday = s.date === today;
                return (
                  <div
                    key={s.id}
                    className={[styles.myShift, isPast ? styles.past : '', isToday ? styles.isToday : ''].join(' ')}
                  >
                    <div className={styles.myShiftDate}>
                      <span className={styles.myShiftDay}>{DAY_NAMES_LONG[new Date(s.date + 'T00:00:00').getDay() - 1 >= 0 ? new Date(s.date + 'T00:00:00').getDay() - 1 : 6]}</span>
                      <span className={styles.myShiftDateStr}>{fmtDayLabel(s.date)}</span>
                      {isToday && <span className={styles.todayBadge}>Vandaag</span>}
                    </div>
                    <div className={styles.myShiftTime}>
                      <span>{s.startTime} – {s.endTime}</span>
                      {s.note && <span className={styles.shiftNote}>{s.note}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Owner view: week calendar ───────────────────────────────
  return (
    <div className={styles.wrapper}>
      {/* Week navigation */}
      <div className={styles.weekNav}>
        <button className={styles.navBtn} onClick={prevWeek}>← Vorige week</button>
        <span className={styles.weekLabel}>
          {fmtDayLabel(weekStart)} — {fmtDayLabel(addDays(weekStart, 6))}
        </span>
        <button className={styles.navBtn} onClick={nextWeek}>Volgende week →</button>
      </div>

      {/* Week day list (single column — agenda style) */}
      <div className={styles.dayList}>
        {weekDays.map((date, i) => {
          const dayShifts = weekShifts.filter((s) => s.date === date);
          const isToday = date === today;
          return (
            <div key={date} className={[styles.dayRow, isToday ? styles.todayCol : ''].join(' ')}>
              <div className={styles.dayHeader}>
                <span className={styles.dayName}>{DAY_NAMES[i]}</span>
                <span className={styles.dayDate}>{fmtDayLabel(date)}</span>
                {isToday && <span className={styles.todayBadge}>Vandaag</span>}
              </div>
              <div className={styles.dayShifts}>
                {dayShifts.length === 0 && (
                  <span className={styles.emptyDay}>Geen shiften gepland</span>
                )}
                {dayShifts.map((s) => (
                  <div key={s.id} className={styles.shiftChip}>
                    <div className={styles.chipName}>{s.userName}</div>
                    <div className={styles.chipTime}>{s.startTime}–{s.endTime}</div>
                    {s.note && <div className={styles.chipNote}>{s.note}</div>}
                    <button
                      className={styles.chipDelete}
                      onClick={() => handleDelete(s.id)}
                      aria-label="Shift verwijderen"
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Uren & weekend overzicht per medewerker ─────────── */}
      {employees.length > 0 && (
        <div className={styles.hoursTable}>
          <h3 className={styles.hoursTitle}>Overzicht deze week</h3>
          <div className={styles.hoursRows}>
            {employees.map((emp) => {
              const empWeekShifts = weekShifts.filter((s) => s.userId === emp.id);
              const totalHours = empWeekShifts.reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime), 0);
              const weekendDays4w = weekendsInWindow(shifts, emp.id, 4, weekStart);
              const weekendWarn = weekendDays4w >= 4;
              return (
                <div key={emp.id} className={styles.hoursRow}>
                  <span className={styles.hoursName}>{emp.name}</span>
                  <span className={styles.hoursVal}>
                    {totalHours > 0 ? `${totalHours.toFixed(1).replace('.0', '')}u` : '—'}
                  </span>
                  <span className={[styles.weekendBadge, weekendWarn ? styles.weekendWarn : ''].filter(Boolean).join(' ')}>
                    {weekendDays4w} weekend{weekendDays4w !== 1 ? 'dagen' : 'dag'} / 4w
                    {weekendWarn && ' ⚠'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add shift form */}
      <form className={styles.addForm} onSubmit={handleAddShift} noValidate>
        <h3 className={styles.formTitle}>Shift toevoegen</h3>
        <div className={styles.formFields}>
          {allowedSites.length > 1 && (
            <div className={styles.formField}>
              <label className={styles.label}>Carwash</label>
              <select
                className={styles.select}
                value={newSiteId}
                onChange={(e) => {
                  const sid = e.target.value;
                  setNewSiteId(sid);
                  const first = employees.find((em) => !em.siteIds || em.siteIds.includes(sid));
                  setNewUserId(first?.id ?? '');
                }}
              >
                {allowedSites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.formField}>
            <label className={styles.label}>Medewerker</label>
            <select
              className={styles.select}
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
            >
              {siteEmployees.map((em) => (
                <option key={em.id} value={em.id}>{em.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>Datum</label>
            <input
              type="date"
              className={styles.input}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>Van</label>
            <input
              type="time"
              className={styles.input}
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>Tot</label>
            <input
              type="time"
              className={styles.input}
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
            />
          </div>
          <div className={[styles.formField, styles.noteField].join(' ')}>
            <label className={styles.label}>Opmerking</label>
            <input
              type="text"
              className={styles.input}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Optioneel"
            />
          </div>
        </div>
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={saving || !newUserId || !newDate}
        >
          {saving ? 'Opslaan...' : 'Shift toevoegen'}
        </button>
      </form>
    </div>
  );
}
