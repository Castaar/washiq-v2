import mongoose, { Schema, model, models, Document, Types } from 'mongoose';

// ─── Site ─────────────────────────────────────────────────────
export interface ISite extends Document {
  name: string;
  location: string;
  owner_id: Types.ObjectId;
  start_car_count: number;
  start_car_count_date?: Date;
  setup_done: boolean;
  created_at: Date;
}
const SiteSchema = new Schema<ISite>({
  name: String,
  location: String,
  owner_id: { type: Schema.Types.ObjectId, ref: 'User' },
  start_car_count: { type: Number, default: 0 },
  start_car_count_date: { type: Date },
  setup_done: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});
export const Site = models.Site || model<ISite>('Site', SiteSchema);

// ─── User ─────────────────────────────────────────────────────
export interface IUser extends Document {
  name: string;
  email: string;
  password_hash: string;
  role: 'developer' | 'owner' | 'employee' | 'technician';
  site_ids: Types.ObjectId[];
  help_seen: boolean;
  whatsapp: string;
  birthday: string;
  is_active: boolean;
  created_at: Date;
}
const UserSchema = new Schema<IUser>({
  name: String,
  email: String,
  password_hash: String,
  role: { type: String, enum: ['developer', 'owner', 'employee', 'technician'], default: 'employee' },
  site_ids: [{ type: Schema.Types.ObjectId, ref: 'Site' }],
  help_seen: { type: Boolean, default: false },
  whatsapp: { type: String, default: '' },
  birthday: { type: String, default: '' }, // MM-DD, no year needed
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});
export const User = models.User || model<IUser>('User', UserSchema);

// ─── PriceConfig ──────────────────────────────────────────────
export interface IPriceConfig extends Document {
  site_id: Types.ObjectId;
  water_per_liter: number;
  energy_per_kw: number;
  salt_per_kg: number;
  flock_per_kg: number;
  cloth_per_unit: number;
  chemicals: { name: string; price_per_unit: number }[];
  valid_from: Date;
}
const PriceConfigSchema = new Schema<IPriceConfig>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  water_per_liter: Number,
  energy_per_kw: Number,
  salt_per_kg: Number,
  flock_per_kg: Number,
  cloth_per_unit: { type: Number, default: 0 },
  chemicals: [{ name: String, price_per_unit: Number }],
  valid_from: Date,
});
export const PriceConfig = models.PriceConfig || model<IPriceConfig>('PriceConfig', PriceConfigSchema);

// ─── WashProgram ──────────────────────────────────────────────
export interface IWashProgram extends Document {
  site_id: Types.ObjectId;
  name: string;
  tier: number;
  chemicals: string[];
  chemical_ids: Types.ObjectId[];
  includes_cloth: boolean;
  cloth_cost: number;
}
const WashProgramSchema = new Schema<IWashProgram>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  name: String,
  tier: Number,
  chemicals: [String],
  chemical_ids: [Schema.Types.ObjectId],
  includes_cloth: Boolean,
  cloth_cost: Number,
});
export const WashProgram = models.WashProgram || model<IWashProgram>('WashProgram', WashProgramSchema);

// ─── WeeklyEntry ──────────────────────────────────────────────
export interface IWeeklyEntry extends Document {
  site_id: Types.ObjectId;
  user_id: Types.ObjectId;
  week_start: Date;
  tellerstand: number;
  water_liters: number;
  water_tellerstand: number;
  energy_kw: number;
  salt_kg: number;
  flock_kg: number;
  cloth_units: number;
  blob_liters: number;
  program_counts: { program_id: Types.ObjectId; name: string; count: number }[];
  chemical_usages: { chemical_id: string; name: string; amount: number; unit: string }[];
  total_cost: number;
  created_at: Date;
}
const WeeklyEntrySchema = new Schema<IWeeklyEntry>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  user_id: { type: Schema.Types.ObjectId, ref: 'User' },
  week_start: Date,
  tellerstand: { type: Number, default: 0 },
  water_liters: Number,
  water_tellerstand: { type: Number, default: 0 },
  energy_kw: Number,
  salt_kg: Number,
  flock_kg: Number,
  cloth_units: { type: Number, default: 0 },
  blob_liters: { type: Number, default: 0 },
  program_counts: [{ program_id: Schema.Types.ObjectId, name: String, count: Number }],
  chemical_usages: [{ chemical_id: String, name: String, amount: Number, unit: String }],
  total_cost: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
});
// Force re-registration in development so schema changes take effect after hot reload
if (process.env.NODE_ENV === 'development' && models.WeeklyEntry) {
  mongoose.deleteModel('WeeklyEntry');
}
export const WeeklyEntry = models.WeeklyEntry || model<IWeeklyEntry>('WeeklyEntry', WeeklyEntrySchema);

