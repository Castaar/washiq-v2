'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { countInstantForDay } from '@/lib/dates';
import { counterOffset, toMachineReading, resetsBetween, type CounterReset } from '@/lib/counter';
import styles from './HistoryList.module.scss';

export interface HistoryChemical {
  id: string;
  name: string;
  unit: string;
}

export interface HistoryProgram {
  id: string;
  name: string;
  chemicals: HistoryChemical[];
}

export interface HistoryEntry {
  id: string;
  weekStart: string;
  createdAt?: string;
  tellerstand: number;
  waterLiters: number;
  waterTellerstand: number;
  energyKw: number;
  saltKg: number;
  blobLiters: number;
  totalCost: number;
  revenue: number | null;
  programCounts: { programId: string; name: string; count: number }[];
  chemicalUsages: { chemicalId: string; name: string; amount: number; unit: string }[];
}

interface HistoryListProps {
  entries: HistoryEntry[];
  programs: HistoryProgram[];
  startCarCount?: number;
  startWaterCount?: number;
  siteId: string;
  energyBillsByMonth: Record<string, number>;
  isSelfcarwash?: boolean;
  counterResets?: CounterReset[];
  // Day the start counts belong to (a takeover's stats_from), for the oldest entry
  startDay?: string;
}

function dateToDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`;
}

// ── Edit row ─────────────────────────────────────────────────
function EntryRow({
  entry,
  programs,
  previousTellerstand,
  previousDay,
  previousWaterTellerstand,
  siteId,
  initialElectricityAmount,
  isSelfcarwash = false,
  counterResets = [],
}: {
  entry: HistoryEntry;
  programs: HistoryProgram[];
  previousTellerstand: number;
  previousDay: string;
  counterResets?: CounterReset[];
  previousWaterTellerstand: number;
  siteId: string;
  initialElectricityAmount: number | undefined;
  isSelfcarwash?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations('historiek.list');
  const tIn = useTranslations('ingave');
  const tCommon = useTranslations('common');
  const loc = useLocale() === 'fr' ? 'fr-BE' : 'nl-BE';
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // form state
  const [weekDate, setWeekDate] = useState(dateToDateString(new Date(entry.weekStart)));
  // Stored value is the continuous counter; the user sees/edits the machine reading
  const [newTellerstand, setNewTellerstand] = useState(String(toMachineReading(counterResets, entry.weekStart.slice(0, 10), entry.tellerstand ?? 0)));
  const [electricityAmount, setElectricityAmount] = useState(
    initialElectricityAmount != null ? String(initialElectricityAmount) : '',
  );
  const [newWaterTellerstand, setNewWaterTellerstand] = useState(String(entry.waterTellerstand ?? 0));
  const [revenue, setRevenue] = useState(entry.revenue != null ? String(entry.revenue) : '');
  const [programCounts, setProgramCounts] = useState<Record<string, string>>(
    Object.fromEntries(
      programs.map((p) => {
        const found = entry.programCounts.find((pc) => pc.programId === p.id || pc.name === p.name);
        return [p.id, String(found?.count ?? 0)];
      }),
    ),
  );
  const totalWagens = entry.programCounts.reduce((s, pc) => s + pc.count, 0);

  // Chemie: stock counts belong to the date of this ingave. A missing count is filled in
  // for that date (not "today") and consumption is re-derived in date order.
  const entryDay = entry.weekStart.slice(0, 10);
  const refIso = countInstantForDay(entryDay).toISOString();
  const createdDay = entry.createdAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date(entry.createdAt)) : null;
  const [stockProducts, setStockProducts] = useState<{ id: string; name: string; unit: string }[] | null>(null);
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [existingReadings, setExistingReadings] = useState<Record<string, { id: string; quantity: number }>>({});

  useEffect(() => {
    if (!editing || stockProducts) return;
    const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date(iso));
    (async () => {
      const [pRes, rRes] = await Promise.all([
        fetch(`/api/stock?siteId=${siteId}`),
        fetch(`/api/stock/reading?siteId=${siteId}`),
      ]);
      const products = pRes.ok ? ((await pRes.json()) as { id: string; name: string; unit: string }[]) : [];
      const readings = rRes.ok ? ((await rRes.json()) as { id: string; chemicalId: string; quantity: number; recordedAt: string }[]) : [];
      const existing: Record<string, { id: string; quantity: number }> = {};
      for (const r of readings) {
        // Counts of this ingave: dated on the ingave day, or (older entries) on the day it was typed in
        const rd = dayKey(r.recordedAt);
        if ((rd === entryDay || rd === createdDay) && !existing[r.chemicalId]) existing[r.chemicalId] = { id: r.id, quantity: r.quantity };
      }
      setExistingReadings(existing);
      setStockInputs(Object.fromEntries(products.filter((pr) => existing[pr.id]).map((pr) => [pr.id, String(existing[pr.id].quantity)])));
      setStockProducts(products);
    })().catch(() => setStockProducts([]));
  }, [editing, stockProducts, siteId, entryDay, createdDay]);

  const newTellerstandNum = newTellerstand.trim() === '' ? null : parseFloat(newTellerstand);
  const programCountSum = programs.reduce((sum, p) => sum + (parseFloat(programCounts[p.id] ?? '') || 0), 0);
  const newContinuous = newTellerstandNum !== null ? newTellerstandNum + counterOffset(counterResets, weekDate) : null;
  const expectedDiff = newContinuous !== null ? newContinuous - previousTellerstand : null;
  const previousMachine = toMachineReading(counterResets, previousDay, previousTellerstand);
  const resetsInPeriod = resetsBetween(counterResets, previousDay, weekDate);
  const tellerstandMismatch = expectedDiff !== null && programCountSum !== expectedDiff;

  const newWaterTellerstandNum = newWaterTellerstand.trim() === '' ? null : parseFloat(newWaterTellerstand);
  const waterUsage = newWaterTellerstandNum !== null ? newWaterTellerstandNum - previousWaterTellerstand : 0;

  async function handleDelete() {
    if (!confirm(t('confirmDelete', { date: formatDate(entry.weekStart) }))) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/weekly-entry/${entry.id}`, { method: 'DELETE' });
      if (!res.ok) { setError(t('verwijderenMislukt')); return; }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setError('');
    if (!isSelfcarwash && newTellerstandNum === null) {
      setError(tIn('vulTellerstandIn'));
      return;
    }
    if (!isSelfcarwash && tellerstandMismatch) {
      setError(
        tIn('mismatchError', { sum: programCountSum.toLocaleString(loc), diff: (expectedDiff ?? 0).toLocaleString(loc) }),
      );
      return;
    }

    setSaving(true);
    try {
      const monday = new Date(`${weekDate}T00:00:00Z`);
      const body = {
        week_start: monday.toISOString(),
        tellerstand: isSelfcarwash ? entry.tellerstand : newContinuous,
        water_liters: waterUsage,
        water_tellerstand: newWaterTellerstandNum ?? previousWaterTellerstand,
        energy_kw: entry.energyKw,
        revenue: revenue.trim() === '' ? null : parseFloat(revenue),
        program_counts: isSelfcarwash ? [] : programs.map((p) => ({
          program_id: p.id,
          name: p.name,
          count: parseFloat(programCounts[p.id]) || 0,
        })),
      };
      const res = await fetch(`/api/weekly-entry/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError(t('opslaanMislukt')); return; }

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
      const stockCalls: Promise<Response>[] = [];
      for (const pr of stockProducts ?? []) {
        const raw = (stockInputs[pr.id] ?? '').trim();
        if (raw === '') continue;
        const qty = parseFloat(raw.replace(',', '.'));
        if (!Number.isFinite(qty) || qty < 0) continue;
        const ex = existingReadings[pr.id];
        if (ex) {
          if (qty !== ex.quantity) {
            stockCalls.push(fetch(`/api/stock/reading/${ex.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quantity: qty }),
            }));
          }
        } else {
          stockCalls.push(fetch('/api/stock/reading', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chemicalId: pr.id, quantity: qty, recordedAt: refIso }),
          }));
        }
      }
      if (stockCalls.length > 0) {
        const results = await Promise.all(stockCalls);
        if (results.some((r) => !r.ok)) { setError(t('chemieTellingMislukt')); return; }
      }
      setStockProducts(null);
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.entryCard}>
      {/* ── Row header ── */}
      <div className={styles.entryHeader} onClick={() => !editing && setExpanded((v) => !v)}>
        <span className={styles.weekLabel}>{formatDate(entry.weekStart)}</span>
        <div className={styles.entrySummary}>
          {!isSelfcarwash && <span className={styles.summaryItem}><span className={styles.summaryLabel}>{t('wagens')}</span>{totalWagens}</span>}
          <span className={styles.summaryItem}><span className={styles.summaryLabel}>{t('water')}</span>{entry.waterLiters} m³</span>
          <span className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t('elektriciteit')}</span>
            {initialElectricityAmount != null ? `€${initialElectricityAmount.toLocaleString(loc, { maximumFractionDigits: 2 })}` : '—'}
          </span>
          {entry.revenue != null && (
            <span className={styles.summaryItem}>
              <span className={styles.summaryLabel}>{tIn('omzet')}</span>
              €{entry.revenue.toLocaleString(loc, { maximumFractionDigits: 2 })}
            </span>
          )}
          {entry.totalCost > 0 && (
            <span className={[styles.summaryItem, styles.costItem].join(' ')}>
              <span className={styles.summaryLabel}>{t('waterkost')}</span>
              €{entry.totalCost.toFixed(2)}
            </span>
          )}
        </div>
        <div className={styles.entryActions}>
          <button
            type="button"
            className={styles.editBtn}
            onClick={(e) => { e.stopPropagation(); setEditing((v) => !v); setExpanded(true); }}
          >
            {editing ? tCommon('annuleren') : t('bewerken')}
          </button>
          <span className={[styles.chevron, expanded ? styles.chevronOpen : ''].join(' ')}>›</span>
        </div>
      </div>

      {/* ── Detail / edit ── */}
      {expanded && (
        <div className={styles.entryBody}>
          {editing ? (
            <>
              <div className={styles.editSection}>
                <p className={styles.editSectionTitle}>{t('datum')}</p>
                <div className={styles.fieldsRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>{t('datumIngave')}</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={weekDate}
                      onChange={(e) => setWeekDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {!isSelfcarwash && (<>
              <div className={styles.editSection}>
                <p className={styles.editSectionTitle}>{tIn('tellerstand')}</p>
                <p className={styles.lastValueHint}>{tIn('vorigeTotaal', { value: previousMachine.toLocaleString(loc) })}</p>
                {resetsInPeriod.map((r) => (
                  <p key={r.date} className={styles.lastValueHint}>
                    {t('resetHint', { date: r.date.split('-').reverse().join('/'), end: r.end_value.toLocaleString(loc) })}
                  </p>
                ))}
                <div className={styles.fieldsRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>{tIn('nieuweTellerstand')}</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={newTellerstand}
                      onChange={(e) => setNewTellerstand(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.editSection}>
                <p className={styles.editSectionTitle}>{tIn('wassingenPerProgramma')}</p>
                <div className={styles.fieldsRow}>
                  {programs.map((p) => (
                    <div key={p.id} className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>{p.name}</label>
                      <input
                        className={styles.input}
                        type="number"
                        value={programCounts[p.id] ?? ''}
                        onChange={(e) => setProgramCounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                {newTellerstandNum !== null && (
                  <p className={tellerstandMismatch ? styles.tellerstandError : styles.tellerstandOk}>
                    {tIn('somPerProgramma', { sum: programCountSum.toLocaleString(loc), diff: (expectedDiff ?? 0).toLocaleString(loc) })}
                    {tellerstandMismatch ? ` — ${tIn('komtNietOvereen')}` : ' ✓'}
                  </p>
                )}
              </div>

              </>)}

              <div className={styles.editSection}>
                <p className={styles.editSectionTitle}>{tIn('elektriciteitsfactuur')}</p>
                <div className={styles.fieldsRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>{tIn('bedrag')}</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={electricityAmount}
                      onChange={(e) => setElectricityAmount(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.editSection}>
                <p className={styles.editSectionTitle}>{tIn('omzet')}</p>
                <div className={styles.fieldsRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>{tIn('omzetBedrag')}</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.editSection}>
                <p className={styles.editSectionTitle}>{tIn('tellerstandWater')}</p>
                <p className={styles.lastValueHint}>{tIn('vorigeWater', { value: previousWaterTellerstand.toLocaleString(loc) })}</p>
                <div className={styles.fieldsRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>{tIn('nieuweWater')}</label>
                    <input
                      className={styles.input}
                      type="number"
                      value={newWaterTellerstand}
                      onChange={(e) => setNewWaterTellerstand(e.target.value)}
                    />
                  </div>
                </div>
                {newWaterTellerstandNum !== null && (
                  <p className={styles.tellerstandOk}>{tIn('verbruikPeriode', { value: waterUsage.toLocaleString(loc) })}</p>
                )}
              </div>

              <div className={styles.editSection}>
                <p className={styles.editSectionTitle}>{t('chemieVoorraadOp', { date: formatDate(entry.weekStart) })}</p>
                {stockProducts === null ? (
                  <p className={styles.fieldLabel}>{t('laden')}</p>
                ) : stockProducts.length === 0 ? (
                  <p className={styles.fieldLabel}>{t('geenProducten')}</p>
                ) : (
                  <>
                    <div className={styles.fieldsRow}>
                      {stockProducts.map((pr) => (
                        <div key={pr.id} className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>{pr.name} ({pr.unit})</label>
                          <input
                            className={styles.input}
                            type="number"
                            step="any"
                            min="0"
                            placeholder={t('nietIngegeven')}
                            value={stockInputs[pr.id] ?? ''}
                            onChange={(e) => setStockInputs((prev) => ({ ...prev, [pr.id]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                    <p className={styles.fieldLabel}>
                      {t('tellingHint')}
                    </p>
                  </>
                )}
              </div>

              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.editFooter}>
                <button type="button" className={styles.cancelBtn} onClick={handleDelete} disabled={saving}>{t('ingaveVerwijderen')}</button>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>{tCommon('annuleren')}</button>
                <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? tIn('opslaanBezig') : tCommon('opslaan')}
                </button>
              </div>
            </>
          ) : (
            <>
              {!isSelfcarwash && <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>{tIn('tellerstand')}</p>
                <div className={styles.detailGrid}>
                  {entry.programCounts.map((pc) => (
                    <span key={pc.programId} className={styles.detailItem}>
                      <span className={styles.detailLabel}>{pc.name}</span>
                      <span className={styles.detailValue}>{pc.count}</span>
                    </span>
                  ))}
                </div>
              </div>}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>{t('verbruik')}</p>
                <div className={styles.detailGrid}>
                  <span className={styles.detailItem}><span className={styles.detailLabel}>{t('water')}</span><span className={styles.detailValue}>{entry.waterLiters} m³</span></span>
                  {entry.saltKg > 0 && !entry.chemicalUsages.some((cu) => cu.name.toLowerCase() === 'zoutverzachter') && (
                    <span className={styles.detailItem}><span className={styles.detailLabel}>{t('zoutverzachter')}</span><span className={styles.detailValue}>{entry.saltKg} kg</span></span>
                  )}
                  {(entry.blobLiters ?? 0) > 0 && !entry.chemicalUsages.some((cu) => cu.name.toLowerCase() === 'blob') && (
                    <span className={styles.detailItem}><span className={styles.detailLabel}>Blob</span><span className={styles.detailValue}>{entry.blobLiters} L</span></span>
                  )}
                </div>
              </div>
              {entry.chemicalUsages.length > 0 && (
                <div className={styles.detailSection}>
                  <p className={styles.detailSectionTitle}>{t('chemie')}</p>
                  <div className={styles.detailGrid}>
                    {entry.chemicalUsages.map((cu) => (
                      <span key={cu.chemicalId} className={styles.detailItem}>
                        <span className={styles.detailLabel}>{cu.name}</span>
                        <span className={styles.detailValue}>{cu.amount} {cu.unit}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main list ─────────────────────────────────────────────────
export function HistoryList({ entries, programs, startCarCount = 0, startWaterCount = 0, siteId, energyBillsByMonth, isSelfcarwash = false, counterResets = [], startDay = '0000-00-00' }: HistoryListProps) {
  const t = useTranslations('historiek.list');
  const loc = useLocale() === 'fr' ? 'fr-BE' : 'nl-BE';
  if (entries.length === 0) {
    return <p className={styles.empty}>{t('leeg')}</p>;
  }

  return (
    <div className={styles.list}>
      {entries.map((e, i) => {
        const previousTellerstand = i < entries.length - 1 ? entries[i + 1].tellerstand : startCarCount;
        const previousDay = i < entries.length - 1 ? entries[i + 1].weekStart.slice(0, 10) : startDay;
        const previousWaterTellerstand = i < entries.length - 1 ? entries[i + 1].waterTellerstand : startWaterCount;
        const weekDate = new Date(e.weekStart);
        const billKey = `${weekDate.getUTCFullYear()}-${weekDate.getUTCMonth() + 1}`;
        return (
          <EntryRow
            key={e.id}
            entry={e}
            programs={programs}
            previousTellerstand={previousTellerstand}
            previousDay={previousDay}
            counterResets={counterResets}
            previousWaterTellerstand={previousWaterTellerstand}
            siteId={siteId}
            initialElectricityAmount={energyBillsByMonth[billKey]}
            isSelfcarwash={isSelfcarwash}
          />
        );
      })}
      {startCarCount > 0 && (
        <div className={styles.startRow}>
          <span className={styles.startLabel}>{t('beginsaldo')}</span>
          <div className={styles.startMeta}>
            <span className={styles.startItem}><span className={styles.startItemLabel}>{t('standTeller')}</span>{t('wagensAantal', { count: startCarCount.toLocaleString(loc) })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
