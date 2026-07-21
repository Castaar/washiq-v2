'use client';

import { useEffect, useState, useCallback } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet/BottomSheet';
import styles from './RankingModal.module.scss';

// ─── Types ────────────────────────────────────────────────────
interface SiteWeek {
  weekStart: string;
  water: number;
  energy: number;
  salt: number;
  flock: number;
  wagens: number;
  waterCost: number;
  energyCost: number;
  saltCost: number;
  flockCost: number;
}

interface SiteHistory {
  siteId: string;
  siteName: string;
  weeks: SiteWeek[];
}

interface SiteStat {
  id: string;
  name: string;
  location: string;
  rank: number;
  metrics: {
    water: number;
    energy: number;
    salt: number;
    flock: number;
    wagens: number;
    waterCost: number;
    energyCost: number;
    saltCost: number;
    flockCost: number;
  } | null;
}

interface RankingData {
  sites: SiteStat[];
  currentSite: { id: string; rank: number };
  history: SiteHistory[];
  totalSites: number;
  singleSite?: boolean;
}

// ─── Constants ───────────────────────────────────────────────
const SITE_COLORS = ['#0f9a78', '#3762e0', '#b8790f', '#d64545', '#8b5cf6', '#0891b2'];

type Metric = 'water' | 'energy' | 'salt' | 'flock' | 'wagens';
type Period = 'week' | 'month';
type View = 'prijs' | 'liter';

const METRICS: { key: Metric; label: string; unit: string; costKey: keyof SiteWeek | '' }[] = [
  { key: 'wagens',  label: 'Wagens',       unit: 'wgn', costKey: '' },
  { key: 'water',   label: 'Water',        unit: 'L',   costKey: 'waterCost' },
  { key: 'energy',  label: 'Energie',      unit: 'kWh', costKey: 'energyCost' },
  { key: 'salt',    label: 'Zout',         unit: 'kg',  costKey: 'saltCost' },
  { key: 'flock',   label: 'Flockmiddel',  unit: 'kg',  costKey: 'flockCost' },
];

// ─── Chart dimensions ────────────────────────────────────────
const CW = 560;
const CH = 200;
const PAD = { top: 16, right: 16, bottom: 36, left: 52 };
const IW = CW - PAD.left - PAD.right;
const IH = CH - PAD.top - PAD.bottom;

// ─── Helpers ─────────────────────────────────────────────────
function fmtDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
function fmtMonthLabel(iso: string): string {
  return MONTH_LABELS[new Date(iso).getMonth()];
}

interface ChartPoint {
  label: string;
  values: number[];
}

function buildChartData(
  history: SiteHistory[],
  metric: Metric,
  view: View,
  period: Period,
): ChartPoint[] {
  if (history.length === 0) return [];

  const metaDef = METRICS.find((m) => m.key === metric)!;
  const useCost = view === 'prijs' && metric !== 'wagens' && metaDef.costKey !== '';

  function getValue(week: SiteWeek): number {
    if (metric === 'wagens') return week.wagens;
    if (useCost) return week[metaDef.costKey as keyof SiteWeek] as number ?? 0;
    return week[metric] ?? 0;
  }

  // Collect all unique week_start values across all sites, sorted
  const weekSet = new Set<string>();
  for (const sh of history) sh.weeks.forEach((w) => weekSet.add(w.weekStart));
  const allWeeks = [...weekSet].sort();

  if (period === 'week') {
    const recentWeeks = allWeeks.slice(-8);
    return recentWeeks.map((ws) => ({
      label: fmtDateLabel(ws),
      values: history.map((sh) => {
        const w = sh.weeks.find((w) => w.weekStart === ws);
        return w ? getValue(w) : 0;
      }),
    }));
  }

  // Monthly grouping
  const monthMap = new Map<string, { label: string; weekStarts: string[] }>();
  for (const ws of allWeeks) {
    const key = ws.slice(0, 7); // "YYYY-MM"
    if (!monthMap.has(key)) {
      monthMap.set(key, { label: fmtMonthLabel(ws), weekStarts: [] });
    }
    monthMap.get(key)!.weekStarts.push(ws);
  }

  const months = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-3);

  return months.map(([, data]) => ({
    label: data.label,
    values: history.map((sh) =>
      data.weekStarts.reduce((sum, ws) => {
        const w = sh.weeks.find((w) => w.weekStart === ws);
        return sum + (w ? getValue(w) : 0);
      }, 0),
    ),
  }));
}

