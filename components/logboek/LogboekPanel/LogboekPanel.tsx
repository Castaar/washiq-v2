'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './LogboekPanel.module.scss';

export interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  type: 'opening' | 'sluiting';
  personType: 'employee' | 'technician_extern' | 'jobstudent';
  registeredByName: string;
  timestamp: string;
  note: string;
}

interface EmployeeOption { id: string; name: string; }

const PERSON_TYPE_LABEL: Record<'technician_extern' | 'jobstudent', string> = {
  technician_extern: 'Technieker',
  jobstudent: 'Jobstudent',
};

interface DayRecord {
  date: string;
  checkIn: string;
  checkOut: string;
  hours: number;
}

interface EmployeeSummary {
  userId: string;
  userName: string;
  totalHours: number;
  daysWorked: number;
  days: DayRecord[];
}

interface LogboekPanelProps {
  siteId: string;
  userRole: string;
  userName: string;
  currentUserId: string;
  recentLogs: LogEntry[];
  employees?: EmployeeOption[];
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function groupByDate(logs: LogEntry[]) {
  const map = new Map<string, LogEntry[]>();
  for (const l of logs) {
    const key = fmtDate(l.timestamp);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(l);
  }
  return map;
}

const MONTH_NAMES = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];

function fmtDayNL(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function LogboekPanel({ siteId, userRole, userName, currentUserId, recentLogs, employees = [] }: LogboekPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>(recentLogs);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastAction, setLastAction] = useState<'opening' | 'sluiting' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Externe persoon (technieker of jobstudent) — door de werknemer/eigenaar
  // ter plaatse ingevuld, want die heeft zelf geen app-account.
  const [techKind, setTechKind] = useState<'technician_extern' | 'jobstudent'>('technician_extern');
  const [techName, setTechName] = useState('');
  const [techNote, setTechNote] = useState('');
  const [techSaving, setTechSaving] = useState(false);
  const [techLastAction, setTechLastAction] = useState<'opening' | 'sluiting' | null>(null);
  const [techError, setTechError] = useState('');

  // Owner/developer: registreren namens een medewerker die vergat zelf in-
  // of uit te checken. Tijdstip is aanpasbaar zodat het achteraf op het
  // juiste (werkelijke) moment kan ingevuld worden i.p.v. altijd "nu".
  const [onBehalfUserId, setOnBehalfUserId] = useState('');
  const [onBehalfTime, setOnBehalfTime] = useState('');
  const [onBehalfSaving, setOnBehalfSaving] = useState(false);
  const [onBehalfLastAction, setOnBehalfLastAction] = useState<'opening' | 'sluiting' | null>(null);
  const [onBehalfError, setOnBehalfError] = useState('');

  const isOwner = userRole === 'owner' || userRole === 'developer';
  const [view, setView] = useState<'logboek' | 'maand'>('logboek');

  // Deep-link from a push notification: /logboek?item=<id> highlights that
  // specific aankomst/vertrek registratie.
  const searchParams = useSearchParams();
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (!itemId) return;
    setHighlightId(itemId);
    const timeout = setTimeout(() => {
      rowRefs.current[itemId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    const clear = setTimeout(() => setHighlightId(null), 4000);
    return () => { clearTimeout(timeout); clearTimeout(clear); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Month picker state
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<EmployeeSummary[] | null>(null);
  const [totalWashes, setTotalWashes] = useState(0);
  const [monthHistory, setMonthHistory] = useState<{ year: number; month: number; totalHours: number; totalWashes: number }[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  async function register(type: 'opening' | 'sluiting') {
    setSaving(true);
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, type, note }),
    });
    if (res.ok) {
      const entry = (await res.json()) as LogEntry;
      setLogs((prev) => [entry, ...prev]);
      setLastAction(type);
      setNote('');
    }
    setSaving(false);
  }

  async function registerTechnician(type: 'opening' | 'sluiting') {
    setTechError('');
    if (!techName.trim()) {
      setTechError(`Vul de naam van de ${techKind === 'jobstudent' ? 'jobstudent' : 'technieker'} in`);
      return;
    }
    setTechSaving(true);
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, type, note: techNote, personType: techKind, personName: techName }),
    });
    if (res.ok) {
      const entry = (await res.json()) as LogEntry;
      setLogs((prev) => [entry, ...prev]);
      setTechLastAction(type);
      setTechNote('');
    } else {
      setTechError('Registreren mislukt, probeer opnieuw');
    }
    setTechSaving(false);
  }

  async function registerOnBehalf(type: 'opening' | 'sluiting') {
    setOnBehalfError('');
    if (!onBehalfUserId) {
      setOnBehalfError('Kies een medewerker');
      return;
    }
    const emp = employees.find((e) => e.id === onBehalfUserId);
    setOnBehalfSaving(true);
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId, type,
        onBehalfOfUserId: onBehalfUserId,
        onBehalfOfUserName: emp?.name ?? '',
        timestamp: onBehalfTime ? new Date(onBehalfTime).toISOString() : undefined,
      }),
    });
    if (res.ok) {
      const entry = (await res.json()) as LogEntry;
      setLogs((prev) => [entry, ...prev]);
      setOnBehalfLastAction(type);
      setOnBehalfTime('');
    } else {
      setOnBehalfError('Registreren mislukt, probeer opnieuw');
    }
    setOnBehalfSaving(false);
  }

  async function handleDeleteLog(id: string) {
    if (!confirm('Deze registratie verwijderen?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/attendance/${id}`, { method: 'DELETE' });
      if (res.ok) setLogs((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function loadSummary(year: number, month: number) {
    setSummaryLoading(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/attendance/monthly?siteId=${siteId}&year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json() as { employees: EmployeeSummary[]; totalWashes: number; history: { year: number; month: number; totalHours: number; totalWashes: number }[] };
        setSummary(data.employees);
        setTotalWashes(data.totalWashes);
        setMonthHistory(data.history);
      }
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleViewMonth() {
    setView('maand');
    loadSummary(selYear, selMonth);
  }

  function handleMonthChange(year: number, month: number) {
    setSelYear(year);
    setSelMonth(month);
    if (view === 'maand') loadSummary(year, month);
  }

  function exportCsv() {
    if (!summary || summary.length === 0) return;
    const rows = [['Medewerker', 'Datum', 'Aankomst', 'Vertrek', 'Uren']];
    for (const emp of summary) {
      for (const day of emp.days) {
        rows.push([
          emp.userName,
          day.date,
          day.checkIn || '',
          day.checkOut || '',
          day.hours > 0 ? day.hours.toFixed(2) : '',
        ]);
      }
      rows.push([emp.userName, 'Totaal', '', '', emp.totalHours.toFixed(2)]);
    }
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uren-${MONTH_NAMES[selMonth - 1].toLowerCase()}-${selYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grouped = groupByDate(logs);

  return (
    <div className={styles.wrapper}>
      {/* ── Registreer aankomst / vertrek ─────────────────────── */}
      <div className={styles.registerCard}>
        <h2 className={styles.registerTitle}>Registreer aanwezigheid</h2>
        <p className={styles.registerSub}>Aangemeld als <strong>{userName}</strong></p>

        <input
          className={styles.noteInput}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opmerking (optioneel)"
          maxLength={120}
        />

        <div className={styles.btnRow}>
          <button
            className={[styles.btn, styles.openBtn].join(' ')}
            onClick={() => register('opening')}
            disabled={saving}
          >
            Ik kom aan
          </button>
          <button
            className={[styles.btn, styles.closeBtn].join(' ')}
            onClick={() => register('sluiting')}
            disabled={saving}
          >
            Ik vertrek
          </button>
        </div>

        {lastAction && (
          <p className={styles.confirm}>
            {lastAction === 'opening' ? 'Aankomst' : 'Vertrek'} geregistreerd
          </p>
        )}
      </div>

      {/* ── Externe persoon (technieker / jobstudent) ─────────────── */}
      <div className={styles.registerCard}>
        <h2 className={styles.registerTitle}>Technieker of jobstudent</h2>
        <p className={styles.registerSub}>
          Komt er iemand zonder app-account langs (technieker van buitenaf, jobstudent,…)? Registreer hier wanneer die aankomt en vertrekt.
        </p>

        <div className={styles.kindToggle}>
          <button
            type="button"
            className={[styles.kindBtn, techKind === 'technician_extern' ? styles.kindBtnActive : ''].filter(Boolean).join(' ')}
            onClick={() => setTechKind('technician_extern')}
          >
            Technieker
          </button>
          <button
            type="button"
            className={[styles.kindBtn, techKind === 'jobstudent' ? styles.kindBtnActive : ''].filter(Boolean).join(' ')}
            onClick={() => setTechKind('jobstudent')}
          >
            Jobstudent
          </button>
        </div>

        <input
          className={styles.noteInput}
          type="text"
          value={techName}
          onChange={(e) => setTechName(e.target.value)}
          placeholder={`Naam van de ${techKind === 'jobstudent' ? 'jobstudent' : 'technieker'}`}
          maxLength={80}
        />
        <input
          className={styles.noteInput}
          type="text"
          value={techNote}
          onChange={(e) => setTechNote(e.target.value)}
          placeholder="Opmerking (optioneel)"
          maxLength={120}
        />

        {techError && <p className={styles.error}>{techError}</p>}

        <div className={styles.btnRow}>
          <button
            className={[styles.btn, styles.openBtn].join(' ')}
            onClick={() => registerTechnician('opening')}
            disabled={techSaving}
          >
            Komt aan
          </button>
          <button
            className={[styles.btn, styles.closeBtn].join(' ')}
            onClick={() => registerTechnician('sluiting')}
            disabled={techSaving}
          >
            Vertrekt
          </button>
        </div>

        {techLastAction && (
          <p className={styles.confirm}>
            {techLastAction === 'opening' ? 'Aankomst' : 'Vertrek'} geregistreerd
          </p>
        )}
      </div>

      {/* ── Namens medewerker registreren (owner/developer) ───────── */}
      {isOwner && employees.length > 0 && (
        <div className={styles.registerCard}>
          <h2 className={styles.registerTitle}>Voor medewerker registreren</h2>
          <p className={styles.registerSub}>
            Vergat iemand zelf in of uit te checken? Registreer het hier in hun plaats.
          </p>

          <select
            className={styles.noteInput}
            value={onBehalfUserId}
            onChange={(e) => setOnBehalfUserId(e.target.value)}
          >
            <option value="">Kies medewerker...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>

          <input
            className={styles.noteInput}
            type="datetime-local"
            value={onBehalfTime}
            onChange={(e) => setOnBehalfTime(e.target.value)}
            title="Laat leeg voor het huidige tijdstip"
          />

          {onBehalfError && <p className={styles.error}>{onBehalfError}</p>}

          <div className={styles.btnRow}>
            <button
              className={[styles.btn, styles.openBtn].join(' ')}
              onClick={() => registerOnBehalf('opening')}
              disabled={onBehalfSaving}
            >
              Komt aan
            </button>
            <button
              className={[styles.btn, styles.closeBtn].join(' ')}
              onClick={() => registerOnBehalf('sluiting')}
              disabled={onBehalfSaving}
            >
              Vertrekt
            </button>
          </div>

          {onBehalfLastAction && (
            <p className={styles.confirm}>
              {onBehalfLastAction === 'opening' ? 'Aankomst' : 'Vertrek'} geregistreerd
            </p>
          )}
        </div>
      )}

      {/* ── Owner tabs ─────────────────────────────────────────── */}
      {isOwner && (
        <div className={styles.tabRow}>
          <button
            type="button"
            className={[styles.tabBtn, view === 'logboek' ? styles.tabBtnActive : ''].filter(Boolean).join(' ')}
            onClick={() => setView('logboek')}
          >
            Logboek
          </button>
          <button
            type="button"
            className={[styles.tabBtn, view === 'maand' ? styles.tabBtnActive : ''].filter(Boolean).join(' ')}
            onClick={handleViewMonth}
          >
            Maandoverzicht
          </button>
        </div>
      )}

      {/* ── Maandoverzicht (owner) ──────────────────────────────── */}
      {isOwner && view === 'maand' && (
        <div className={styles.monthCard}>
          {/* Month picker */}
          <div className={styles.monthPicker}>
            <select
              className={styles.monthSelect}
              value={selMonth}
              onChange={(e) => handleMonthChange(selYear, parseInt(e.target.value))}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              className={styles.monthSelect}
              value={selYear}
              onChange={(e) => handleMonthChange(parseInt(e.target.value), selMonth)}
            >
              {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className={styles.monthLabel}>
              {MONTH_NAMES[selMonth - 1]} {selYear}
            </span>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={exportCsv}
              disabled={!summary || summary.length === 0}
              title="Download een Excel-bestand (CSV) met alle uren van deze maand"
            >
              ⬇ Exporteren
            </button>
          </div>

          {summaryLoading && <p className={styles.empty}>Laden...</p>}

          {!summaryLoading && summary !== null && (
            <div className={styles.totalsRow}>
              <div className={styles.totalTile}>
                <span className={styles.totalLabel}>Totaal gewerkte uren</span>
                <span className={styles.totalValue}>
                  {summary.reduce((s, e) => s + e.totalHours, 0).toFixed(1).replace('.0', '')} u
                </span>
              </div>
              <div className={styles.totalTile}>
                <span className={styles.totalLabel}>Aantal wasbeurten</span>
                <span className={styles.totalValue}>{totalWashes.toLocaleString('nl-BE')}</span>
              </div>
            </div>
          )}

          {!summaryLoading && monthHistory.length > 0 && (
            <div className={styles.historyRow}>
              {monthHistory.map((h) => (
                <button
                  key={`${h.year}-${h.month}`}
                  type="button"
                  className={[styles.historyTile, h.year === selYear && h.month === selMonth ? styles.historyTileActive : ''].filter(Boolean).join(' ')}
                  onClick={() => handleMonthChange(h.year, h.month)}
                >
                  <span className={styles.historyMonth}>{MONTH_NAMES[h.month - 1].slice(0, 3)}</span>
                  <span className={styles.historyHours}>{h.totalHours.toFixed(0)}u</span>
                  <span className={styles.historyWashes}>{h.totalWashes.toLocaleString('nl-BE')}w</span>
                </button>
              ))}
            </div>
          )}

          {!summaryLoading && summary !== null && summary.length === 0 && (
            <p className={styles.empty}>Geen registraties gevonden voor deze maand.</p>
          )}

          {!summaryLoading && summary && summary.length > 0 && (
            <div className={styles.summaryTable}>
              {/* Header row */}
              <div className={styles.summaryHeader}>
                <span className={styles.colName}>Medewerker</span>
                <span className={styles.colDays}>Dagen</span>
                <span className={styles.colHours}>Uren</span>
                <span className={styles.colToggle} />
              </div>

              {summary.map((emp) => (
                <div key={emp.userId} className={styles.summaryRow}>
                  {/* Employee summary line */}
                  <div className={styles.summaryLine}>
                    <span className={styles.colName}>{emp.userName}</span>
                    <span className={styles.colDays}>{emp.daysWorked} dag{emp.daysWorked !== 1 ? 'en' : ''}</span>
                    <span className={styles.colHoursVal}>
                      {emp.totalHours.toFixed(1).replace('.0', '')} u
                    </span>
                    <button
                      type="button"
                      className={styles.colToggle}
                      onClick={() => setExpandedUser(expandedUser === emp.userId ? null : emp.userId)}
                    >
                      {expandedUser === emp.userId ? '▲' : '▼'}
                    </button>
                  </div>

                  {/* Day-by-day detail */}
                  {expandedUser === emp.userId && (
                    <div className={styles.dayDetail}>
                      {emp.days.map((day) => (
                        <div key={day.date} className={styles.dayDetailRow}>
                          <span className={styles.dayDetailDate}>{fmtDayNL(day.date)}</span>
                          <span className={styles.dayDetailTime}>
                            {day.checkIn || '—'} → {day.checkOut || '?'}
                          </span>
                          <span className={[styles.dayDetailHours, !day.checkOut ? styles.dayDetailOpen : ''].filter(Boolean).join(' ')}>
                            {day.hours > 0 ? `${day.hours.toFixed(1).replace('.0', '')} u` : day.checkIn ? 'niet uitgestempeld' : '—'}
                          </span>
                        </div>
                      ))}
                      <div className={styles.dayDetailTotal}>
                        Totaal: <strong>{emp.totalHours.toFixed(1).replace('.0', '')} uur</strong>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Logboek (everyone / logboek tab) ────────────────────── */}
      {(!isOwner || view === 'logboek') && (
        <div className={styles.logSection}>
          <h2 className={styles.logTitle}>{isOwner ? 'Logboek — alle medewerkers' : 'Mijn registraties'}</h2>

          {grouped.size === 0 && (
            <p className={styles.empty}>Geen registraties gevonden voor de afgelopen 30 dagen.</p>
          )}

          {Array.from(grouped.entries()).map(([date, dayLogs]) => (
            <div key={date} className={styles.dayGroup}>
              <div className={styles.dayHeader}>{date}</div>
              {dayLogs.map((l) => (
                <div
                  key={l.id}
                  ref={(el) => { rowRefs.current[l.id] = el; }}
                  className={[styles.logRow, l.type === 'opening' ? styles.opening : styles.sluiting, highlightId === l.id ? styles.logRowHighlight : ''].filter(Boolean).join(' ')}
                >
                  <span className={styles.typeBadge}>
                    {l.type === 'opening' ? 'Aankomst' : 'Vertrek'}
                  </span>
                  <span className={styles.logName}>
                    {l.userName}
                    {(l.personType === 'technician_extern' || l.personType === 'jobstudent') && (
                      <span className={styles.technicianBadge}>{PERSON_TYPE_LABEL[l.personType]}</span>
                    )}
                    {l.registeredByName && (
                      <span className={styles.onBehalfBadge}>door {l.registeredByName}</span>
                    )}
                  </span>
                  <span className={styles.logTime}>{fmtTime(l.timestamp)}</span>
                  {l.note && <span className={styles.logNote}>{l.note}</span>}
                  {(isOwner || l.userId === currentUserId) && (
                    <button
                      type="button"
                      className={styles.logDeleteBtn}
                      onClick={() => handleDeleteLog(l.id)}
                      disabled={deletingId === l.id}
                      aria-label="Registratie verwijderen"
                      title="Verwijderen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
