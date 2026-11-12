'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import styles from './WaterCharts.module.scss';

const OPEN = '#3b82f6';
const CLOSED = '#f59e0b';

export function WaterCharts({ days, hourly }: { days: { label: string; open: number; closed: number }[]; hourly: number[] }) {
  const t = useTranslations('water');
  const loc = useLocale() === 'fr' ? 'fr-BE' : 'nl-BE';
  const fmt = (v: number) => `${Math.round(v).toLocaleString(loc)} L`;
  const axis = { fontSize: 11, fill: 'var(--color-text-muted)' };
  const tooltip = {
    contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 },
    formatter: (v: unknown) => fmt(Number(v)),
  };

  return (
    <div className={styles.grid}>
      <div className={styles.chart}>
        <h2 className={styles.title}>{t('perDag')}</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={days} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.15)" vertical={false} />
            <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={44} />
            <Tooltip {...tooltip} cursor={{ fill: 'rgba(127,127,127,0.08)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="open" name={t('tijdensOpening')} stackId="w" fill={OPEN} radius={[0, 0, 0, 0]} />
            <Bar dataKey="closed" name={t('buitenOpening')} stackId="w" fill={CLOSED} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.chart}>
        <h2 className={styles.title}>{t('perUur')}</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={hourly.map((v, h) => ({ uur: `${String(h).padStart(2, '0')}u`, liters: v }))} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.15)" vertical={false} />
            <XAxis dataKey="uur" tick={axis} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={axis} tickLine={false} axisLine={false} width={44} />
            <Tooltip {...tooltip} cursor={{ fill: 'rgba(127,127,127,0.08)' }} />
            <Bar dataKey="liters" name={t('gemiddeld')} fill={OPEN} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
