'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ContractAlert } from '@/components/contract/ContractAlert/ContractAlert';
import type { ContractStatus } from '@/lib/contract-hours';
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

export interface AgendaEventItem {
  id: string;
  date: string;
  time: string;
  text: string;
  createdByName: string;
  createdBy: string;
}

export interface VerlofItem {
  id: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  note: string;
}

interface PlanningPanelProps {
  siteId: string;
  userRole: string;
  currentUserId: string;
  shifts: Shift[];
  employees: PlanningEmployee[];
  agendaEvents: AgendaEventItem[];
  verlofItems: VerlofItem[];
  weekStart: string;
  allowedSites?: AllowedSite[];
  contractStatus?: ContractStatus[];
}

// Message-key suffixes for planning.dagKort.* / planning.dagLang.* (Mon..Sun)
const DAY_KEYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'] as const;

// All date-only strings are treated as UTC calendar dates throughout —
// parsing/formatting via local-time Date methods (getDay/setDate/
// toISOString round-trips) silently shifts the date by one day for any
// browser timezone ahead of UTC (e.g. Belgium in CEST), so every helper
// here uses the UTC variants instead.
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function getMondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

function fmtDayLabel(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString(locale === 'fr' ? 'fr-BE' : 'nl-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

function monthLabel(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString(locale === 'fr' ? 'fr-BE' : 'nl-BE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

// Count weekend days worked in the last N weeks for a given employee across all shifts
function weekendsInWindow(shifts: Shift[], userId: string, windowWeeks: number, refDate: string): number {
  const ref = new Date(`${refDate}T00:00:00Z`);
  const from = new Date(ref);
  from.setUTCDate(from.getUTCDate() - windowWeeks * 7);
  const days = new Set(
    shifts.filter((s) => s.userId === userId && isWeekend(s.date) && new Date(`${s.date}T00:00:00Z`) >= from).map((s) => s.date),
  );
  return days.size;
}

export function PlanningPanel({ siteId, userRole, currentUserId, shifts: initialShifts, employees, agendaEvents: initialAgendaEvents, verlofItems: initialVerlofItems, weekStart: initialWeekStart, allowedSites = [], contractStatus = [] }: PlanningPanelProps) {
  const t = useTranslations('planning');
  const tCommon = useTranslations('common');
  const tContract = useTranslations('contract');
  const locale = useLocale();
  const fmtDay = (dateStr: string) => fmtDayLabel(dateStr, locale);
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [agendaEvents, setAgendaEvents] = useState<AgendaEventItem[]>(initialAgendaEvents);
  const [verlofItems, setVerlofItems] = useState<VerlofItem[]>(initialVerlofItems);
  const [weekStart, setWeekStart] = useState(getMondayOf(initialWeekStart));
  const [hoursView, setHoursView] = useState<'week' | 'month'>('week');
  const [shiftError, setShiftError] = useState('');

  // New verlof form (per day, opened inline like agenda-item)
  const [verlofFormDate, setVerlofFormDate] = useState<string | null>(null);
  const [verlofUserId, setVerlofUserId] = useState('');
  const [verlofStart, setVerlofStart] = useState('');
  const [verlofEnd, setVerlofEnd] = useState('');
  const [savingVerlof, setSavingVerlof] = useState(false);

  // New agenda-note form (per day, opened inline)
  const [agendaFormDate, setAgendaFormDate] = useState<string | null>(null);
  const [agendaTime, setAgendaTime] = useState('');
  const [agendaText, setAgendaText] = useState('');
  const [savingAgenda, setSavingAgenda] = useState(false);
  // Employee view's own standalone add-form (not tied to a day-cell like the owner's)
  const [empAgendaOpen, setEmpAgendaOpen] = useState(false);
  const [empAgendaDate, setEmpAgendaDate] = useState('');
  const [agendaError, setAgendaError] = useState('');

  // New shift form
  const [newSiteId, setNewSiteId] = useState(siteId);
  // Any employee can be scheduled at any carwash — not just the sites they're
  // currently assigned to.
  const siteEmployees = employees;
  const [newUserId, setNewUserId] = useState(employees[0]?.id ?? '');
  const [newDate, setNewDate] = useState(initialWeekStart);
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwner = userRole === 'owner' || userRole === 'developer';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());

  // Deep-link from a push notification: /planning?item=<id> scrolls to and
  // highlights that specific shift (employee's "Mijn werkschema" view).
  const searchParams = useSearchParams();
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const shiftRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (!itemId) return;
    setHighlightId(itemId);
    const timeout = setTimeout(() => {
      shiftRowRefs.current[itemId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    const clear = setTimeout(() => setHighlightId(null), 4000);
    return () => { clearTimeout(timeout); clearTimeout(clear); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Build 7-day week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Filter shifts to current week
  const weekShifts = shifts.filter((s) => weekDays.includes(s.date));
  // Filter shifts to the calendar month the currently viewed week falls in
  const monthPrefix = weekStart.slice(0, 7); // "YYYY-MM"
  const monthShifts = shifts.filter((s) => s.date.startsWith(monthPrefix));
  const hoursShifts = hoursView === 'week' ? weekShifts : monthShifts;
  const weekAgenda = agendaEvents.filter((a) => weekDays.includes(a.date));
  // Upcoming agenda notes, for the employee view (not tied to their own shifts)
  const upcomingAgenda = agendaEvents
    .filter((a) => a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  function verlofOn(date: string): VerlofItem[] {
    return verlofItems.filter((v) => v.startDate <= date && v.endDate >= date);
  }
  function isOnVerlof(userId: string, date: string): boolean {
    return verlofItems.some((v) => v.userId === userId && v.startDate <= date && v.endDate >= date);
  }

  // My shifts (for employee view)
  const myShifts = shifts
    .filter((s) => s.userId === currentUserId)
    .sort((a, b) => a.date.localeCompare(b.date));

  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserId || !newDate) return;
    setShiftError('');
    const emp = employees.find((em) => em.id === newUserId);
    if (isOnVerlof(newUserId, newDate)) {
      setShiftError(t('heeftVerlof', { name: emp?.name ?? t('dezeMedewerker'), date: newDate }));
      return;
    }
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
      // Only show it in this week view if it belongs to the carwash
      // currently being viewed — the form can add a shift for a different
      // site without switching the page away from it.
      if (newSiteId === siteId) {
        setShifts((prev) => [...prev, shift]);
      }
      setNewNote('');
    } else {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      setShiftError(err?.error ?? t('opslaanMislukt'));
    }
    setSaving(false);
  }

  async function handleAddVerlof() {
    if (!verlofUserId || !verlofStart || !verlofEnd) return;
    const emp = employees.find((em) => em.id === verlofUserId);
    setSavingVerlof(true);
    try {
      const res = await fetch('/api/verlof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: verlofUserId,
          userName: emp?.name ?? '',
          startDate: verlofStart,
          endDate: verlofEnd,
        }),
      });
      if (res.ok) {
        const item = (await res.json()) as VerlofItem;
        setVerlofItems((prev) => [...prev, item]);
        // Any shifts already scheduled for this employee within the new
        // leave range no longer make sense — remove them for real, not just
        // from the local view, so they don't reappear on reload.
        const conflicting = shifts.filter((s) => s.userId === verlofUserId && s.date >= verlofStart && s.date <= verlofEnd);
        if (conflicting.length > 0) {
          await Promise.allSettled(conflicting.map((s) => fetch(`/api/planning/${s.id}`, { method: 'DELETE' })));
          setShifts((prev) => prev.filter((s) => !conflicting.some((c) => c.id === s.id)));
        }
        setVerlofFormDate(null);
        setVerlofUserId('');
        setVerlofStart('');
        setVerlofEnd('');
      }
    } finally {
      setSavingVerlof(false);
    }
  }

  async function handleDeleteVerlof(id: string) {
    const res = await fetch(`/api/verlof/${id}`, { method: 'DELETE' });
    if (res.ok) setVerlofItems((prev) => prev.filter((v) => v.id !== id));
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/planning/${id}`, { method: 'DELETE' });
    if (res.ok) setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleAddAgenda(date: string): Promise<boolean> {
    if (!agendaText.trim()) return false;
    setSavingAgenda(true);
    setAgendaError('');
    try {
      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, date, time: agendaTime, text: agendaText }),
      });
      if (!res.ok) {
        setAgendaError(t('opslaanMisluktOpnieuw'));
        return false;
      }
      const event = (await res.json()) as AgendaEventItem;
      setAgendaEvents((prev) => [...prev, event]);
      setAgendaText('');
      setAgendaTime('');
      setAgendaFormDate(null);
      return true;
    } catch {
      setAgendaError(t('geenVerbinding'));
      return false;
    } finally {
      setSavingAgenda(false);
    }
  }

  async function handleDeleteAgenda(id: string) {
    const res = await fetch(`/api/agenda/${id}`, { method: 'DELETE' });
    if (res.ok) setAgendaEvents((prev) => prev.filter((a) => a.id !== id));
  }

  function prevWeek() { setWeekStart((w) => addDays(w, -7)); }
  function nextWeek() { setWeekStart((w) => addDays(w, 7)); }

  if (!isOwner) {
    // ── Employee view: my upcoming shifts ───────────────────
    return (
      <div className={styles.wrapper}>
        <div className={styles.myShiftsCard}>
          <h2 className={styles.cardTitle}>{t('agenda')}</h2>
          {upcomingAgenda.length > 0 && (
            <div className={styles.myList}>
              {upcomingAgenda.map((a) => (
                <div key={a.id} className={styles.myAgendaRow}>
                  <span>{fmtDay(a.date)}{a.time ? ` · ${a.time}` : ''}</span>
                  <span>{a.text}</span>
                  {a.createdBy === currentUserId && (
                    <button
                      type="button"
                      className={styles.chipDelete}
                      onClick={() => handleDeleteAgenda(a.id)}
                      aria-label={tCommon('verwijderen')}
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {empAgendaOpen ? (
            <div className={styles.agendaAddRow}>
              <input
                type="date"
                className={styles.agendaTimeInput}
                style={{ width: 140 }}
                value={empAgendaDate}
                onChange={(e) => setEmpAgendaDate(e.target.value)}
                min={today}
              />
              <input
                type="time"
                className={styles.agendaTimeInput}
                value={agendaTime}
                onChange={(e) => setAgendaTime(e.target.value)}
              />
              <input
                type="text"
                className={styles.agendaTextInput}
                placeholder={t('agendaPlaceholderMedewerker')}
                value={agendaText}
                onChange={(e) => setAgendaText(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className={styles.agendaAddBtn}
                onClick={async () => {
                  if (!empAgendaDate) return;
                  const ok = await handleAddAgenda(empAgendaDate);
                  if (ok) {
                    setEmpAgendaOpen(false);
                    setEmpAgendaDate('');
                  }
                }}
                disabled={savingAgenda || !agendaText.trim() || !empAgendaDate}
              >
                {savingAgenda ? '...' : 'OK'}
              </button>
              <button type="button" className={styles.chipDelete} onClick={() => { setEmpAgendaOpen(false); setAgendaError(''); }} aria-label={tCommon('annuleren')}>✕</button>
              {agendaError && <p className={styles.agendaError}>{agendaError}</p>}
            </div>
          ) : (
            <button type="button" className={styles.navBtn} onClick={() => { setEmpAgendaOpen(true); setEmpAgendaDate(today); }}>
              {t('agendaItemToevoegen')}
            </button>
          )}
        </div>
        <div className={styles.myShiftsCard}>
          <h2 className={styles.cardTitle}>{t('mijnWerkschema')}</h2>
          {myShifts.length === 0 ? (
            <p className={styles.empty}>{t('geenShiftenKomend')}</p>
          ) : (
            <div className={styles.myList}>
              {myShifts.map((s) => {
                const isPast = s.date < today;
                const isToday = s.date === today;
                return (
                  <div
                    key={s.id}
                    ref={(el) => { shiftRowRefs.current[s.id] = el; }}
                    className={[styles.myShift, isPast ? styles.past : '', isToday ? styles.isToday : '', highlightId === s.id ? styles.shiftHighlight : ''].filter(Boolean).join(' ')}
                  >
                    <div className={styles.myShiftDate}>
                      <span className={styles.myShiftDay}>{t(`dagLang.${DAY_KEYS[(new Date(`${s.date}T00:00:00Z`).getUTCDay() + 6) % 7]}`)}</span>
                      <span className={styles.myShiftDateStr}>{fmtDay(s.date)}</span>
                      {isToday && <span className={styles.todayBadge}>{tCommon('vandaag')}</span>}
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
  const contractOf = (userId: string) => contractStatus.find((c) => c.userId === userId);
  const fmtH = (n: number) => n.toLocaleString(locale === 'fr' ? 'fr-BE' : 'nl-BE', { maximumFractionDigits: 1 });

  return (
    <div className={styles.wrapper}>
      {isOwner && <ContractAlert items={contractStatus} />}

      {/* Week navigation */}
      <div className={styles.weekNav}>
        <button className={styles.navBtn} onClick={prevWeek}>{t('vorigeWeek')}</button>
        <span className={styles.weekLabel}>
          {fmtDay(weekStart)} — {fmtDay(addDays(weekStart, 6))}
        </span>
        <button className={styles.navBtn} onClick={nextWeek}>{t('volgendeWeek')}</button>
      </div>

      {/* Week day list (single column — agenda style) */}
      <div className={styles.dayList}>
        {weekDays.map((date, i) => {
          const dayShifts = weekShifts.filter((s) => s.date === date);
          const dayAgenda = weekAgenda.filter((a) => a.date === date);
          const dayVerlof = verlofOn(date);
          const isToday = date === today;
          return (
            <div key={date} className={[styles.dayRow, isToday ? styles.todayCol : ''].join(' ')}>
              <div className={styles.dayHeader}>
                <span className={styles.dayName}>{t(`dagKort.${DAY_KEYS[i]}`)}</span>
                <span className={styles.dayDate}>{fmtDay(date)}</span>
                {isToday && <span className={styles.todayBadge}>{tCommon('vandaag')}</span>}
              </div>

              {dayVerlof.length > 0 && (
                <div className={styles.verlofBand}>
                  {dayVerlof.map((v) => (
                    <span key={v.id} className={styles.verlofChip}>
                      {t('verlofVan', { name: v.userName })}
                      <button
                        type="button"
                        className={styles.verlofDelete}
                        onClick={() => handleDeleteVerlof(v.id)}
                        aria-label={t('verlofVerwijderen')}
                      >✕</button>
                    </span>
                  ))}
                </div>
              )}

              {verlofFormDate === date ? (
                <div className={styles.agendaAddRow}>
                  <select
                    className={styles.agendaTextInput}
                    value={verlofUserId}
                    onChange={(e) => setVerlofUserId(e.target.value)}
                  >
                    <option value="">{t('medewerkerKiezen')}</option>
                    {employees.map((em) => (
                      <option key={em.id} value={em.id}>{em.name}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className={styles.agendaTimeInput}
                    value={verlofStart}
                    onChange={(e) => setVerlofStart(e.target.value)}
                  />
                  <input
                    type="date"
                    className={styles.agendaTimeInput}
                    value={verlofEnd}
                    onChange={(e) => setVerlofEnd(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.agendaAddBtn}
                    onClick={handleAddVerlof}
                    disabled={savingVerlof || !verlofUserId || !verlofStart || !verlofEnd}
                  >
                    {savingVerlof ? '...' : 'OK'}
                  </button>
                  <button
                    type="button"
                    className={styles.chipDelete}
                    onClick={() => { setVerlofFormDate(null); setVerlofUserId(''); setVerlofStart(''); setVerlofEnd(''); }}
                    aria-label={tCommon('annuleren')}
                  >✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => { setVerlofFormDate(date); setVerlofStart(date); setVerlofEnd(date); }}
                >
                  {t('plusVerlof')}
                </button>
              )}

              {dayAgenda.length > 0 && (
                <div className={styles.agendaList}>
                  {dayAgenda.map((a) => (
                    <div key={a.id} className={styles.agendaChip}>
                      {a.time && <span className={styles.agendaTime}>{a.time}</span>}
                      <span className={styles.agendaText}>{a.text}</span>
                      <button
                        className={styles.chipDelete}
                        onClick={() => handleDeleteAgenda(a.id)}
                        aria-label={t('agendaItemVerwijderen')}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              {agendaFormDate === date ? (
                <div className={styles.agendaAddRow}>
                  <input
                    type="time"
                    className={styles.agendaTimeInput}
                    value={agendaTime}
                    onChange={(e) => setAgendaTime(e.target.value)}
                  />
                  <input
                    type="text"
                    className={styles.agendaTextInput}
                    placeholder={t('agendaPlaceholder')}
                    value={agendaText}
                    onChange={(e) => setAgendaText(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.agendaAddBtn}
                    onClick={() => handleAddAgenda(date)}
                    disabled={savingAgenda || !agendaText.trim()}
                  >
                    {savingAgenda ? '...' : 'OK'}
                  </button>
                  <button
                    type="button"
                    className={styles.chipDelete}
                    onClick={() => { setAgendaFormDate(null); setAgendaText(''); setAgendaTime(''); setAgendaError(''); }}
                    aria-label={tCommon('annuleren')}
                  >✕</button>
                  {agendaError && <p className={styles.agendaError}>{agendaError}</p>}
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={() => setAgendaFormDate(date)}
                >
                  {t('plusAgendaItem')}
                </button>
              )}

              <div className={styles.dayShifts}>
                {dayShifts.length === 0 && (
                  <span className={styles.emptyDay}>{t('geenShiftenGepland')}</span>
                )}
                {dayShifts.map((s) => (
                  <div key={s.id} className={styles.shiftChip}>
                    <div className={styles.chipName}>{s.userName}</div>
                    <div className={styles.chipTime}>{s.startTime}–{s.endTime}</div>
                    {s.note && <div className={styles.chipNote}>{s.note}</div>}
                    <button
                      className={styles.chipDelete}
                      onClick={() => handleDelete(s.id)}
                      aria-label={t('shiftVerwijderen')}
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
          <div className={styles.hoursHeader}>
            <h3 className={styles.hoursTitle}>
              {hoursView === 'week' ? t('overzichtWeek') : t('overzichtMaand', { month: monthLabel(weekStart, locale) })}
            </h3>
            <div className={styles.hoursToggle}>
              <button
                type="button"
                className={[styles.hoursToggleBtn, hoursView === 'week' ? styles.hoursToggleActive : ''].filter(Boolean).join(' ')}
                onClick={() => setHoursView('week')}
              >
                {t('week')}
              </button>
              <button
                type="button"
                className={[styles.hoursToggleBtn, hoursView === 'month' ? styles.hoursToggleActive : ''].filter(Boolean).join(' ')}
                onClick={() => setHoursView('month')}
              >
                {t('maand')}
              </button>
            </div>
          </div>
          <div className={styles.hoursRows}>
            {employees.map((emp) => {
              const empHoursShifts = hoursShifts.filter((s) => s.userId === emp.id);
              const totalHours = empHoursShifts.reduce((sum, s) => sum + shiftHours(s.startTime, s.endTime), 0);
              const weekendDays4w = weekendsInWindow(shifts, emp.id, 4, weekStart);
              const weekendWarn = weekendDays4w >= 4;
              const contract = contractOf(emp.id);
              return (
                <div key={emp.id} className={styles.hoursRow}>
                  <span className={styles.hoursName}>{emp.name}</span>
                  <span className={styles.hoursVal}>
                    {totalHours > 0 ? t('uren', { uren: totalHours.toFixed(1).replace('.0', '') }) : '—'}
                  </span>
                  <span className={[styles.weekendBadge, weekendWarn ? styles.weekendWarn : ''].filter(Boolean).join(' ')}>
                    {t('weekendDagen', { count: weekendDays4w })}
                    {weekendWarn && ' ⚠'}
                  </span>
                  {contract && (
                    <span
                      className={[styles.contractBadge, contract.reached ? styles.contractReached : ''].filter(Boolean).join(' ')}
                      title={tContract('gewerktDezeMaand')}
                    >
                      {tContract('gewerktVan', { gewerkt: fmtH(contract.workedHours), contract: fmtH(contract.contractHours) })}
                      {contract.reached && ' ⚠'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add shift form */}
      <form className={styles.addForm} onSubmit={handleAddShift} noValidate>
        <h3 className={styles.formTitle}>{t('shiftToevoegen')}</h3>
        <div className={styles.formFields}>
          {allowedSites.length > 1 && (
            <div className={styles.formField}>
              <label className={styles.label}>{t('carwash')}</label>
              <select
                className={styles.select}
                value={newSiteId}
                onChange={(e) => setNewSiteId(e.target.value)}
              >
                {allowedSites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.formField}>
            <label className={styles.label}>{t('medewerker')}</label>
            <select
              className={styles.select}
              value={newUserId}
              onChange={(e) => { setNewUserId(e.target.value); setShiftError(''); }}
            >
              {siteEmployees.map((em) => (
                <option key={em.id} value={em.id} disabled={isOnVerlof(em.id, newDate)}>
                  {em.name}{isOnVerlof(em.id, newDate) ? ` ${t('verlofSuffix')}` : ''}
                  {contractOf(em.id)?.reached ? ` (${tContract('bereikt')})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>{t('datum')}</label>
            <input
              type="date"
              className={styles.input}
              value={newDate}
              onChange={(e) => { setNewDate(e.target.value); setShiftError(''); }}
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>{t('van')}</label>
            <input
              type="time"
              className={styles.input}
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>{t('tot')}</label>
            <input
              type="time"
              className={styles.input}
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
            />
          </div>
          <div className={[styles.formField, styles.noteField].join(' ')}>
            <label className={styles.label}>{t('opmerking')}</label>
            <input
              type="text"
              className={styles.input}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={t('optioneel')}
            />
          </div>
        </div>
        {shiftError && <p className={styles.shiftError}>{shiftError}</p>}
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={saving || !newUserId || !newDate || isOnVerlof(newUserId, newDate)}
        >
          {saving ? t('opslaanBezig') : t('shiftToevoegen')}
        </button>
      </form>
    </div>
  );
}