// ─── ChemicalStock ────────────────────────────────────────────
export interface IChemicalStock extends Document {
  site_id: Types.ObjectId;
  name: string;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
  last_updated: Date;
}
const ChemicalStockSchema = new Schema<IChemicalStock>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  name: String,
  current_stock: Number,
  min_stock_alert: Number,
  unit: String,
  last_updated: { type: Date, default: Date.now },
});
export const ChemicalStock = models.ChemicalStock || model<IChemicalStock>('ChemicalStock', ChemicalStockSchema);

// ─── StockDelivery ────────────────────────────────────────────
export interface IStockDelivery extends Document {
  site_id: Types.ObjectId;
  chemical_id: Types.ObjectId;
  quantity: number;
  unit_price: number;
  delivered_at: Date;
  logged_by: Types.ObjectId;
}
const StockDeliverySchema = new Schema<IStockDelivery>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  chemical_id: { type: Schema.Types.ObjectId, ref: 'ChemicalStock' },
  quantity: Number,
  unit_price: Number,
  delivered_at: Date,
  logged_by: { type: Schema.Types.ObjectId, ref: 'User' },
});
export const StockDelivery = models.StockDelivery || model<IStockDelivery>('StockDelivery', StockDeliverySchema);

// ─── MaintenanceTask ──────────────────────────────────────────
export interface IMaintenanceTask extends Document {
  site_id: Types.ObjectId;
  description: string;
  // washes: every X washes | months: every X months (12=yearly, 24=biennial)
  // fixed_date: annually on trigger_day/trigger_month | fixed_months: list of months per year
  trigger_type: 'washes' | 'months' | 'fixed_date' | 'fixed_months';
  trigger_value: number;          // washes: interval count; months: month count
  trigger_day: number;            // fixed_date: day of month (1-31)
  trigger_month: number;          // fixed_date: month (1-12)
  trigger_month_list: number[];   // fixed_months: e.g. [4, 11]
  last_done_at: Date;
  washes_at_last_done: number;
  is_overdue: boolean;
}
const MaintenanceTaskSchema = new Schema<IMaintenanceTask>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  description: String,
  trigger_type: { type: String, enum: ['washes', 'months', 'fixed_date', 'fixed_months'], default: 'months' },
  trigger_value: { type: Number, default: 0 },
  trigger_day: { type: Number, default: 0 },
  trigger_month: { type: Number, default: 0 },
  trigger_month_list: [{ type: Number }],
  last_done_at: Date,
  washes_at_last_done: { type: Number, default: 0 },
  is_overdue: Boolean,
});
export const MaintenanceTask = models.MaintenanceTask || model<IMaintenanceTask>('MaintenanceTask', MaintenanceTaskSchema);

// ─── MaintenanceLog ───────────────────────────────────────────
export interface IMaintenanceLog extends Document {
  task_id: Types.ObjectId;
  site_id: Types.ObjectId;
  done_by: Types.ObjectId;
  done_at: Date;
  notes: string;
}
const MaintenanceLogSchema = new Schema<IMaintenanceLog>({
  task_id: { type: Schema.Types.ObjectId, ref: 'MaintenanceTask' },
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  done_by: { type: Schema.Types.ObjectId, ref: 'User' },
  done_at: Date,
  notes: String,
});
export const MaintenanceLog = models.MaintenanceLog || model<IMaintenanceLog>('MaintenanceLog', MaintenanceLogSchema);

// ─── DailyChecklist ───────────────────────────────────────────
export interface IDailyChecklist extends Document {
  site_id: Types.ObjectId;
  user_id: Types.ObjectId;
  date: Date;
  items: { label: string; checked: boolean }[];
  defect_note: string;
  damage_report: Record<string, unknown>;
  submitted_at: Date;
}
const DailyChecklistSchema = new Schema<IDailyChecklist>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  user_id: { type: Schema.Types.ObjectId, ref: 'User' },
  date: Date,
  items: [{ label: String, checked: Boolean, opmerking: String }],
  defect_note: String,
  damage_report: Schema.Types.Mixed,
  submitted_at: Date,
});
export const DailyChecklist = models.DailyChecklist || model<IDailyChecklist>('DailyChecklist', DailyChecklistSchema);