// ─── SVG Line Chart ──────────────────────────────────────────
function SvgChart({ points, colors }: { points: ChartPoint[]; colors: string[] }) {
  const numSites = points[0]?.values.length ?? 0;

  if (points.length === 0 || numSites === 0) {
    return (
      <svg viewBox={`0 0 ${CW} ${CH}`} className={styles.chart} aria-hidden="true">
        <text
          x={CW / 2}
          y={CH / 2}
          textAnchor="middle"
          fill="rgba(27,29,34,0.35)"
          fontSize="13"
        >
          Geen data beschikbaar
        </text>
      </svg>
    );
  }

  const allValues = points.flatMap((p) => p.values);
  const maxVal = Math.max(...allValues, 1);
  const range = maxVal || 1;

  const xPos = (i: number) =>
    PAD.left + (i / Math.max(points.length - 1, 1)) * IW;
  const yPos = (v: number) =>
    PAD.top + IH - (v / range) * IH;

  // 5 Y-axis gridlines
  const ySteps = 4;
  const yLabels: number[] = [];
  for (let i = 0; i <= ySteps; i++) {
    yLabels.push(Math.round((maxVal * i) / ySteps));
  }

  function fmtYLabel(v: number): string {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(v);
  }

  return (
    <svg
      viewBox={`0 0 ${CW} ${CH}`}
      className={styles.chart}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Y gridlines */}
      {yLabels.map((v, i) => (
        <line
          key={i}
          x1={PAD.left}
          y1={yPos(v)}
          x2={PAD.left + IW}
          y2={yPos(v)}
          stroke="rgba(27,29,34,0.08)"
          strokeWidth="1"
        />
      ))}

      {/* Y-axis labels */}
      {yLabels.map((v, i) => (
        <text
          key={i}
          x={PAD.left - 8}
          y={yPos(v) + 4}
          textAnchor="end"
          fontSize="10"
          fill="rgba(27,29,34,0.42)"
        >
          {fmtYLabel(v)}
        </text>
      ))}

      {/* X-axis labels */}
      {points.map((p, i) => (
        <text
          key={i}
          x={xPos(i)}
          y={PAD.top + IH + 22}
          textAnchor="middle"
          fontSize="10"
          fill="rgba(27,29,34,0.42)"
        >
          {p.label}
        </text>
      ))}

      {/* Lines per site */}
      {Array.from({ length: numSites }, (_, s) => {
        const pts = points
          .map((p, i) => `${xPos(i).toFixed(1)},${yPos(p.values[s]).toFixed(1)}`)
          .join(' ');
        return (
          <polyline
            key={s}
            points={pts}
            fill="none"
            stroke={colors[s % colors.length]}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.9"
          />
        );
      })}

      {/* Dots per site */}
      {Array.from({ length: numSites }, (_, s) =>
        points.map((p, i) => (
          <circle
            key={`${s}-${i}`}
            cx={xPos(i)}
            cy={yPos(p.values[s])}
            r="3.5"
            fill={colors[s % colors.length]}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="1"
          />
        )),
      )}
    </svg>
  );
}

// ─── Modal ───────────────────────────────────────────────────
export function RankingModal({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('wagens');
  const [period, setPeriod] = useState<Period>('week');
  const [view, setView] = useState<View>('liter');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ranking?siteId=${encodeURIComponent(siteId)}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chartPoints = data ? buildChartData(data.history, metric, view, period) : [];
  const currentMetric = METRICS.find((m) => m.key === metric)!;
  const showCost = view === 'prijs' && metric !== 'wagens';

  function getDisplayVal(siteMetrics: SiteStat['metrics']): string {
    if (!siteMetrics) return '—';
    if (metric === 'wagens') return siteMetrics.wagens.toLocaleString('nl-BE');
    if (showCost) {
      const key = `${metric}Cost` as keyof typeof siteMetrics;
      return `€\u202f${(siteMetrics[key] as number).toFixed(2)}`;
    }
    const raw = siteMetrics[metric as keyof typeof siteMetrics] as number;
    return `${raw.toLocaleString('nl-BE', { maximumFractionDigits: 1 })} ${currentMetric.unit}`;
  }

  return (
    <BottomSheet open onClose={onClose} title="Rangschikking">
        {loading ? (
          <div className={styles.stateBox}>Laden…</div>
        ) : !data || data.singleSite ? (
          <div className={styles.stateBox}>
            {data?.singleSite
              ? 'Dit is de enige vestiging onder dit eigenaarschap.'
              : 'Geen data beschikbaar.'}
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className={styles.controls}>
              <div className={styles.toggleGroup}>
                <button
                  className={[styles.toggle, period === 'week' ? styles.active : ''].join(' ')}
                  onClick={() => setPeriod('week')}
                  type="button"
                >
                  Week
                </button>
                <button
                  className={[styles.toggle, period === 'month' ? styles.active : ''].join(' ')}
                  onClick={() => setPeriod('month')}
                  type="button"
                >
                  Maand
                </button>
              </div>

              {metric !== 'wagens' && (
                <div className={styles.toggleGroup}>
                  <button
                    className={[styles.toggle, view === 'liter' ? styles.active : ''].join(' ')}
                    onClick={() => setView('liter')}
                    type="button"
                  >
                    Eenheid
                  </button>
                  <button
                    className={[styles.toggle, view === 'prijs' ? styles.active : ''].join(' ')}
                    onClick={() => setView('prijs')}
                    type="button"
                  >
                    Prijs
                  </button>
                </div>
              )}
            </div>

            {/* Metric tabs */}
            <div className={styles.metricTabs}>
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  className={[styles.metricTab, metric === m.key ? styles.active : ''].join(' ')}
                  onClick={() => setMetric(m.key)}
                  type="button"
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Chart */}
            <div className={styles.chartWrap}>
              <SvgChart points={chartPoints} colors={SITE_COLORS} />
            </div>

            {/* Legend & rankings */}
            <div className={styles.legend}>
              {data.sites
                .slice()
                .sort((a, b) => a.rank - b.rank)
                .map((site, i) => {
                  const colorIdx = data.sites.findIndex((s) => s.id === site.id);
                  const isCurrentSite = site.id === data.currentSite.id;
                  return (
                    <div
                      key={site.id}
                      className={[styles.legendRow, isCurrentSite ? styles.currentSite : ''].join(' ')}
                    >
                      <span
                        className={styles.legendDot}
                        style={{ background: SITE_COLORS[colorIdx % SITE_COLORS.length] }}
                      />
                      <span className={styles.legendRank}>Nr.&nbsp;{site.rank}</span>
                      <span className={styles.legendName}>{site.name}</span>
                      <span className={styles.legendVal}>{getDisplayVal(site.metrics)}</span>
                    </div>
                  );
                })}
            </div>
          </>
        )}
    </BottomSheet>
  );
}
