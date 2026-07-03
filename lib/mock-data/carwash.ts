// ─── Location / type ─────────────────────────────────────────
export const carwashMeta = {
  type: 'Carwash',
  location: 'Sint-Pieters-Leeuw',
};

// ─── Program selector ────────────────────────────────────────
export const programs = ['Wash & Go', 'Express', 'Premium', 'Full Service'] as const;
export type Program = (typeof programs)[number];
export const activeProgram: Program = 'Wash & Go';

// ─── Chemie rows inside ProgrammaCard ────────────────────────
export interface ChemieRow {
  id: string;
  label: string;
  value: number;
  delta: number;
}

export const chemieRows: ChemieRow[] = [
  { id: 'chemie-a', label: 'Chemie A', value: 284, delta: -20 },
  { id: 'chemie-b', label: 'Chemie B', value: 392, delta: 54  },
];

// ─── Generic consumption card data ───────────────────────────
export interface ConsumptionData {
  id: string;
  label: string;
  value: number;
  delta: number;
  prefix?: string;
}

export const zoutData: ConsumptionData    = { id: 'zout',    label: 'Zoutverbruik',    value: 284, delta: -20, prefix: '€' };
export const flocData: ConsumptionData    = { id: 'flock',   label: 'Flockmiddel',     value: 321, delta:   8, prefix: '€' };
export const waterData: ConsumptionData   = { id: 'water',   label: 'Waterverbruik',   value: 284, delta: -20, prefix: '€' };
export const energieData: ConsumptionData = { id: 'energie', label: 'Energieverbruik', value: 321, delta:   8, prefix: '€' };

// ─── Wagens ──────────────────────────────────────────────────
export const wagensData = { count: 846, delta: 8 };

// ─── Ranking ─────────────────────────────────────────────────
export const rankingData = { position: 1, delta: 1 };

// ─── Alerts panel ────────────────────────────────────────────
export type AlertSeverity = 'medium' | 'high' | 'low';
export type AlertTab = 'alerts' | 'onderhoud' | 'incident';

export interface CarwashAlert {
  id: string;
  title: string;
  severity: AlertSeverity;
  iconName: string;
}

export const alertsData: Record<AlertTab, CarwashAlert[]> = {
  alerts: [
    { id: 'a1', title: 'Controle: Textiel borstels niet nagekeken.', severity: 'medium', iconName: 'search'          },
    { id: 'a2', title: 'Lage voorraad chemie A',                     severity: 'high',   iconName: 'alert-triangle'  },
    { id: 'a3', title: 'Nieuwe maandelijkse ingave',                   severity: 'low',    iconName: 'alert-triangle'  },
  ],
  onderhoud: [],
  incident:  [],
};

export const alertTabLabels: Record<AlertTab, string> = {
  alerts:    'Alerts',
  onderhoud: 'Onderhoud',
  incident:  'Incident',
};

// ─── Voorraad ────────────────────────────────────────────────
export interface VoorraadItem {
  id: string;
  label: string;
  current: number;
  max: number;
  unit: string;
}

export const voorraadItems: VoorraadItem[] = [
  { id: 'v1', label: 'Chemie A - Shampoo', current: 145, max: 180, unit: 'L' },
];
