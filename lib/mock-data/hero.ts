export interface ChartPoint {
  day: string;
  added: number;
  removed: number;
}

export const weeklyStockData: ChartPoint[] = [
  { day: 'Mon', added: 85,  removed: 42 },
  { day: 'Tue', added: 118, removed: 58 },
  { day: 'Wed', added: 97,  removed: 73 },
  { day: 'Thu', added: 142, removed: 54 },
  { day: 'Fri', added: 108, removed: 89 },
  { day: 'Sat', added: 82,  removed: 38 },
  { day: 'Sun', added: 156, removed: 67 },
];

export const heroStats = {
  totalAdded: 788,
  totalRemoved: 421,
  netChange: 367,
  changePercent: 8.7,
  period: 'This week',
};