// ─── IncidentSchade ───────────────────────────────────────────
export interface IIncidentSchade extends Document {
  site_id: Types.ObjectId;
  reported_by: Types.ObjectId;
  reported_by_name: string;
  type_voertuig: string;
  merk_model: string;
  nummerplaat: string;
  datum_uur: Date;
  naam_eigenaar: string;
  tel_gsm: string;
  email: string;
  omschrijving: string;
  schade_locaties: string[];
  onbetwist: boolean;
  installatiefout: boolean;
  klant_verantwoordelijk: boolean;
  verzekeringsdocumenten: boolean;
  is_resolved: boolean;
  resolved_at: Date;
  resolved_by_name: string;
  photos: string[];
  created_at: Date;
}
const IncidentSchadeSchema = new Schema<IIncidentSchade>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  reported_by: { type: Schema.Types.ObjectId, ref: 'User' },
  reported_by_name: String,
  type_voertuig: String,
  merk_model: String,
  nummerplaat: String,
  datum_uur: Date,
  naam_eigenaar: String,
  tel_gsm: String,
  email: String,
  omschrijving: String,
  schade_locaties: { type: [String], default: [] },
  onbetwist: Boolean,
  installatiefout: Boolean,
  klant_verantwoordelijk: Boolean,
  verzekeringsdocumenten: Boolean,
  is_resolved: { type: Boolean, default: false },
  resolved_at: Date,
  resolved_by_name: { type: String, default: '' },
  photos: { type: [String], default: [] },
  created_at: { type: Date, default: Date.now },
});
export const IncidentSchade = models.IncidentSchade || model<IIncidentSchade>('IncidentSchade', IncidentSchadeSchema);

// ─── IncidentEhbo ─────────────────────────────────────────────
export interface IIncidentEhbo extends Document {
  site_id: Types.ObjectId;
  reported_by: Types.ObjectId;
  reported_by_name: string;
  datum: Date;
  uur: string;
  naam_slachtoffer: string;
  afdeling_locatie: string;
  verwonding: string;
  ehbo_handeling: string;
  ehbo_verlener: string;
  beschrijving: string;
  dokter_nodig: boolean;
  photos: string[];
  created_at: Date;
}
const IncidentEhboSchema = new Schema<IIncidentEhbo>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  reported_by: { type: Schema.Types.ObjectId, ref: 'User' },
  reported_by_name: String,
  datum: Date,
  uur: String,
  naam_slachtoffer: String,
  afdeling_locatie: String,
  verwonding: String,
  ehbo_handeling: String,
  ehbo_verlener: String,
  beschrijving: String,
  dokter_nodig: Boolean,
  photos: { type: [String], default: [] },
  created_at: { type: Date, default: Date.now },
});
export const IncidentEhbo = models.IncidentEhbo || model<IIncidentEhbo>('IncidentEhbo', IncidentEhboSchema);

// ─── Defect ───────────────────────────────────────────────────
export interface IDefect extends Document {
  site_id: Types.ObjectId;
  reported_by: Types.ObjectId;
  reported_by_name: string;
  omschrijving: string;
  ernst: 'laag' | 'medium' | 'hoog';
  is_resolved: boolean;
  resolved_at: Date;
  resolved_by_name: string;
  resolve_note: string;
  assigned_to_name: string;
  photos: string[];
  created_at: Date;
}
const DefectSchema = new Schema<IDefect>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  reported_by: { type: Schema.Types.ObjectId, ref: 'User' },
  reported_by_name: String,
  omschrijving: String,
  ernst: { type: String, enum: ['laag', 'medium', 'hoog'], default: 'medium' },
  is_resolved: { type: Boolean, default: false },
  resolved_at: Date,
  resolved_by_name: { type: String, default: '' },
  resolve_note: { type: String, default: '' },
  assigned_to_name: { type: String, default: '' },
  photos: { type: [String], default: [] },
  created_at: { type: Date, default: Date.now },
});
export const Defect = models.Defect || model<IDefect>('Defect', DefectSchema);

// ─── PushSubscription ─────────────────────────────────────────
export interface IPushSubscription extends Document {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_id: Types.ObjectId;
  site_ids: Types.ObjectId[];
  created_at: Date;
}
const PushSubscriptionSchema = new Schema<IPushSubscription>({
  endpoint: { type: String, required: true, unique: true },
  keys: { p256dh: String, auth: String },
  user_id: { type: Schema.Types.ObjectId, ref: 'User' },
  site_ids: [{ type: Schema.Types.ObjectId, ref: 'Site' }],
  created_at: { type: Date, default: Date.now },
});
export const PushSubscription = models.PushSubscription || model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);

// ─── ActivityLog ──────────────────────────────────────────────
export type ActivityRefType =
  | 'maintenance_task'
  | 'daily_checklist'
  | 'incident_schade'
  | 'incident_ehbo'
  | 'defect'
  | 'maintenance_log';

export type ActivityActionType = 'comment' | 'completed' | 'created' | 'updated';

