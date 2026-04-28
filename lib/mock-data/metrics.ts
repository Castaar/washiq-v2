export interface MetricCard {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  change: number;
  changeLabel: string;
  accentColor: 'blue' | 'teal' | 'amber' | 'purple' | 'red';
  iconName: string;
}

export const metricCards: MetricCard[] = [
  {
    id: 'total-products',
    label: 'Total Products',
    value: '2,847',
    subValue: 'SKUs tracked',
    change: 12.3,
    changeLabel: 'vs last month',
    accentColor: 'blue',
    iconName: 'box',
  },
  {
    id: 'low-stock',
    label: 'Low Stock',
    value: '23',
    subValue: 'items below threshold',
    change: -8.0,
    changeLabel: 'since yesterday',
    accentColor: 'amber',
    iconName: 'alert-triangle',
  },
  {
    id: 'orders-today',
    label: 'Orders Today',
    value: '148',
    subValue: '24 pending dispatch',
    change: 6.5,
    changeLabel: 'vs yesterday',
    accentColor: 'teal',
    iconName: 'shopping-cart',
  },
  {
    id: 'stock-value',
    label: 'Stock Value',
    value: '€1.24M',
    subValue: 'across all warehouses',
    change: 3.2,
    changeLabel: 'MTD',
    accentColor: 'purple',
    iconName: 'trending-up',
  },
];
