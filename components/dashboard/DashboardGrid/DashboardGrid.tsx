import { MetricCard } from '@/components/dashboard/MetricCard/MetricCard';
import { HeroPanel } from '@/components/dashboard/HeroPanel/HeroPanel';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel/AlertsPanel';
import { InventoryPanel } from '@/components/dashboard/InventoryPanel/InventoryPanel';
import { RankingCard } from '@/components/dashboard/RankingCard/RankingCard';
import { metricCards } from '@/lib/mock-data/metrics';
import styles from './DashboardGrid.module.scss';

export function DashboardGrid() {
  return (
    <div className={styles.grid}>
      {/* Row 1 — Metric summary cards */}
      <div className={styles.metricsRow}>
        {metricCards.map(card => (
          <MetricCard key={card.id} data={card} />
        ))}
      </div>

      {/* Row 2 — Hero chart + Alerts panel */}
      <div className={styles.midRow}>
        <div className={styles.heroCol}>
          <HeroPanel />
        </div>
        <div className={styles.alertsCol}>
          <AlertsPanel data={{ alerts: [], onderhoud: [], incident: [] }} />
        </div>
      </div>

      {/* Row 3 — Inventory table + Ranking card */}
      <div className={styles.bottomRow}>
        <div className={styles.inventoryCol}>
          <InventoryPanel />
        </div>
        <div className={styles.rankingCol}>
          <RankingCard />
        </div>
      </div>
    </div>
  );
}
