import { inventoryItems } from '@/lib/mock-data/inventory';
import type { StockStatus } from '@/lib/mock-data/inventory';
import { Badge } from '@/components/ui/Badge/Badge';
import type { BadgeVariant } from '@/components/ui/Badge/Badge';
import styles from './InventoryPanel.module.scss';

const statusConfig: Record<StockStatus, { label: string; variant: BadgeVariant }> = {
  'in-stock':     { label: 'In Stock',   variant: 'teal'    },
  'low-stock':    { label: 'Low Stock',  variant: 'amber'   },
  'out-of-stock': { label: 'Out of Stock', variant: 'red'   },
  'on-order':     { label: 'On Order',   variant: 'purple'  },
};

function StockBar({ value, threshold }: { value: number; threshold: number }) {
  const max = Math.max(value, threshold) * 1.4;
  const pct = Math.min((value / max) * 100, 100);
  const isLow = value <= threshold;

  return (
    <div className={styles.stockBar} role="presentation">
      <div
        className={[styles.stockBarFill, isLow ? styles.low : ''].filter(Boolean).join(' ')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function InventoryPanel() {
  return (
    <section className={styles.panel} aria-labelledby="inventory-title">
      <div className={styles.header}>
        <h2 id="inventory-title" className={styles.title}>Stock Overview</h2>
        <span className={styles.count}>{inventoryItems.length} items</span>
      </div>

      <div className={styles.tableWrap} role="region" aria-label="Inventory table">
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Product</th>
              <th className={[styles.th, styles.thHideMobile].join(' ')}>SKU</th>
              <th className={[styles.th, styles.thHideTablet].join(' ')}>Category</th>
              <th className={styles.th}>Stock</th>
              <th className={styles.th}>Status</th>
              <th className={[styles.th, styles.thHideMobile].join(' ')}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {inventoryItems.map(item => {
              const s = statusConfig[item.status];
              return (
                <tr key={item.id} className={styles.row}>
                  <td className={styles.td}>
                    <span className={styles.productName}>{item.name}</span>
                    <span className={styles.warehouse}>{item.warehouse}</span>
                  </td>
                  <td className={[styles.td, styles.tdHideMobile].join(' ')}>
                    <span className={styles.sku}>{item.sku}</span>
                  </td>
                  <td className={[styles.td, styles.tdHideTablet].join(' ')}>
                    <span className={styles.category}>{item.category}</span>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.stockCell}>
                      <span className={styles.stockNum}>{item.stock}</span>
                      <StockBar value={item.stock} threshold={item.threshold} />
                    </div>
                  </td>
                  <td className={styles.td}>
                    <Badge variant={s.variant} size="sm" dot>
                      {s.label}
                    </Badge>
                  </td>
                  <td className={[styles.td, styles.tdHideMobile].join(' ')}>
                    <span className={styles.ts}>{item.lastUpdated}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
