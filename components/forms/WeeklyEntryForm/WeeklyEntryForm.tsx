'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { countInstantForDay } from '@/lib/dates';
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
  waterTellerstand: number;
  energyKw: number;
  saltKg: number;
  blobLiters: number;
  programCounts: { programId: string; count: number }[];
  chemicalUsages: { chemicalId: string; programId: string; amount: number }[];
}

export interface WeeklyEntryFormProps {
  siteId: string;
  programs: Program[];
  products: Chemical[];
  lastEntry: LastEntryData | null;
  washesTasks?: WashesTask[];
  startCarCount?: number;
  startWaterCount?: number;
  contentTranslations?: Record<string, string>;
}

// The ingave is stored on the exact date that was picked (00:00 UTC), not snapped to a week.
function dateStringToDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
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
export function WeeklyEntryForm({ siteId, programs, products, lastEntry, washesTasks = [], startCarCount = 0, startWaterCount = 0, contentTranslations = {} }: WeeklyEntryFormProps) {
  const router = useRouter();
  const tProduct = (name: string) => contentTranslations[`product.${name}`] || name;
  const tProgram = (name: string) => contentTranslations[`program.${name}`] || name;

  const uniqueChemicals = useMemo(() => {
    const seen = new Set<string>();
    const result: Chemical[] = [];
    for (const c of products) {
      if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
    }
    return result;
  }, [products]);

  const [programCounts, setProgramCounts] = useState<Record<string, string>>(
    () => Object.fromEntries(programs.map((p) => [p.id, ''])),
  );
  const [newTellerstand, setNewTellerstand] = useState('');
  const [electricityAmount, setElectricityAmount] = useState('');
  const [newWaterTellerstand, setNewWaterTellerstand] = useState('');
  const [energyKw, setEnergyKw] = useState('');
  // Per product: the new physical stock count (not a usage amount) — posted
  // straight to /api/stock/reading, which derives consumption itself from
  // (previous reading + deliveries since - this new count), same as Instellingen.
  const [stockCounts, setStockCounts] = useState<Record<string, string>>(
    () => Object.fromEntries(uniqueChemicals.map((c) => [c.id, ''])),
  );
  const [pickedDate, setPickedDate] = useState<string>(() => dateToDateString(new Date()));
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const previousTellerstand = lastEntry?.tellerstand ?? startCarCount;
  const newTellerstandNum = newTellerstand.trim() === '' ? null : parseFloat(newTellerstand);
  const programCountSum = programs.reduce((sum, p) => sum + (parseFloat(programCounts[p.id] ?? '') || 0), 0);
  const expectedDiff = newTellerstandNum !== null ? newTellerstandNum - previousTellerstand : null;
  const tellerstandMismatch = expectedDiff !== null && programCountSum !== expectedDiff;

  const previousWaterTellerstand = lastEntry?.waterTellerstand ?? startWaterCount;
  const newWaterTellerstandNum = newWaterTellerstand.trim() === '' ? null : parseFloat(newWaterTellerstand);
  const waterUsage = newWaterTellerstandNum !== null ? newWaterTellerstandNum - previousWaterTellerstand : 0;

  const maintenanceWarnings = washesTasks
    .map((t) => {
      const effectiveTellerstand = newTellerstandNum ?? previousTellerstand;
      const due = t.washesAtLastDone + t.triggerValue;
      const remaining = due - effectiveTellerstand;
      const threshold = Math.max(500, Math.round(t.triggerValue * 0.1));
      if (effectiveTellerstand >= due) return { task: t, type: 'overdue' as const, remaining: 0 };
      if (effectiveTellerstand >= due - threshold) return { task: t, type: 'approaching' as const, remaining };
      return null;
    })
    .filter((w): w is NonNullable<typeof w> => w !== null);

  const setProgramCount = useCallback((id: string, v: string) => {
    setProgramCounts((prev) => ({ ...prev, [id]: v }));
  }, []);

  const setStockCount = useCallback((key: string, v: string) => {
    setStockCounts((prev) => ({ ...prev, [key]: v }));
  }, []);

  // Delta lookup map from last entry
  const lastCountMap = Object.fromEntries(
    (lastEntry?.programCounts ?? []).map((pc) => [pc.programId, pc.count]),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (newTellerstandNum === null) {
      setSubmitError('Vul de nieuwe tellerstand in.');
      return;
    }
    if (tellerstandMismatch) {
      setSubmitError(
        `Som van de tellerstanden per programma (${programCountSum.toLocaleString('nl-BE')}) komt niet overeen met het verschil tussen nieuwe en vorige tellerstand (${(expectedDiff ?? 0).toLocaleString('nl-BE')}).`,
      );
      return;
    }

    setSaving(true);

    const monday = dateStringToDay(pickedDate);

    const body = {
      site_id: siteId,
      week_start: monday.toISOString(),
      tellerstand: newTellerstandNum,
      water_liters: waterUsage,
      water_tellerstand: newWaterTellerstandNum ?? previousWaterTellerstand,
      energy_kw: parseFloat(energyKw) || 0,
      program_counts: programs.map((p) => ({
        program_id: p.id,
        name: p.name,
        count: parseFloat(programCounts[p.id]) || 0,
      })),
    };

    try {
      const res = await fetch('/api/weekly-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setSubmitError('Opslaan mislukt — probeer opnieuw.');
        return;
      }

      // Each filled-in product count is a physical stock reading — post it
      // to the same endpoint Instellingen uses, so consumption is derived
      // automatically instead of typed in directly.
      // The count belongs to the ingave's date (end of that day), not to the moment
      // it was typed in — so periods run from ingave to ingave.
      const countAt = countInstantForDay(pickedDate).toISOString();
      const readings = uniqueChemicals
        .filter((c) => (stockCounts[c.id] ?? '').trim() !== '')
        .map((c) =>
          fetch('/api/stock/reading', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chemicalId: c.id, quantity: parseFloat(stockCounts[c.id].replace(',', '.')) || 0, recordedAt: countAt }),
          }),
        );
      if (readings.length > 0) await Promise.allSettled(readings);

      if (electricityAmount.trim() !== '') {
        await fetch('/api/energy-bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId,
            year: monday.getUTCFullYear(),
            month: monday.getUTCMonth() + 1,
            amount_euro: parseFloat(electricityAmount) || 0,
          }),
        });
      }

      router.push('/');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const today = dateToDateString(new Date());

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
          Ingave van {fmtDayMonth(dateStringToDay(pickedDate))}
        </span>
      </div>

      {/* ── Section 0: Tellerstand (manueel ingegeven) ──────── */}
      <section className={styles.section}>
        <SectionTitle>Tellerstand</SectionTitle>
        <div className={styles.tellerstandDisplay}>
          <span className={styles.lastValue}>Vorige tellerstand totaal: {previousTellerstand.toLocaleString('nl-BE')}</span>
        </div>
        <div className={styles.fieldsRow}>
          <EntryField
            label="Nieuwe tellerstand"
            value={newTellerstand}
            onChange={setNewTellerstand}
            delta={null}
          />
        </div>
        {maintenanceWarnings.length > 0 && (
          <div className={styles.maintenanceWarnings}>
            {maintenanceWarnings.map(({ task, type, remaining }) => (
              <div key={task.id} className={type === 'overdue' ? styles.warnOverdue : styles.warnApproaching}>
                <strong>{contentTranslations[`task.${task.description}`] || task.description}</strong>
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
        <SectionTitle>Aantal wassingen per programma</SectionTitle>
        <div className={styles.fieldsRow}>
          {programs.length > 0 ? programs.map((p) => (
            <EntryField
              key={p.id}
              label={tProgram(p.name)}
              value={programCounts[p.id] ?? ''}
              onChange={(v) => setProgramCount(p.id, v)}
              delta={getDelta(programCounts[p.id] ?? '', lastCountMap[p.id])}
              lastValue={lastCountMap[p.id] ?? null}
            />
          )) : (
            <p className={styles.emptyHint}>Geen programma&apos;s gevonden. Voeg eerst programma&apos;s toe in de database.</p>
          )}
        </div>
        {newTellerstandNum !== null && (
          <p className={tellerstandMismatch ? styles.tellerstandError : styles.tellerstandOk}>
            Som per programma: {programCountSum.toLocaleString('nl-BE')} — verwacht verschil: {(expectedDiff ?? 0).toLocaleString('nl-BE')}
            {tellerstandMismatch ? ' — komt niet overeen!' : ' ✓'}
          </p>
        )}
      </section>

      {/* ── Section 1b: Elektriciteitsfactuur ───────────────── */}
      <section className={styles.section}>
        <SectionTitle>Elektriciteitsfactuur</SectionTitle>
        <div className={styles.fieldsRow}>
          <EntryField
            label="Bedrag (€)"
            value={electricityAmount}
            onChange={setElectricityAmount}
            delta={null}
          />
        </div>
      </section>

      {/* ── Section 1c: Tellerstand water ────────────────────── */}
      <section className={styles.section}>
        <SectionTitle>Tellerstand water</SectionTitle>
        <div className={styles.tellerstandDisplay}>
          <span className={styles.lastValue}>Vorige tellerstand water: {previousWaterTellerstand.toLocaleString('nl-BE')} m³</span>
        </div>
        <div className={styles.fieldsRow}>
          <EntryField
            label="Nieuwe tellerstand water (m³)"
            value={newWaterTellerstand}
            onChange={setNewWaterTellerstand}
            delta={null}
          />
        </div>
        {newWaterTellerstandNum !== null && (
          <p className={styles.tellerstandOk}>Verbruik deze periode: {waterUsage.toLocaleString('nl-BE')} m³</p>
        )}
      </section>

      {/* ── Section 3: Voorraad per product ─────────────────── */}
      {uniqueChemicals.length > 0 && (
        <section className={styles.section}>
          <SectionTitle>Voorraad per product</SectionTitle>
          <p className={styles.sectionHint}>Geef de nieuwe voorraad in — het verbruik wordt automatisch berekend.</p>
          <div className={styles.fieldsRow}>
            {uniqueChemicals.map((c) => (
              <EntryField
                key={c.id}
                label={`${tProduct(c.name)} — nieuwe voorraad (${c.unit})`}
                value={stockCounts[c.id] ?? ''}
                onChange={(v) => setStockCount(c.id, v)}
                delta={getDelta(stockCounts[c.id] ?? '', c.current_stock ?? null)}
                lastValue={c.current_stock ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ───────────────────────────────────────────── */}
      {submitError && <p className={styles.tellerstandError}>{submitError}</p>}
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
