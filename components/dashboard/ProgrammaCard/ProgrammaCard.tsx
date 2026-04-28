'use client';

import { useState } from 'react';
import type { ChemieRow } from '@/lib/types/dashboard';
import styles from './ProgrammaCard.module.scss';

export interface ProgramOption {
  id: string;
  name: string;
  count: number;
  prevCount: number;
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

export function ProgrammaCard({ programs, chemieRows }: ProgrammaCardProps) {
  const [selectedId, setSelectedId] = useState(programs[0]?.id ?? '');

  const selected = programs.find((p) => p.id === selectedId) ?? programs[0];
  const countDelta = (selected?.count ?? 0) - (selected?.prevCount ?? 0);
  const sign = countDelta >= 0 ? '+' : '';

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
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <span className={styles.selectedValue} aria-hidden="true">
            {selected?.name ?? '—'}
          </span>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.countRow}>
        <span className={styles.chemieLabel}>Wagens</span>
        <div className={styles.chemieValues}>
          <span className={styles.chemieValue}>{selected?.count ?? 0}</span>
          <span className={[styles.chemieDelta, countDelta >= 0 ? styles.positive : styles.negative].join(' ')}>
            {sign}{Math.abs(countDelta)}
          </span>
        </div>
      </div>

      {chemieRows.length > 0 && (
        <>
          <div className={styles.divider} />
          <div className={styles.rows}>
            {chemieRows.map((row) => <ChemieRowItem key={row.id} row={row} />)}
          </div>
        </>
      )}
    </div>
  );
}
