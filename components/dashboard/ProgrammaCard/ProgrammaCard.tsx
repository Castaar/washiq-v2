'use client';

import { useState } from 'react';
import type { ChemieRow } from '@/lib/types/dashboard';
import styles from './ProgrammaCard.module.scss';

export interface ProgramOption {
  id: string;
  name: string;
  count: number;
  prevCount: number;
  chemicals?: string[];
}

interface ProgrammaCardProps {
  programs: ProgramOption[];
  chemieRows: ChemieRow[];
}

function ChemieRowItem({ row }: { row: ChemieRow }) {
  const isPositive = row.delta >= 0;
  const sign = isPositive ? '+' : '';

  return (
    <div className={styles.chemieRow}>
      <span className={styles.chemieLabel}>{row.label}</span>
      <div className={styles.chemieValues}>
        <span className={styles.chemieValue}>€ {row.value}</span>
        <span className={[styles.chemieDelta, isPositive ? styles.positive : styles.negative].join(' ')}>
          {sign}€ {Math.abs(row.delta)}
        </span>
      </div>
    </div>
  );
}

const ALL_ID = '__all__';

export function ProgrammaCard({ programs, chemieRows }: ProgrammaCardProps) {
  const totalCount = programs.reduce((s, p) => s + p.count, 0);
  const totalPrevCount = programs.reduce((s, p) => s + p.prevCount, 0);

  const allOption: ProgramOption = { id: ALL_ID, name: 'Alle programma\'s', count: totalCount, prevCount: totalPrevCount };
  const options = [allOption, ...programs];

  const [selectedId, setSelectedId] = useState(ALL_ID);

  const selected = selectedId === ALL_ID ? allOption : (programs.find((p) => p.id === selectedId) ?? allOption);
  const countDelta = selected.count - selected.prevCount;
  const sign = countDelta >= 0 ? '+' : '';

  // Filter chemieRows to only the chemicals configured for the selected program
  const visibleChemieRows = selectedId === ALL_ID || !selected.chemicals
    ? chemieRows
    : chemieRows.filter((r) => selected.chemicals!.includes(r.label));

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Programma</span>

        {/* Native-select pill — same pattern as SiteSelector */}
        <div className={styles.selectorPill}>
          <select
            className={styles.hiddenSelect}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Selecteer programma"
          >
            {options.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <span className={styles.selectedValue} aria-hidden="true">
            {selected.name}
          </span>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.countRow}>
        <span className={styles.chemieLabel}>Wagens</span>
        <div className={styles.chemieValues}>
          <span className={styles.chemieValue}>{selected.count}</span>
          <span className={[styles.chemieDelta, countDelta >= 0 ? styles.positive : styles.negative].join(' ')}>
            {sign}{Math.abs(countDelta)}
          </span>
        </div>
      </div>

      {visibleChemieRows.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Totaal kostprijs</span>
            <span className={styles.totalValue}>
              € {Math.round(visibleChemieRows.reduce((s, r) => s + r.value, 0) * 100) / 100}
            </span>
          </div>
          <div className={styles.divider} />
          <div className={styles.rows}>
            {visibleChemieRows.map((row) => <ChemieRowItem key={row.id} row={row} />)}
          </div>
        </>
      )}
    </div>
  );
}
