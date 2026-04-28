export interface RankingItem {
  rank: number;
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  trend: number;
  sparkline: number[];
}

export const topRankedItems: RankingItem[] = [
  {
    rank: 1,
    id: 'r1',
    name: 'MX Mechanical Keyboard',
    category: 'Peripherals',
    unitsSold: 892,
    revenue: 80267.08,
    trend: 14.2,
    sparkline: [40, 55, 48, 70, 65, 82, 90],
  },
  {
    rank: 2,
    id: 'r2',
    name: '4K Monitor 32"',
    category: 'Displays',
    unitsSold: 341,
    revenue: 204597.59,
    trend: 8.7,
    sparkline: [60, 55, 62, 58, 70, 68, 75],
  },
  {
    rank: 3,
    id: 'r3',
    name: 'Wireless Headphones XR',
    category: 'Audio',
    unitsSold: 1203,
    revenue: 156383.97,
    trend: -3.1,
    sparkline: [85, 90, 78, 82, 76, 74, 70],
  },
  {
    rank: 4,
    id: 'r4',
    name: 'HD Webcam 1080p',
    category: 'Video',
    unitsSold: 764,
    revenue: 61113.36,
    trend: 22.5,
    sparkline: [30, 38, 42, 50, 58, 68, 80],
  },
  {
    rank: 5,
    id: 'r5',
    name: 'USB-C Hub 7-Port',
    category: 'Accessories',
    unitsSold: 2140,
    revenue: 74878.60,
    trend: 5.9,
    sparkline: [50, 52, 55, 53, 58, 60, 62],
  },
];
