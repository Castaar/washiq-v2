'use client';

import { useState } from 'react';
import styles from './ProgrammaCard.module.scss';

export interface ProgramOption {
  id: string;
  name: string;
  count: number;
  prevCount: number;
  chemicals?: string[];
}

export interface CostBreakdown {
  label: string;
  euroPerWagen: number;
  rawPerWagen?: number;
  unit?: string;
  isChemical?: boolean;
}

interface ProgrammaCardProps {
  programs: ProgramOption[];
  totalWagens: number;
  costBreakdown: CostBreakdown[];
  prevCostBreakdown?: CostBreakdown[];
  view?: 'prijs' | 'liter';
}

const ALL_ID = '__all__';

export function ProgrammaCard({ programs, totalWagens, costBreakdown, prevCostBreakdown = [], view = 'prijs' }: ProgrammaCardProps) {
  const totalPrevCount = programs.reduce((s, p) => s + p.prevCount, 0);
  const allOption: ProgramOption = { id: ALL_ID, name: "Alle programma's", count: totalWagens, prevCount: totalPrevCount };
  const options = [allOption, ...programs];

  const [selectedId, setSelectedId] = useState(ALL_ID);
  const selected = selectedId === ALL_ID ? allOption : (programs.find((p) => p.id === selectedId) ?? allOption);
  const countDelta = selected.count - selected.prevCount;
  const countSign = countDelta >= 0 ? '+' : '';

  const isPrijs = view !== 'liter';
  const programChemicals = selectedId !== ALL_ID ? (selected.chemicals ?? null) : null;
  const visibleCosts = costBreakdown.filter((c) => {
    if (c.euroPerWagen === 0 && (c.rawPerWagen ?? 0) === 0) return false;
    if (c.isChemical && programChemicals) return programChemicals.includes(c.label);
    return true;
  });
  const grandTotal = Math.round(visibleCosts.reduce((s, c) => s + c.euroPerWagen, 0) * 100) / 100;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Programma</span>
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
          <span className={styles.selectedValue} aria-hidden="true">{selected.name}</span>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.countRow}>
        <span className={styles.chemieLabel}>Wagens</span>
        <div className={styles.chemieValues}>
          <span className={styles.chemieValue}>{selected.count.toLocaleString('nl-BE')}</span>
          {countDelta !== 0 && (
            <span className={[styles.chemieDelta, countDelta >= 0 ? styles.positive : styles.negative].join(' ')}>
              {countSign}{Math.abs(countDelta).toLocaleString('nl-BE')}
            </span>
          )}
        </div>
      </div>

      {visibleCosts.length > 0 && (
        <>
          <div className={styles.divider} />
          {isPrijs && (
            <>
              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Totaal kostprijs / wagen</span>
                <span className={styles.totalValue}>€ {grandTotal}</span>
              </div>
              <div className={styles.divider} />
            </>
          )}
          <div className={styles.rows}>
            {visibleCosts.map((c) => {
              const prev = prevCostBreakdown.find((p) => p.label === c.label);
              const delta = prev != null ? Math.round((c.euroPerWagen - prev.euroPerWagen) * 100) / 100 : null;
              const deltaPos = delta != null && delta >= 0;
              const displayVal = isPrijs && c.euroPerWagen > 0
                ? `€ ${c.euroPerWagen}`
                : c.rawPerWagen != null
                  ? `${c.rawPerWagen}${c.unit ? ` ${c.unit}` : ''}`
                  : `€ ${c.euroPerWagen}`;
              return (
                <div key={c.label} className={styles.chemieRow}>
                  <span className={styles.chemieLabel}>{c.label}</span>
                  <div className={styles.chemieValues}>
                    <span className={styles.chemieValue}>{displayVal}</span>
                    {delta !== null && delta !== 0 && (
                      <span className={[styles.chemieDelta, deltaPos ? styles.negative : styles.positive].join(' ')}>
                        {deltaPos ? '+' : ''}{delta}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
