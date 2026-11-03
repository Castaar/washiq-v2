'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { brusselsInstant } from '@/lib/dates';
import type { AttendanceType } from '@/lib/attendance-hours';
import type { MonthlyReport } from '@/lib/attendance-report';
import { IconDownload, IconPrinter } from '@/components/ui/icons';
import { ContractAlert } from '@/components/contract/ContractAlert/ContractAlert';
import type { ContractStatus } from '@/lib/contract-hours';
import styles from './LogboekPanel.module.scss';

export interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  type: AttendanceType;
  personType: 'employee' | 'technician_extern' | 'jobstudent';
  registeredByName: string;
  timestamp: string;
  note: string;
}

interface EmployeeOption { id: string; name: string; }

interface DayRecord {
  date: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  pauseMinutes?: number;
}

interface EmployeeSummary {
  userId: string;
  userName: string;
  isJobstudent?: boolean;
  contractHours?: number | null;
  overtime?: number;
  totalHours: number;
  totalHoursAllSites: number;
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
  jobstudentNames?: string[];
  contractAlerts?: ContractStatus[];
}

// On-behalf picker value for "a jobstudent, by name" (not a user account)
const JOBSTUDENT = '__jobstudent__';

function fmtTime(iso: string, dateLocale: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string, dateLocale: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function groupByDate(logs: LogEntry[], dateLocale: string) {
  const map = new Map<string, LogEntry[]>();
  for (const l of logs) {
    const key = fmtDate(l.timestamp, dateLocale);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(l);
  }
  return map;
}

// Message keys per registration type: badge in the log, confirmation after registering
const TYPE_LABEL = { opening: 'aankomst', sluiting: 'vertrek', pauze_start: 'pauze', pauze_einde: 'terugVanPauze' } as const;
const TYPE_CONFIRM = { opening: 'aankomstGeregistreerd', sluiting: 'vertrekGeregistreerd', pauze_start: 'pauzeGeregistreerd', pauze_einde: 'pauzeEindeGeregistreerd' } as const;

// Message-key suffixes for logboek.maanden.* (January..December)
const MONTH_KEYS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'] as const;

function fmtDayNL(dateStr: string, dateLocale: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function LogboekPanel({ siteId, userRole, userName, currentUserId, recentLogs, employees = [], jobstudentNames = [], contractAlerts = [] }: LogboekPanelProps) {
  const t = useTranslations('logboek');
  const locale = useLocale();
  const dateLocale = locale === 'fr' ? 'fr-BE' : 'nl-BE';
  const monthName = (month: number) => t(`maanden.${MONTH_KEYS[month - 1]}`);
  const [logs, setLogs] = useState<LogEntry[]>(recentLogs);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastAction, setLastAction] = useState<AttendanceType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Externe persoon (technieker of jobstudent) — door de werknemer/eigenaar
  // ter plaatse ingevuld, want die heeft zelf geen app-account.
  const [techKind, setTechKind] = useState<'technician_extern' | 'jobstudent'>('technician_extern');
  const [techName, setTechName] = useState('');
  const [techNote, setTechNote] = useState('');
  const [techSaving, setTechSaving] = useState(false);
  const [techLastAction, setTechLastAction] = useState<AttendanceType | null>(null);
  const [techError, setTechError] = useState('');

  // Owner/developer: registreren namens een medewerker die vergat zelf in-
  // of uit te checken. Tijdstip is aanpasbaar zodat het achteraf op het
  // juiste (werkelijke) moment kan ingevuld worden i.p.v. altijd "nu".
  const [onBehalfUserId, setOnBehalfUserId] = useState('');
  const [onBehalfJobName, setOnBehalfJobName] = useState('');
  const [exporting, setExporting] = useState(false);
  // Date + 24h hour/minute pickers (a datetime-local field shows AM/PM on some phones,
  // which led to 06:30 being saved where 18:30 was meant).
  const [onBehalfDate, setOnBehalfDate] = useState('');
  const [onBehalfHour, setOnBehalfHour] = useState('');
  const [onBehalfMinute, setOnBehalfMinute] = useState('00');
  const [onBehalfSaving, setOnBehalfSaving] = useState(false);
  const [onBehalfLastAction, setOnBehalfLastAction] = useState<AttendanceType | null>(null);
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

  async function register(type: AttendanceType) {
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

  async function registerTechnician(type: AttendanceType) {
    setTechError('');
    if (!techName.trim()) {
      setTechError(techKind === 'jobstudent' ? t('vulNaamJobstudent') : t('vulNaamTechnieker'));
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
      setTechError(t('registrerenMislukt'));
    }
    setTechSaving(false);
  }

  async function registerOnBehalf(type: AttendanceType) {
    setOnBehalfError('');
    if (!onBehalfUserId) {
      setOnBehalfError(t('kiesEenMedewerker'));
      return;
    }
    // A chosen (earlier) date needs an hour, otherwise it would silently be logged as "now"
    if (onBehalfDate && onBehalfHour === '') {
      setOnBehalfError(t('kiesOokUur'));
      return;
    }
    const isJob = onBehalfUserId === JOBSTUDENT;
    if (isJob && !onBehalfJobName.trim()) {
      setOnBehalfError(t('vulNaamJobstudent'));
      return;
    }
    const emp = employees.find((e) => e.id === onBehalfUserId);
    setOnBehalfSaving(true);
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId, type,
        ...(isJob
          ? { personType: 'jobstudent', personName: onBehalfJobName.trim() }
          : { onBehalfOfUserId: onBehalfUserId, onBehalfOfUserName: emp?.name ?? '' }),
        timestamp: onBehalfHour !== ''
          ? brusselsInstant(onBehalfDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date()), `${onBehalfHour}:${onBehalfMinute}:00`).toISOString()
          : undefined,
      }),
    });
    if (res.ok) {
      const entry = (await res.json()) as LogEntry;
      setLogs((prev) => [entry, ...prev]);
      setOnBehalfLastAction(type);
      setOnBehalfHour('');
      setOnBehalfDate('');
    } else {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      setOnBehalfError(err?.error && res.status === 400 ? err.error : t('registrerenMislukt'));
    }
    setOnBehalfSaving(false);
  }

  async function handleDeleteLog(id: string) {
    if (!confirm(t('confirmVerwijderen'))) return;
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

  // Export covers every carwash of the owner, not just the selected one
  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch(`/api/attendance/report?year=${selYear}&month=${selMonth}`);
      if (!res.ok) return;
      const report = (await res.json()) as MonthlyReport;
      const num = (n: number) => n.toFixed(2).replace('.', ',');
      const fmtDay = (d: string) => d.split('-').reverse().join('/');
      const rows: string[][] = [[t('csv.medewerker'), t('csv.datum'), t('csv.carwash'), t('csv.aankomst'), t('csv.vertrek'), t('csv.pauze'), t('csv.uren'), t('csv.contract'), t('csv.overuren')]];
      for (const p of report.people) {
        const name = p.isJobstudent ? `${p.name} (${t('persoonType.jobstudent').toLowerCase()})` : p.name;
        for (const s of p.sessions) {
          rows.push([
            name,
            fmtDay(s.date),
            s.endSite && s.endSite !== s.site ? `${s.site} → ${s.endSite}` : s.site,
            s.checkIn,
            s.checkOut || t('csv.geenVertrek'),
            s.pauseMinutes > 0 ? String(s.pauseMinutes) : '',
            s.checkOut ? num(s.hours) : '',
          ]);
        }
        if (p.perSite.length > 1) {
          for (const ps of p.perSite) rows.push([name, t('csv.subtotaal'), ps.site, '', '', '', num(ps.hours)]);
        }
        rows.push([
          name, t('csv.totaal'), '', '', '', p.pauseMinutes > 0 ? String(p.pauseMinutes) : '', num(p.totalHours),
          p.contractHours !== null ? num(p.contractHours) : '',
          p.overtime !== null ? num(p.overtime) : '',
        ]);
        rows.push([]);
      }
      const totalOvertime = report.people.reduce((sum, p) => sum + (p.overtime ?? 0), 0);
      rows.push([t('csv.totaalIedereen'), '', '', '', '', '', num(report.totalHours), '', totalOvertime > 0 ? num(totalOvertime) : '']);
      const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('csv.bestandsnaam', { month: monthName(selMonth).toLowerCase(), year: selYear })}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const grouped = groupByDate(logs, dateLocale);

  return (
    <div className={styles.wrapper}>
      {isOwner && <ContractAlert items={contractAlerts} />}

      {/* ── Registreer aankomst / vertrek ─────────────────────── */}
      <div className={styles.registerCard}>
        <h2 className={styles.registerTitle}>{t('registreerAanwezigheid')}</h2>
        <p className={styles.registerSub}>{t.rich('aangemeldAls', { name: userName, strong: (chunks) => <strong>{chunks}</strong> })}</p>

        <input
          className={styles.noteInput}
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('opmerkingOptioneel')}
          maxLength={120}
        />

        <div className={styles.btnRow}>
          <button
            className={[styles.btn, styles.openBtn].join(' ')}
            onClick={() => register('opening')}
            disabled={saving}
          >
            {t('ikKomAan')}
          </button>
          <button
            className={[styles.btn, styles.closeBtn].join(' ')}
            onClick={() => register('sluiting')}
            disabled={saving}
          >
            {t('ikVertrek')}
          </button>
        </div>
        <div className={styles.btnRow}>
          <button
            className={[styles.btn, styles.pauseBtn].join(' ')}
            onClick={() => register('pauze_start')}
            disabled={saving}
          >
            {t('startPauze')}
          </button>
          <button
            className={[styles.btn, styles.pauseBtn].join(' ')}
            onClick={() => register('pauze_einde')}
            disabled={saving}
          >
            {t('eindePauze')}
          </button>
        </div>

        {lastAction && (
          <p className={styles.confirm}>
            {t(TYPE_CONFIRM[lastAction])}
          </p>
        )}
      </div>

      {/* ── Externe persoon (technieker / jobstudent) ─────────────── */}
      <div className={styles.registerCard}>
        <h2 className={styles.registerTitle}>{t('techniekerOfJobstudent')}</h2>
        <p className={styles.registerSub}>
          {t('techniekerUitleg')}
        </p>

        <div className={styles.kindToggle}>
          <button
            type="button"
            className={[styles.kindBtn, techKind === 'technician_extern' ? styles.kindBtnActive : ''].filter(Boolean).join(' ')}
            onClick={() => setTechKind('technician_extern')}
          >
            {t('persoonType.technician_extern')}
          </button>
          <button
            type="button"
            className={[styles.kindBtn, techKind === 'jobstudent' ? styles.kindBtnActive : ''].filter(Boolean).join(' ')}
            onClick={() => setTechKind('jobstudent')}
          >
            {t('persoonType.jobstudent')}
          </button>
        </div>

        <input
          className={styles.noteInput}
          type="text"
          value={techName}
          onChange={(e) => setTechName(e.target.value)}
          placeholder={techKind === 'jobstudent' ? t('naamJobstudent') : t('naamTechnieker')}
          maxLength={80}
        />
        <input
          className={styles.noteInput}
          type="text"
          value={techNote}
          onChange={(e) => setTechNote(e.target.value)}
          placeholder={t('opmerkingOptioneel')}
          maxLength={120}
        />

        {techError && <p className={styles.error}>{techError}</p>}

        <div className={styles.btnRow}>
          <button
            className={[styles.btn, styles.openBtn].join(' ')}
            onClick={() => registerTechnician('opening')}
            disabled={techSaving}
          >
            {t('komtAan')}
          </button>
          <button
            className={[styles.btn, styles.closeBtn].join(' ')}
            onClick={() => registerTechnician('sluiting')}
            disabled={techSaving}
          >
            {t('vertrekt')}
          </button>
        </div>

        {techLastAction && (
          <p className={styles.confirm}>
            {t(TYPE_CONFIRM[techLastAction])}
          </p>
        )}
      </div>

      {/* ── Namens medewerker registreren (owner/developer) ───────── */}
      {isOwner && employees.length > 0 && (
        <div className={styles.registerCard}>
          <h2 className={styles.registerTitle}>{t('voorMedewerkerRegistreren')}</h2>
          <p className={styles.registerSub}>
            {t('voorMedewerkerUitleg')}
          </p>

          <select
            className={styles.noteInput}
            value={onBehalfUserId}
            onChange={(e) => setOnBehalfUserId(e.target.value)}
          >
            <option value="">{t('kiesMedewerker')}</option>
            <option value={JOBSTUDENT}>{t('jobstudentMetNaam')}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>

          {onBehalfUserId === JOBSTUDENT && (
            <>
              <input
                className={styles.noteInput}
                type="text"
                list="jobstudent-names"
                placeholder={t('naamJobstudent')}
                value={onBehalfJobName}
                onChange={(e) => setOnBehalfJobName(e.target.value)}
              />
              <datalist id="jobstudent-names">
                {jobstudentNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              className={styles.noteInput}
              style={{ flex: '1 1 140px' }}
              type="date"
              value={onBehalfDate}
              onChange={(e) => setOnBehalfDate(e.target.value)}
              aria-label={t('datumLeegVandaag')}
            />
            <select
              className={styles.noteInput}
              style={{ flex: '0 0 90px' }}
              value={onBehalfHour}
              onChange={(e) => setOnBehalfHour(e.target.value)}
              aria-label={t('uur24')}
            >
              <option value="">{t('nu')}</option>
              {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')).map((h) => (
                <option key={h} value={h}>{t('uurOptie', { h })}</option>
              ))}
            </select>
            <select
              className={styles.noteInput}
              style={{ flex: '0 0 80px' }}
              value={onBehalfMinute}
              onChange={(e) => setOnBehalfMinute(e.target.value)}
              disabled={onBehalfHour === ''}
              aria-label={t('minuten')}
            >
              {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((mm) => (
                <option key={mm} value={mm}>{mm}</option>
              ))}
            </select>
          </div>
          <p className={styles.registerSub} style={{ margin: 0 }}>
            {t('uurUitleg')}
          </p>

          {onBehalfError && <p className={styles.error}>{onBehalfError}</p>}

          <div className={styles.btnRow}>
            <button
              className={[styles.btn, styles.openBtn].join(' ')}
              onClick={() => registerOnBehalf('opening')}
              disabled={onBehalfSaving}
            >
              {t('komtAan')}
            </button>
            <button
              className={[styles.btn, styles.closeBtn].join(' ')}
              onClick={() => registerOnBehalf('sluiting')}
              disabled={onBehalfSaving}
            >
              {t('vertrekt')}
            </button>
          </div>
          <div className={styles.btnRow}>
            <button
              className={[styles.btn, styles.pauseBtn].join(' ')}
              onClick={() => registerOnBehalf('pauze_start')}
              disabled={onBehalfSaving}
            >
              {t('startPauze')}
            </button>
            <button
              className={[styles.btn, styles.pauseBtn].join(' ')}
              onClick={() => registerOnBehalf('pauze_einde')}
              disabled={onBehalfSaving}
            >
              {t('eindePauze')}
            </button>
          </div>

          {onBehalfLastAction && (
            <p className={styles.confirm}>
              {t(TYPE_CONFIRM[onBehalfLastAction])}
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
            {t('tabLogboek')}
          </button>
          <button
            type="button"
            className={[styles.tabBtn, view === 'maand' ? styles.tabBtnActive : ''].filter(Boolean).join(' ')}
            onClick={handleViewMonth}
          >
            {t('tabMaandoverzicht')}
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
              {MONTH_KEYS.map((key, i) => (
                <option key={i + 1} value={i + 1}>{t(`maanden.${key}`)}</option>
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
              {monthName(selMonth)} {selYear}
            </span>
            <div className={styles.exportGroup}>
              <button
                type="button"
                className={styles.exportBtn}
                onClick={exportCsv}
                disabled={exporting}
                title={t('exporterenTitel')}
              >
                <IconDownload size={16} aria-hidden="true" />
                {t('exporteren')}
              </button>
              <a
                className={styles.exportBtn}
                href={`/logboek/afdruk?year=${selYear}&month=${selMonth}`}
                target="_blank"
                rel="noopener"
                title={t('afdrukkenTitel')}
              >
                <IconPrinter size={16} aria-hidden="true" />
                {t('afdrukken')}
              </a>
            </div>
          </div>

          {summaryLoading && <p className={styles.empty}>{t('laden')}</p>}

          {!summaryLoading && summary !== null && (
            <div className={styles.totalsRow}>
              <div className={styles.totalTile}>
                <span className={styles.totalLabel}>{t('totaalGewerkteUren')}</span>
                <span className={styles.totalValue}>
                  {t('urenKort', { uren: summary.reduce((s, e) => s + e.totalHoursAllSites, 0).toFixed(1).replace('.0', '') })}
                </span>
              </div>
              <div className={styles.totalTile}>
                <span className={styles.totalLabel}>{t('aantalWasbeurten')}</span>
                <span className={styles.totalValue}>{totalWashes.toLocaleString(dateLocale)}</span>
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
                  <span className={styles.historyMonth}>{monthName(h.month).slice(0, 3)}</span>
                  <span className={styles.historyHours}>{t('urenCompact', { uren: h.totalHours.toFixed(0) })}</span>
                  <span className={styles.historyWashes}>{t('wasbeurtenCompact', { aantal: h.totalWashes.toLocaleString(dateLocale) })}</span>
                </button>
              ))}
            </div>
          )}

          {!summaryLoading && summary !== null && summary.length === 0 && (
            <p className={styles.empty}>{t('geenRegistratiesMaand')}</p>
          )}

          {!summaryLoading && summary && summary.length > 0 && (
            <div className={styles.summaryTable}>
              {/* Header row */}
              <div className={styles.summaryHeader}>
                <span className={styles.colName}>{t('csv.medewerker')}</span>
                <span className={styles.colDays}>{t('dagen')}</span>
                <span className={styles.colHours}>{t('csv.uren')}</span>
                <span className={styles.colToggle} />
              </div>

              {summary.map((emp) => (
                <div key={emp.userId} className={styles.summaryRow}>
                  {/* Employee summary line */}
                  <div className={styles.summaryLine}>
                    <span className={styles.colName}>{emp.userName}{emp.isJobstudent && ` (${t('persoonType.jobstudent').toLowerCase()})`}</span>
                    <span className={styles.colDays}>{t('aantalDagen', { count: emp.daysWorked })}</span>
                    <span className={styles.colHoursVal}>
                      {t('urenKort', { uren: emp.totalHoursAllSites.toFixed(1).replace('.0', '') })}
                      {emp.contractHours ? (
                        <span className={styles.contractInfo}>
                          {t('vanContract', { contract: emp.contractHours.toLocaleString(dateLocale) })}
                          {(emp.overtime ?? 0) > 0 && (
                            <span className={styles.overtimeBadge}>
                              {t('overurenKort', { uren: (emp.overtime ?? 0).toLocaleString(dateLocale, { maximumFractionDigits: 1 }) })}
                            </span>
                          )}
                        </span>
                      ) : null}
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
                          <span className={styles.dayDetailDate}>{fmtDayNL(day.date, dateLocale)}</span>
                          <span className={styles.dayDetailTime}>
                            {day.checkIn || '—'} → {day.checkOut || '?'}
                            {(day.pauseMinutes ?? 0) > 0 && <> · {t('pauzeMinuten', { min: day.pauseMinutes ?? 0 })}</>}
                          </span>
                          <span className={[styles.dayDetailHours, !day.checkOut ? styles.dayDetailOpen : ''].filter(Boolean).join(' ')}>
                            {day.hours > 0 ? t('urenKort', { uren: day.hours.toFixed(1).replace('.0', '') }) : day.checkIn ? t('nietUitgestempeld') : '—'}
                          </span>
                        </div>
                      ))}
                      <div className={styles.dayDetailTotal}>
                        {t.rich('dezeSite', { uren: emp.totalHours.toFixed(1).replace('.0', ''), strong: (chunks) => <strong>{chunks}</strong> })}
                        {emp.totalHoursAllSites !== emp.totalHours && (
                          <> · {t.rich('alleSites', { uren: emp.totalHoursAllSites.toFixed(1).replace('.0', ''), strong: (chunks) => <strong>{chunks}</strong> })}</>
                        )}
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
          <h2 className={styles.logTitle}>{isOwner ? t('logboekAlleMedewerkers') : t('mijnRegistraties')}</h2>

          {grouped.size === 0 && (
            <p className={styles.empty}>{t('geenRegistraties30')}</p>
          )}

          {Array.from(grouped.entries()).map(([date, dayLogs]) => (
            <div key={date} className={styles.dayGroup}>
              <div className={styles.dayHeader}>{date}</div>
              {dayLogs.map((l) => (
                <div
                  key={l.id}
                  ref={(el) => { rowRefs.current[l.id] = el; }}
                  className={[styles.logRow, l.type === 'opening' || l.type === 'pauze_einde' ? styles.opening : styles.sluiting, highlightId === l.id ? styles.logRowHighlight : ''].filter(Boolean).join(' ')}
                >
                  <span className={styles.typeBadge}>
                    {t(TYPE_LABEL[l.type] ?? 'aankomst')}
                  </span>
                  <span className={styles.logName}>
                    {l.userName}
                    {(l.personType === 'technician_extern' || l.personType === 'jobstudent') && (
                      <span className={styles.technicianBadge}>{t(`persoonType.${l.personType}`)}</span>
                    )}
                    {l.registeredByName && (
                      <span className={styles.onBehalfBadge}>{t('door', { name: l.registeredByName })}</span>
                    )}
                  </span>
                  <span className={styles.logTime}>{fmtTime(l.timestamp, dateLocale)}</span>
                  {l.note && <span className={styles.logNote}>{l.note}</span>}
                  {(isOwner || l.userId === currentUserId) && (
                    <button
                      type="button"
                      className={styles.logDeleteBtn}
                      onClick={() => handleDeleteLog(l.id)}
                      disabled={deletingId === l.id}
                      aria-label={t('registratieVerwijderen')}
                      title={t('verwijderen')}
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
