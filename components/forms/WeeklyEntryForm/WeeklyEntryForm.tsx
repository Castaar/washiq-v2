'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './WeeklyEntryForm.module.scss';

export interface Chemical {
  id: string;
  name: string;
  unit: string;
  current_stock?: number | null;
}

export interface Program {
  id: string;
  name: string;
  chemicals: Chemical[];
}

export interface WashesTask {
  id: string;
  description: string;
  triggerValue: number;
  washesAtLastDone: number;
}

export interface LastEntryData {
  tellerstand: number;
  waterLiters: number;
  energyKw: number;
  saltKg: number;
  blobLiters: number;
  programCounts: { programId: string; count: number }[];
  chemicalUsages: { chemicalId: string; programId: string; amount: number }[];
}

export interface WeeklyEntryFormProps {
  siteId: string;
  programs: Program[];
  lastEntry: LastEntryData | null;
  washesTasks?: WashesTask[];
}

// Monday (00:00 UTC) of the ISO week containing the given YYYY-MM-DD date string
function dateStringToMonday(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dayOfWeek = d.getUTCDay() || 7; // Sunday -> 7
  d.setUTCDate(d.getUTCDate() - (dayOfWeek - 1));
  return d;
}

function dateToDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fmtDayMonth(d: Date): string {
  return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`;
}

// ─── Delta helper ────────────────────────────────────────────
function getDelta(valueStr: string, lastValue: number | undefined | null): number | null {
  if (lastValue === undefined || lastValue === null) return null;
  const curr = parseFloat(valueStr);
  if (isNaN(curr) || valueStr === '') return null;
  return Math.round((curr - lastValue) * 100) / 100;
}

// ─── Single entry field ───────────────────────────────────────
function EntryField({
  label,
  value,
  onChange,
  delta,
  lastValue,
  stockLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  delta: number | null;
  lastValue?: number | null;
  stockLabel?: string;
}) {
  const sign = delta !== null && delta >= 0 ? '+' : '';
  const deltaClass = delta !== null && delta < 0 ? styles.negative : styles.positive;

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
        />
        {delta !== null && (
          <span className={[styles.deltaBadge, deltaClass].join(' ')}>
            {sign}{delta}
          </span>
        )}
      </div>
      {lastValue != null && (
        <span className={styles.lastValue}>Vorige: {lastValue}</span>
      )}
      {stockLabel && (
        <span className={styles.stockHint}>{stockLabel}</span>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={styles.sectionTitle}>{children}</h2>;
}

// ─── Main form ────────────────────────────────────────────────
export function WeeklyEntryForm({ siteId, programs, lastEntry, washesTasks = [] }: WeeklyEntryFormProps) {
  const router = useRouter();

  const uniqueChemicals = useMemo(() => {
    const seen = new Set<string>();
    const result: Chemical[] = [];
    for (const p of programs) {
      for (const c of p.chemicals) {
        if (!seen.has(c.id) && c.name.toLowerCase() !== 'blob') { seen.add(c.id); result.push(c); }
      }
    }
    return result;
  }, [programs]);

  const [programCounts, setProgramCounts] = useState<Record<string, string>>(
    () => Object.fromEntries(programs.map((p) => [p.id, ''])),
  );
  const [waterLiters, setWaterLiters] = useState('');
  const [energyKw, setEnergyKw] = useState('');
  const [saltKg, setSaltKg] = useState('');
  const [blobLiters, setBlobLiters] = useState('');
  const [chemicalUsages, setChemicalUsages] = useState<Record<string, string>>(
    () => Object.fromEntries(uniqueChemicals.map((c) => [c.id, ''])),
  );
  const [pickedDate, setPickedDate] = useState<string>(() => dateToDateString(new Date()));
  const [saving, setSaving] = useState(false);

  // Auto-compute tellerstand from previous + sum of this week's program counts
  const computedTellerstand = (lastEntry?.tellerstand ?? 0) +
    programs.reduce((sum, p) => sum + (parseFloat(programCounts[p.id] ?? '') || 0), 0);

  const maintenanceWarnings = washesTasks
    .map((t) => {
      const due = t.washesAtLastDone + t.triggerValue;
      const remaining = due - computedTellerstand;
      const threshold = Math.max(500, Math.round(t.triggerValue * 0.1));
      if (computedTellerstand >= due) return { task: t, type: 'overdue' as const, remaining: 0 };
      if (computedTellerstand >= due - threshold) return { task: t, type: 'approaching' as const, remaining };
      return null;
    })
    .filter((w): w is NonNullable<typeof w> => w !== null);

  const setProgramCount = useCallback((id: string, v: string) => {
    setProgramCounts((prev) => ({ ...prev, [id]: v }));
  }, []);

  const setChemical = useCallback((key: string, v: string) => {
    setChemicalUsages((prev) => ({ ...prev, [key]: v }));
  }, []);

  // Delta lookup maps from last entry
  const lastCountMap = Object.fromEntries(
    (lastEntry?.programCounts ?? []).map((pc) => [pc.programId, pc.count]),
  );
  const lastChemMap = Object.fromEntries(
    (lastEntry?.chemicalUsages ?? []).map((cu) => [cu.chemicalId, cu.amount]),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const monday = dateStringToMonday(pickedDate);

    const body = {
      site_id: siteId,
      week_start: monday.toISOString(),
      tellerstand: computedTellerstand,
      water_liters: parseFloat(waterLiters) || 0,
      energy_kw: parseFloat(energyKw) || 0,
      salt_kg: parseFloat(saltKg) || 0,
      blob_liters: parseFloat(blobLiters) || 0,
      program_counts: programs.map((p) => ({
        program_id: p.id,
        name: p.name,
        count: parseFloat(programCounts[p.id]) || 0,
      })),
      chemical_usages: uniqueChemicals.map((c) => ({
        chemical_id: c.id,
        name: c.name,
        amount: parseFloat(chemicalUsages[c.id]) || 0,
        unit: c.unit,
      })),
    };

    try {
      const res = await fetch('/api/weekly-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const today = dateToDateString(new Date());
  const pickedMonday = dateStringToMonday(pickedDate);
  const pickedSunday = new Date(pickedMonday); pickedSunday.setUTCDate(pickedSunday.getUTCDate() + 6);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>

      {/* ── Week selector ────────────────────────────────────── */}
      <div className={styles.weekPickerRow}>
        <label className={styles.weekPickerLabel} htmlFor="weekPicker">Kies een datum in de week die u wilt invullen</label>
        <input
          id="weekPicker"
          className={styles.weekInput}
          type="date"
          value={pickedDate}
          max={today}
          onChange={(e) => setPickedDate(e.target.value)}
        />
        <span className={styles.weekPickerHint}>
          Week van {fmtDayMonth(pickedMonday)} t/m {fmtDayMonth(pickedSunday)}
        </span>
      </div>

      {/* ── Section 0: Tellerstand (auto-computed) ──────────── */}
      <section className={styles.section}>
        <SectionTitle>Tellerstand</SectionTitle>
        <div className={styles.tellerstandDisplay}>
          {lastEntry?.tellerstand != null && (
            <span className={styles.lastValue}>Vorige: {lastEntry.tellerstand.toLocaleString('nl-BE')}</span>
          )}
          <span className={styles.tellerstandValue}>
            Nieuw totaal: <strong>{computedTellerstand.toLocaleString('nl-BE')}</strong>
          </span>
        </div>
        {maintenanceWarnings.length > 0 && (
          <div className={styles.maintenanceWarnings}>
            {maintenanceWarnings.map(({ task, type, remaining }) => (
              <div key={task.id} className={type === 'overdue' ? styles.warnOverdue : styles.warnApproaching}>
                <strong>{task.description}</strong>
                {type === 'overdue'
                  ? ' — vervallen! Onderhoud is al voorbij.'
                  : ` — nog ${remaining.toLocaleString('nl-BE')} wagens tot onderhoud.`}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 1: Tellerstand per programma ─────────── */}
      <section className={styles.section}>
        <SectionTitle>Tellerstand — aantal wassingen per programma</SectionTitle>
        <div className={styles.fieldsRow}>
          {programs.length > 0 ? programs.map((p) => (
            <EntryField
              key={p.id}
              label={p.name}
              value={programCounts[p.id] ?? ''}
              onChange={(v) => setProgramCount(p.id, v)}
              delta={getDelta(programCounts[p.id] ?? '', lastCountMap[p.id])}
              lastValue={lastCountMap[p.id] ?? null}
            />
          )) : (
            <p className={styles.emptyHint}>Geen programma&apos;s gevonden. Voeg eerst programma&apos;s toe in de database.</p>
          )}
        </div>
      </section>

      {/* ── Section 2: Verbruik ──────────────────────────────── */}
      <section className={styles.section}>
        <SectionTitle>Verbruik — geldt voor alle programma&apos;s</SectionTitle>
        <div className={styles.fieldsRow}>
          <EntryField
            label="Water (m³)"
            value={waterLiters}
            onChange={setWaterLiters}
            delta={getDelta(waterLiters, lastEntry?.waterLiters)}
            lastValue={lastEntry?.waterLiters ?? null}
          />
          <EntryField
            label="Elektriciteit (kWh)"
            value={energyKw}
            onChange={setEnergyKw}
            delta={getDelta(energyKw, lastEntry?.energyKw)}
            lastValue={lastEntry?.energyKw ?? null}
          />
          <EntryField
            label="Zoutverzachter (kg)"
            value={saltKg}
            onChange={setSaltKg}
            delta={getDelta(saltKg, lastEntry?.saltKg)}
            lastValue={lastEntry?.saltKg ?? null}
          />
          <EntryField
            label="Blob (liter)"
            value={blobLiters}
            onChange={setBlobLiters}
            delta={getDelta(blobLiters, lastEntry?.blobLiters)}
            lastValue={lastEntry?.blobLiters ?? null}
          />
        </div>
      </section>

      {/* ── Section 3: Chemie totaal per product ────────────── */}
      {uniqueChemicals.length > 0 && (
        <section className={styles.section}>
          <SectionTitle>Chemie — totaal verbruik per product</SectionTitle>
          <div className={styles.fieldsRow}>
            {uniqueChemicals.map((c) => (
              <EntryField
                key={c.id}
                label={`${c.name} (${c.unit})`}
                value={chemicalUsages[c.id] ?? ''}
                onChange={(v) => setChemical(c.id, v)}
                delta={getDelta(chemicalUsages[c.id] ?? '', lastChemMap[c.id])}
                lastValue={lastChemMap[c.id] ?? null}
                stockLabel={c.current_stock != null ? `Voorraad: ${c.current_stock} ${c.unit}` : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className={styles.footer}>
        <Link href={`/historiek${siteId ? `?site=${siteId}` : ''}`} className={styles.historyLink}>
          Historiek bekijken
        </Link>
        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </form>
  );
}
