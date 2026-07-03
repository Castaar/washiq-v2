'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import styles from './ChemieChart.module.scss';

export interface ChemieDataPoint {
  week: string;
  [productName: string]: number | string;
}

export interface ChemieChartProps {
  data: ChemieDataPoint[];
  products: { name: string; unit: string }[];
}

const COLORS = [
  '#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#10b981', '#f97316', '#06b6d4', '#ec4899', '#84cc16',
];

export function ChemieChart({ data, products }: ChemieChartProps) {
  const [activeProduct, setActiveProduct] = useState<string | null>(null);

  if (products.length === 0 || data.length === 0) {
    return (
      <div className={styles.empty}>
        Geen verbruiksdata beschikbaar. Voeg maandelijkse ingaves toe om grafieken te zien.
      </div>
    );
  }

  const displayed = activeProduct ? [products.find((p) => p.name === activeProduct)!] : products;

  return (
    <div className={styles.wrapper}>
      <div className={styles.filters}>
        <button
          className={[styles.filterBtn, activeProduct === null ? styles.active : ''].join(' ')}
          onClick={() => setActiveProduct(null)}
        >
          Alle producten
        </button>
        {products.map((p) => (
          <button
            key={p.name}
            className={[styles.filterBtn, activeProduct === p.name ? styles.active : ''].join(' ')}
            onClick={() => setActiveProduct(activeProduct === p.name ? null : p.name)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '0.8125rem',
              color: 'var(--color-text-primary)',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}
          />
          {displayed.map((p, i) => (
            <Line
              key={p.name}
              type="monotone"
              dataKey={p.name}
              name={`${p.name} (${p.unit})`}
              stroke={COLORS[products.indexOf(p) % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
