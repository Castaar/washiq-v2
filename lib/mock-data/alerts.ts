export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
}

export const alerts: Alert[] = [
  {
    id: 'a1',
    severity: 'critical',
    title: 'Stock critically low',
    description: 'Wireless Headphones XR — only 3 units remaining. Reorder threshold: 20.',
    timestamp: '2 min ago',
    isRead: false,
  },
  {
    id: 'a2',
    severity: 'critical',
    title: 'Warehouse B near capacity',
    description: 'Storage utilisation at 94%. Consider redistributing to Warehouse A.',
    timestamp: '18 min ago',
    isRead: false,
  },
  {
    id: 'a3',
    severity: 'warning',
    title: '12 products expiring soon',
    description: 'Expiry within 30 days. Review perishable stock in Zone C.',
    timestamp: '1 hr ago',
    isRead: false,
  },
  {
    id: 'a4',
    severity: 'warning',
    title: 'Supplier delivery delayed',
    description: 'TechCorp Ltd shipment #TC-4892 delayed by 3 business days.',
    timestamp: '3 hr ago',
    isRead: true,
  },
  {
    id: 'a5',
    severity: 'info',
    title: 'Bulk shipment scheduled',
    description: 'Incoming shipment of 420 units expected tomorrow at 09:00.',
    timestamp: '5 hr ago',
    isRead: true,
  },
];
