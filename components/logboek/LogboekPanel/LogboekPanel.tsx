'use client';

import { useState } from 'react';
import styles from './LogboekPanel.module.scss';

export interface LogEntry {
  id: string;
  userName: string;
  type: 'opening' | 'sluiting';
  timestamp: string;
  note: string;
}

interface LogboekPanelProps {
  siteId: string;
  userRole: string;
  userName: string;
  recentLogs: LogEntry[];
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

export function LogboekPanel({ siteId, userRole, userName, recentLogs }: LogboekPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>(recentLogs);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastAction, setLastAction] = useState<'opening' | 'sluiting' | null>(null);

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

  const grouped = groupByDate(logs);
  const isOwner = userRole === 'owner' || userRole === 'developer';

  return (
    <div className={styles.wrapper}>
      {/* ── Registreer aankomst / vertrek ─────────────────── */}
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

      {/* ── Logboek (owner sees all, employee sees own) ───── */}
      <div className={styles.logSection}>
        <h2 className={styles.logTitle}>{isOwner ? 'Logboek — alle medewerkers' : 'Mijn registraties'}</h2>

        {grouped.size === 0 && (
          <p className={styles.empty}>Geen registraties gevonden voor de afgelopen 30 dagen.</p>
        )}

        {Array.from(grouped.entries()).map(([date, dayLogs]) => (
          <div key={date} className={styles.dayGroup}>
            <div className={styles.dayHeader}>{date}</div>
            {dayLogs.map((l) => (
              <div key={l.id} className={[styles.logRow, l.type === 'opening' ? styles.opening : styles.sluiting].join(' ')}>
                <span className={styles.typeBadge}>
                  {l.type === 'opening' ? 'Aankomst' : 'Vertrek'}
                </span>
                <span className={styles.logName}>{l.userName}</span>
                <span className={styles.logTime}>{fmtTime(l.timestamp)}</span>
                {l.note && <span className={styles.logNote}>{l.note}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
