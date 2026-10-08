import styles from './VerbruikTable.module.scss';

export interface VerbruikPeriod {
  from: string;
  to: string;
  start: number;
  delivered: number;
  transferred: number;
  adjusted: number;
  end: number;
  consumption: number;
  wagens: number;
}

export interface VerbruikProduct {
  name: string;
  unit: string;
  periods: VerbruikPeriod[]; // newest first
}

function n(v: number): string {
  return (Math.round(v * 100) / 100).toLocaleString('nl-BE');
}

function signed(v: number): string {
  if (v === 0) return '0';
  return `${v > 0 ? '+' : '−'}${n(Math.abs(v))}`;
}

function Row({ p, unit }: { p: VerbruikPeriod; unit: string }) {
  const suspicious = p.consumption < 0;
  return (
    <tr className={suspicious ? styles.warnRow : undefined}>
      <td>{p.from} → {p.to}</td>
      <td>{n(p.start)}</td>
      <td>{signed(p.delivered)}</td>
      <td>{signed(p.transferred)}</td>
      <td>{signed(p.adjusted)}</td>
      <td>{n(p.end)}</td>
      <td className={styles.strong}>
        {n(p.consumption)} {unit}
        {suspicious && <span className={styles.warn}> negatief — controleer telling of levering</span>}
      </td>
      <td>{p.wagens > 0 ? p.wagens.toLocaleString('nl-BE') : '–'}</td>
      <td>{p.wagens > 0 ? `${(Math.round((p.consumption / p.wagens) * 1000) / 1000).toLocaleString('nl-BE')} ${unit}` : '–'}</td>
    </tr>
  );
}

export function VerbruikTable({ products }: { products: VerbruikProduct[] }) {
  const withPeriods = products.filter((p) => p.periods.length > 0);
  if (withPeriods.length === 0) {
    return <p className={styles.empty}>Nog geen verbruik: er zijn minstens twee tellingen per product nodig.</p>;
  }
  return (
    <div className={styles.list}>
      {withPeriods.map((prod) => (
        <details key={prod.name} className={styles.product}>
          <summary className={styles.summary}>
            <span className={styles.name}>{prod.name}</span>
            <span className={styles.latest}>
              {n(prod.periods[0].consumption)} {prod.unit}
              <span className={styles.latestMeta}> · {prod.periods[0].from} → {prod.periods[0].to}</span>
            </span>
          </summary>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Begin</th>
                  <th>Leveringen</th>
                  <th>Verplaatst</th>
                  <th>Correcties</th>
                  <th>Eind</th>
                  <th>Verbruik</th>
                  <th>Wagens</th>
                  <th>Per wagen</th>
                </tr>
              </thead>
              <tbody>
                {prod.periods.map((p, i) => <Row key={i} p={p} unit={prod.unit} />)}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}
