export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'on-order';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  threshold: number;
  status: StockStatus;
  warehouse: string;
  lastUpdated: string;
  unitPrice: number;
}

export const inventoryItems: InventoryItem[] = [
  {
    id: 'inv-1',
    sku: 'WH-XR-001',
    name: 'Wireless Headphones XR',
    category: 'Audio',
    stock: 3,
    threshold: 20,
    status: 'low-stock',
    warehouse: 'Warehouse A',
    lastUpdated: '2 min ago',
    unitPrice: 129.99,
  },
  {
    id: 'inv-2',
    sku: 'KB-MX-204',
    name: 'MX Mechanical Keyboard',
    category: 'Peripherals',
    stock: 142,
    threshold: 30,
    status: 'in-stock',
    warehouse: 'Warehouse B',
    lastUpdated: '14 min ago',
    unitPrice: 89.99,
  },
  {
    id: 'inv-3',
    sku: 'MS-ULT-77',
    name: 'Ultra Silent Mouse',
    category: 'Peripherals',
    stock: 0,
    threshold: 15,
    status: 'out-of-stock',
    warehouse: 'Warehouse A',
    lastUpdated: '1 hr ago',
    unitPrice: 49.99,
  },
  {
    id: 'inv-4',
    sku: 'MN-4K-032',
    name: '4K Monitor 32"',
    category: 'Displays',
    stock: 28,
    threshold: 10,
    status: 'in-stock',
    warehouse: 'Warehouse C',
    lastUpdated: '2 hr ago',
    unitPrice: 599.99,
  },
  {
    id: 'inv-5',
    sku: 'USB-HUB-7P',
    name: 'USB-C Hub 7-Port',
    category: 'Accessories',
    stock: 8,
    threshold: 25,
    status: 'low-stock',
    warehouse: 'Warehouse A',
    lastUpdated: '3 hr ago',
    unitPrice: 34.99,
  },
  {
    id: 'inv-6',
    sku: 'WC-1080-HD',
    name: 'HD Webcam 1080p',
    category: 'Video',
    stock: 55,
    threshold: 20,
    status: 'on-order',
    warehouse: 'Warehouse B',
    lastUpdated: '5 hr ago',
    unitPrice: 79.99,
  },
];
