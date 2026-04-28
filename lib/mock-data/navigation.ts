export interface NavItem {
  id: string;
  label: string;
  href: string;
  iconName: string;
  badge?: number;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    items: [
      { id: 'overview',   label: 'Overview',   href: '/',          iconName: 'grid' },
      { id: 'inventory',  label: 'Inventory',  href: '/inventory', iconName: 'box' },
      { id: 'orders',     label: 'Orders',     href: '/orders',    iconName: 'shopping-cart' },
      { id: 'analytics',  label: 'Analytics',  href: '/analytics', iconName: 'bar-chart' },
      { id: 'alerts',     label: 'Alerts',     href: '/alerts',    iconName: 'bell', badge: 3 },
    ],
  },
  {
    title: 'System',
    items: [
      { id: 'reports',  label: 'Reports',  href: '/reports',  iconName: 'file-text' },
      { id: 'settings', label: 'Settings', href: '/settings', iconName: 'settings' },
    ],
  },
];

export const workspaceName = 'Dodane HQ';
export const workspaceSubtitle = 'Inventory Suite';
