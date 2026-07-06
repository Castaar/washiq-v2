'use client';

import { useState } from 'react';
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
  waterLiters: number;
  energyKw: number;
  saltKg: number;
  blobLiters: number;
  totalCost: number;
  programCounts: { programId: string; name: string; count: number }[];
  chemicalUsages: { chemicalId: string; name: string; amount: number; unit: string }[];
}

interface HistoryListProps {
  entries: HistoryEntry[];
  programs: HistoryProgram[];
}

function formatWeek(iso: string): string {
  const monday = new Date(iso);

  // ISO week number
  const tmp = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
  const dayOfWeek = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNr = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  // Sunday = Monday + 6 days
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  return `Week ${weekNr} — ${fmt(monday)} t/m ${fmt(sunday)}/${sunday.getFullYear()}`;
}

// ── Edit row ─────────────────────────────────────────────────
function EntryRow({
  entry,
  programs,
}: {
  entry: HistoryEntry;
  programs: HistoryProgram[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // form state
  const [waterLiters, setWaterLiters] = useState(String(entry.waterLiters));
  const [energyKw, setEnergyKw] = useState(String(entry.energyKw));
  const [saltKg, setSaltKg] = useState(String(entry.saltKg));
  const [blobLiters, setBlobLiters] = useState(String(entry.blobLiters ?? 0));
  const [programCounts, setProgramCounts] = useState<Record<string, string>>(
    Object.fromEntries(
      programs.map((p) => {
        const found = entry.programCounts.find((pc) => pc.programId === p.id || pc.name === p.name);
        return [p.id, String(found?.count ?? 0)];
      }),
    ),
  );
  // Deduplicate chemicals across programs (same as WeeklyEntryForm)
  const uniqueChemicals = (() => {
    const seen = new Set<string>();
    return programs.flatMap((p) => p.chemicals).filter((c) => {
      if (seen.has(c.id) || c.name.toLowerCase() === 'blob') return false;
      seen.add(c.id);
      return true;
    });
  })();

  const [chemAmounts, setChemAmounts] = useState<Record<string, string>>(
    Object.fromEntries(
      uniqueChemicals.map((c) => {
        const found = entry.chemicalUsages.find((cu) => cu.chemicalId === c.id || cu.name === c.name);
        return [c.id, String(found?.amount ?? 0)];
      }),
    ),
  );

  const totalWagens = entry.programCounts.reduce((s, pc) => s + pc.count, 0);
  const hasChemicals = uniqueChemicals.length > 0;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const body = {
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
          amount: parseFloat(chemAmounts[c.id]) || 0,
          unit: c.unit,
        })),
      };
      const res = await fetch(`/api/weekly-entry/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError('Opslaan mislukt'); return; }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.entryCard}>
      {/* ── Row header ── */}
      <div className={styles.entryHeader} onClick={() => !editing && setExpanded((v) => !v)}>
        <span className={styles.weekLabel}>{formatWeek(entry.weekStart)}</span>
        <div className={styles.entrySummary}>
          <span className={styles.summaryItem}><span className={styles.summaryLabel}>Wagens</span>{totalWagens}</span>
          <span className={styles.summaryItem}><span className={styles.summaryLabel}>Water</span>{entry.waterLiters} L</span>
          <span className={styles.summaryItem}><span className={styles.summaryLabel}>Energie</span>{entry.energyKw} kWh</span>
          <span className={styles.summaryItem}><span className={styles.summaryLabel}>Zout</span>{entry.saltKg} kg</span>
          {entry.totalCost > 0 && (
            <span className={[styles.summaryItem, styles.costItem].join(' ')}>
              <span className={styles.summaryLabel}>Kostprijs</span>
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
            {editing ? 'Annuleren' : '✏ Bewerken'}
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
                <p className={styles.editSectionTitle}>Tellerstand</p>
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
              </div>

              <div className={styles.editSection}>
                <p className={styles.editSectionTitle}>Verbruik</p>
                <div className={styles.fieldsRow}>
                  {[
                    { label: 'Energie (kWh)', value: energyKw, set: setEnergyKw },
                    { label: 'Water (L)', value: waterLiters, set: setWaterLiters },
                    { label: 'Zoutverzachter (kg)', value: saltKg, set: setSaltKg },
                    { label: 'Blob (liter)', value: blobLiters, set: setBlobLiters },
                  ].map(({ label, value, set }) => (
                    <div key={label} className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>{label}</label>
                      <input className={styles.input} type="number" value={value} onChange={(e) => set(e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              {hasChemicals && (
                <div className={styles.editSection}>
                  <p className={styles.editSectionTitle}>Chemie — totaal verbruik per product</p>
                  <div className={styles.fieldsRow}>
                    {uniqueChemicals.map((c) => (
                      <div key={c.id} className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>{c.name} ({c.unit})</label>
                        <input
                          className={styles.input}
                          type="number"
                          value={chemAmounts[c.id] ?? ''}
                          onChange={(e) => setChemAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.editFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>Annuleren</button>
                <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Tellerstand</p>
                <div className={styles.detailGrid}>
                  {entry.programCounts.map((pc) => (
                    <span key={pc.programId} className={styles.detailItem}>
                      <span className={styles.detailLabel}>{pc.name}</span>
                      <span className={styles.detailValue}>{pc.count}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Verbruik</p>
                <div className={styles.detailGrid}>
                  <span className={styles.detailItem}><span className={styles.detailLabel}>Energie</span><span className={styles.detailValue}>{entry.energyKw} kWh</span></span>
                  <span className={styles.detailItem}><span className={styles.detailLabel}>Water</span><span className={styles.detailValue}>{entry.waterLiters} L</span></span>
                  <span className={styles.detailItem}><span className={styles.detailLabel}>Zoutverzachter</span><span className={styles.detailValue}>{entry.saltKg} kg</span></span>
                  {(entry.blobLiters ?? 0) > 0 && <span className={styles.detailItem}><span className={styles.detailLabel}>Blob</span><span className={styles.detailValue}>{entry.blobLiters} L</span></span>}
                </div>
              </div>
              {entry.chemicalUsages.length > 0 && (
                <div className={styles.detailSection}>
                  <p className={styles.detailSectionTitle}>Chemie</p>
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
export function HistoryList({ entries, programs }: HistoryListProps) {
  if (entries.length === 0) {
    return <p className={styles.empty}>Nog geen ingaves gevonden voor deze carwash.</p>;
  }

  return (
    <div className={styles.list}>
      {entries.map((e) => (
        <EntryRow key={e.id} entry={e} programs={programs} />
      ))}
    </div>
  );
}