export interface IActivityLog extends Document {
  ref_id: Types.ObjectId;
  ref_type: ActivityRefType;
  site_id: Types.ObjectId;
  action_type: ActivityActionType;
  text: string;
  performed_by: Types.ObjectId | null;
  performed_by_name: string;
  created_at: Date;
}
const ActivityLogSchema = new Schema<IActivityLog>({
  ref_id: { type: Schema.Types.ObjectId, required: true, index: true },
  ref_type: {
    type: String,
    enum: ['maintenance_task', 'daily_checklist', 'incident_schade', 'incident_ehbo', 'defect', 'maintenance_log'],
    required: true,
  },
  site_id: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
  action_type: {
    type: String,
    enum: ['comment', 'completed', 'created', 'updated'],
    default: 'comment',
  },
  text: { type: String, required: true },
  performed_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  performed_by_name: { type: String, default: '' },
  created_at: { type: Date, default: Date.now },
});
export const ActivityLog = models.ActivityLog || model<IActivityLog>('ActivityLog', ActivityLogSchema);

// ─── EnergyBill ───────────────────────────────────────────────
export interface IEnergyBill extends Document {
  site_id: Types.ObjectId;
  year: number;
  month: number; // 1–12
  amount_euro: number;
  created_at: Date;
}
const EnergyBillSchema = new Schema<IEnergyBill>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site' },
  year: Number,
  month: Number,
  amount_euro: Number,
  created_at: { type: Date, default: Date.now },
});
export const EnergyBill = models.EnergyBill || model<IEnergyBill>('EnergyBill', EnergyBillSchema);

// ─── AttendanceLog ────────────────────────────────────────────
export interface IAttendanceLog extends Document {
  site_id: Types.ObjectId;
  user_id: Types.ObjectId;
  user_name: string;
  type: 'opening' | 'sluiting';
  person_type: 'employee' | 'technician_extern';
  registered_by_name: string;
  timestamp: Date;
  note: string;
}
const AttendanceLogSchema = new Schema<IAttendanceLog>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  user_name: String,
  type: { type: String, enum: ['opening', 'sluiting'], required: true },
  person_type: { type: String, enum: ['employee', 'technician_extern'], default: 'employee' },
  registered_by_name: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  note: { type: String, default: '' },
});
export const AttendanceLog = models.AttendanceLog || model<IAttendanceLog>('AttendanceLog', AttendanceLogSchema);

// ─── Opdracht ─────────────────────────────────────────────────
export interface IOpdracht extends Document {
  site_id: Types.ObjectId;
  date: Date;
  text: string;
  created_by: Types.ObjectId;
  created_by_name: string;
  assigned_to_ids: Types.ObjectId[];
  is_done: boolean;
  done_by_name: string;
  done_at: Date;
  created_at: Date;
}
const OpdrachtSchema = new Schema<IOpdracht>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
  date: { type: Date, required: true },
  text: { type: String, required: true },
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  created_by_name: { type: String, default: '' },
  assigned_to_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  is_done: { type: Boolean, default: false },
  done_by_name: { type: String, default: '' },
  done_at: Date,
  created_at: { type: Date, default: Date.now },
});
export const Opdracht = models.Opdracht || model<IOpdracht>('Opdracht', OpdrachtSchema);

// ─── Planning ─────────────────────────────────────────────────
export interface IPlanning extends Document {
  site_id: Types.ObjectId;
  user_id: Types.ObjectId;
  user_name: string;
  date: Date;
  start_time: string;
  end_time: string;
  note: string;
  created_by: Types.ObjectId;
  created_at: Date;
}
const PlanningSchema = new Schema<IPlanning>({
  site_id: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  user_name: { type: String, default: '' },
  date: { type: Date, required: true },
  start_time: { type: String, default: '' },
  end_time: { type: String, default: '' },
  note: { type: String, default: '' },
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now },
});
export const Planning = models.Planning || model<IPlanning>('Planning', PlanningSchema);

// ─── Announcement ─────────────────────────────────────────────
export interface IAnnouncement extends Document {
  text: string;
  kind: 'general' | 'birthday';
  created_by_name: string;
  is_all_sites: boolean;
  site_ids: Types.ObjectId[];
  created_at: Date;
}
const AnnouncementSchema = new Schema<IAnnouncement>({
  text: { type: String, required: true },
  kind: { type: String, enum: ['general', 'birthday'], default: 'general' },
  created_by_name: { type: String, default: '' },
  is_all_sites: { type: Boolean, default: true },
  site_ids: [{ type: Schema.Types.ObjectId, ref: 'Site' }],
  created_at: { type: Date, default: Date.now },
});
export const Announcement = models.Announcement || model<IAnnouncement>('Announcement', AnnouncementSchema);
