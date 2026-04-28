import type { ChartPoint } from '@/lib/mock-data/hero';
import styles from './HeroPanel.module.scss';

interface Point { x: number; y: number }

const W = 640;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 36, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const MAX_VAL = 160;

function scaleX(i: number, total: number) {
  return PAD.left + (i / (total - 1)) * PLOT_W;
}

function scaleY(v: number) {
  return PAD.top + PLOT_H - (v / MAX_VAL) * PLOT_H;
}

function smoothPath(pts: Point[]): string {
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (curr.x - prev.x) * 0.42;
    d += ` C ${(prev.x + cpx).toFixed(1)} ${prev.y.toFixed(1)},`
      + ` ${(curr.x - cpx).toFixed(1)} ${curr.y.toFixed(1)},`
      + ` ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

function areaPath(pts: Point[], bottomY: number): string {
  return `${smoothPath(pts)} L ${pts[pts.length - 1].x} ${bottomY} L ${pts[0].x} ${bottomY} Z`;
}

export interface StockChartProps {
  data: ChartPoint[];
}

export function StockChart({ data }: StockChartProps) {
  const addedPts  = data.map((d, i) => ({ x: scaleX(i, data.length), y: scaleY(d.added) }));
  const removedPts = data.map((d, i) => ({ x: scaleX(i, data.length), y: scaleY(d.removed) }));
  const bottomY = PAD.top + PLOT_H;
  const yGridLines = [0, 40, 80, 120, 160];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={styles.chart}
      role="img"
      aria-label="Weekly stock movement chart"
    >
      <defs>
        <linearGradient id="grad-added" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4f7cff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4f7cff" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="grad-removed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f05252" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#f05252" stopOpacity="0.02" />
        </linearGradient>
        <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Grid lines */}
      {yGridLines.map(v => (
        <line
          key={v}
          x1={PAD.left} y1={scaleY(v)}
          x2={W - PAD.right} y2={scaleY(v)}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      ))}

      {/* Y-axis labels */}
      {yGridLines.filter(v => v > 0).map(v => (
        <text
          key={v}
          x={PAD.left - 6}
          y={scaleY(v) + 4}
          textAnchor="end"
          fontSize="10"
          fill="rgba(148,163,184,0.6)"
        >
          {v}
        </text>
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => (
        <text
          key={d.day}
          x={scaleX(i, data.length)}
          y={bottomY + 20}
          textAnchor="middle"
          fontSize="10"
          fill="rgba(148,163,184,0.7)"
        >
          {d.day}
        </text>
      ))}

      {/* Area fills */}
      <path d={areaPath(addedPts,   bottomY)} fill="url(#grad-added)"   />
      <path d={areaPath(removedPts, bottomY)} fill="url(#grad-removed)" />

      {/* Lines */}
      <path d={smoothPath(addedPts)}   fill="none" stroke="#4f7cff" strokeWidth="2.5" filter="url(#glow-blue)" />
      <path d={smoothPath(removedPts)} fill="none" stroke="#f05252" strokeWidth="2"   filter="url(#glow-red)"  />

      {/* Data dots */}
      {addedPts.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill="#4f7cff" filter="url(#glow-blue)" />
      ))}
      {removedPts.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#f05252" filter="url(#glow-red)" />
      ))}
    </svg>
  );
}
