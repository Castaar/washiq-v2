import { useLocale, useTranslations } from 'next-intl';
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
  skipped?: string[]; // dates of counts marked invalid inside this period
}

export interface VerbruikProduct {
  name: string;
  unit: string;
  periods: VerbruikPeriod[]; // newest first
}

function n(v: number, loc: string): string {
  return (Math.round(v * 100) / 100).toLocaleString(loc);
}

function signed(v: number, loc: string): string {
  if (v === 0) return '0';
  return `${v > 0 ? '+' : '−'}${n(Math.abs(v), loc)}`;
}

function Row({ p, unit }: { p: VerbruikPeriod; unit: string }) {
  const t = useTranslations('historiek.tabel');
  const loc = useLocale() === 'fr' ? 'fr-BE' : 'nl-BE';
  const suspicious = p.consumption < 0;
  return (
    <tr className={suspicious ? styles.warnRow : undefined}>
      <td>
        {p.from} → {p.to}
        {p.skipped && p.skipped.length > 0 && <span className={styles.skipped}> {t('tellingOngeldig', { dates: p.skipped.join(', ') })}</span>}
      </td>
      <td>{n(p.start, loc)}</td>
      <td>{signed(p.delivered, loc)}</td>
      <td>{signed(p.transferred, loc)}</td>
      <td>{signed(p.adjusted, loc)}</td>
      <td>{n(p.end, loc)}</td>
      <td className={styles.strong}>
        {n(p.consumption, loc)} {unit}
        {suspicious && <span className={styles.warn}> {t('negatief')}</span>}
      </td>
      <td>{p.wagens > 0 ? p.wagens.toLocaleString(loc) : '–'}</td>
      <td>{p.wagens > 0 ? `${(Math.round((p.consumption / p.wagens) * 1000) / 1000).toLocaleString(loc)} ${unit}` : '–'}</td>
    </tr>
  );
}

export function VerbruikTable({ products }: { products: VerbruikProduct[] }) {
  const t = useTranslations('historiek.tabel');
  const loc = useLocale() === 'fr' ? 'fr-BE' : 'nl-BE';
  const withPeriods = products.filter((p) => p.periods.length > 0);
  if (withPeriods.length === 0) {
    return <p className={styles.empty}>{t('leeg')}</p>;
  }
  return (
    <div className={styles.list}>
      {withPeriods.map((prod) => (
        <details key={prod.name} className={styles.product}>
          <summary className={styles.summary}>
            <span className={styles.name}>{prod.name}</span>
            <span className={styles.latest}>
              {n(prod.periods[0].consumption, loc)} {prod.unit}
              <span className={styles.latestMeta}> · {prod.periods[0].from} → {prod.periods[0].to}</span>
            </span>
          </summary>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('periode')}</th>
                  <th>{t('begin')}</th>
                  <th>{t('leveringen')}</th>
                  <th>{t('verplaatst')}</th>
                  <th>{t('correcties')}</th>
                  <th>{t('eind')}</th>
                  <th>{t('verbruik')}</th>
                  <th>{t('wagens')}</th>
                  <th>{t('perWagen')}</th>
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
