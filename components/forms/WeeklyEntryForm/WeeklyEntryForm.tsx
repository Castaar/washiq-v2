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

export interface LastEntryData {
  waterLiters: number;
  energyKw: number;
  saltKg: number;
  flockKg: number;
  clothUnits: number;
  programCounts: { programId: string; count: number }[];
  chemicalUsages: { chemicalId: string; programId: string; amount: number }[];
}

export interface WeeklyEntryFormProps {
  siteId: string;
  programs: Program[];
  lastEntry: LastEntryData | null;
}

// ─── ISO week helpers ────────────────────────────────────────
function dateToWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function weekStringToMonday(weekStr: string): Date {
  const [yearPart, weekPart] = weekStr.split('-W');
  const year = parseInt(yearPart, 10);
  const week = parseInt(weekPart, 10);
  // Monday of week 1: find Jan 4 (always in week 1), then back to Monday
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfJan4 = jan4.getUTCDay() || 7;
  const monday1 = new Date(jan4);
  monday1.setUTCDate(jan4.getUTCDate() - (dayOfJan4 - 1));
  const monday = new Date(monday1);
  monday.setUTCDate(monday1.getUTCDate() + (week - 1) * 7);
  return monday;
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
export function WeeklyEntryForm({ siteId, programs, lastEntry }: WeeklyEntryFormProps) {
  const router = useRouter();

  const uniqueChemicals = useMemo(() => {
    const seen = new Set<string>();
    const result: Chemical[] = [];
    for (const p of programs) {
      for (const c of p.chemicals) {
        if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
      }
    }
    return result;
  }, [programs]);

  const [programCounts, setProgramCounts] = useState<Record<string, string>>(
    () => Object.fromEntries(programs.map((p) => [p.id, ''])),
  );
  const [waterLiters, setWaterLiters] = useState('');
  const [saltKg, setSaltKg] = useState('');
  const [flockKg, setFlockKg] = useState('');
  const [clothUnits, setClothUnits] = useState('');
  const [chemicalUsages, setChemicalUsages] = useState<Record<string, string>>(
    () => Object.fromEntries(uniqueChemicals.map((c) => [c.id, ''])),
  );
  const [weekStart, setWeekStart] = useState<string>(() => dateToWeekString(new Date()));
  const [saving, setSaving] = useState(false);

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

    const monday = weekStringToMonday(weekStart);

    const body = {
      site_id: siteId,
      week_start: monday.toISOString(),
      water_liters: parseFloat(waterLiters) || 0,
      energy_kw: 0,
      salt_kg: parseFloat(saltKg) || 0,
      flock_kg: parseFloat(flockKg) || 0,
      cloth_units: parseFloat(clothUnits) || 0,
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

  const currentWeek = dateToWeekString(new Date());

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>

      {/* ── Week selector ────────────────────────────────────── */}
      <div className={styles.weekPickerRow}>
        <label className={styles.weekPickerLabel} htmlFor="weekPicker">Week invullen voor</label>
        <input
          id="weekPicker"
          className={styles.weekInput}
          type="week"
          value={weekStart}
          max={currentWeek}
          onChange={(e) => setWeekStart(e.target.value)}
        />
      </div>

      {/* ── Section 1: Tellerstand ───────────────────────────── */}
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
            label="Water (liter)"
            value={waterLiters}
            onChange={setWaterLiters}
            delta={getDelta(waterLiters, lastEntry?.waterLiters)}
            lastValue={lastEntry?.waterLiters ?? null}
          />
          <EntryField
            label="Zoutverzachter (kg)"
            value={saltKg}
            onChange={setSaltKg}
            delta={getDelta(saltKg, lastEntry?.saltKg)}
            lastValue={lastEntry?.saltKg ?? null}
          />
          <EntryField
            label="Flockmiddel (kg)"
            value={flockKg}
            onChange={setFlockKg}
            delta={getDelta(flockKg, lastEntry?.flockKg)}
            lastValue={lastEntry?.flockKg ?? null}
          />
          <EntryField
            label="Ruitendoekjes (stuks)"
            value={clothUnits}
            onChange={setClothUnits}
            delta={getDelta(clothUnits, lastEntry?.clothUnits)}
            lastValue={lastEntry?.clothUnits ?? null}
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
