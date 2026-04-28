export type ActivityRefType =
  | 'maintenance_task'
  | 'daily_checklist'
  | 'incident_schade'
  | 'incident_ehbo'
  | 'defect'
  | 'maintenance_log';

export interface ActivityEntry {
  id: string;
  actionType: 'comment' | 'completed' | 'created' | 'updated';
  text: string;
  performedByName: string;
  createdAt: string;
}

export interface DagfichePayload {
  type: 'dagfiche';
  submittedBy: string;
  submittedAt: string;
  items: { label: string; checked: boolean; opmerking?: string }[];
  defectNote?: string;
}

export interface IncidentSchadePayload {
  type: 'schade';
  reportedBy: string;
  date: string;
  typeVoertuig: string;
  merkModel: string;
  nummerplaat: string;
  naamEigenaar: string;
  telGsm: string;
  email: string;
  omschrijving: string;
  onbetwist: boolean;
  installatiefout: boolean;
  klantVerantwoordelijk: boolean;
  verzekeringsdocumenten: boolean;
}

export interface IncidentEhboPayload {
  type: 'ehbo';
  reportedBy: string;
  date: string;
  uur: string;
  naamSlachtoffer: string;
  afdelingLocatie: string;
  verwonding: string;
  ehboHandeling: string;
  ehboVerlener: string;
  beschrijving: string;
  dokterNodig: boolean;
}

export interface DefectPayload {
  type: 'defect';
  reportedBy: string;
  date: string;
  omschrijving: string;
  ernst: string;
}

export type IncidentPayload = IncidentSchadePayload | IncidentEhboPayload | DefectPayload;

export interface AlertItem {
  id: string;
  refId?: string;       // MongoDB _id for activity API; falls back to id when absent
  title: string;
  severity: 'low' | 'medium' | 'high';
  iconName: string;
  date?: string;
  subtitle?: string;
  payload?: DagfichePayload | IncidentPayload;
  refType?: ActivityRefType;
  siteId?: string;
}

export interface AlertsPanelData {
  alerts: AlertItem[];
  onderhoud: AlertItem[];
  incident: AlertItem[];
}

export interface VoorraadItem {
  id: string;
  name: string;
  current: number;
  max: number;
  unit: string;
}

export interface ChemieRow {
  id: string;
  label: string;
  value: number;
  delta: number;
}

export interface ConsumptionData {
  label: string;
  value: number;
  delta: number;
  prefix?: string;
  suffix?: string;
  lowerIsBetter?: boolean;
}

export interface WagensData {
  count: number;
  delta: number;
}
