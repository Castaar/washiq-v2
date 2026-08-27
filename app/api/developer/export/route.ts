import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { getSessionFromRequest } from '@/lib/session';
import {
  Site, User, PriceConfig, WashProgram, WeeklyEntry, ChemicalStock, StockDelivery,
  MaintenanceTask, MaintenanceLog, DailyChecklist, IncidentSchade, IncidentEhbo, Defect,
  ActivityLog, EnergyBill, AttendanceLog, Opdracht, Planning, Announcement, PushSubscription,
} from '@/lib/models';

const SITE_SCOPED_MODELS = [
  { key: 'priceConfigs', model: PriceConfig },
  { key: 'washPrograms', model: WashProgram },
  { key: 'weeklyEntries', model: WeeklyEntry },
  { key: 'chemicalStocks', model: ChemicalStock },
  { key: 'stockDeliveries', model: StockDelivery },
  { key: 'maintenanceTasks', model: MaintenanceTask },
  { key: 'maintenanceLogs', model: MaintenanceLog },
  { key: 'dailyChecklists', model: DailyChecklist },
  { key: 'incidentSchades', model: IncidentSchade },
  { key: 'incidentEhbos', model: IncidentEhbo },
  { key: 'defects', model: Defect },
  { key: 'activityLogs', model: ActivityLog },
  { key: 'energyBills', model: EnergyBill },
  { key: 'attendanceLogs', model: AttendanceLog },
  { key: 'opdrachts', model: Opdracht },
  { key: 'plannings', model: Planning },
] as const;

// GET /api/developer/export?ownerId=... — full backup of an owner's carwashes
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ownerId = req.nextUrl.searchParams.get('ownerId');
  if (!ownerId) return NextResponse.json({ error: 'ownerId is required' }, { status: 400 });

  await dbConnect();

  const owner = await User.findById(ownerId).lean();
  if (!owner) return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 });

  const siteIds = ((owner.site_ids as unknown[]) ?? []).map((id) => String(id));
  if (siteIds.length === 0) {
    return NextResponse.json({ error: 'Deze gebruiker heeft geen carwashes gekoppeld' }, { status: 400 });
  }

  const sites = await Site.find({ _id: { $in: siteIds } }).lean();
  const users = await User.find({ $or: [{ site_ids: { $in: siteIds } }, { _id: ownerId }] }).lean();
  const userIds = users.map((u) => String(u._id));
  const announcements = await Announcement.find({ site_ids: { $in: siteIds } }).lean();
  const pushSubscriptions = await PushSubscription.find({
    $or: [{ user_id: { $in: userIds } }, { site_ids: { $in: siteIds } }],
  }).lean();

  const data: Record<string, unknown[]> = {
    sites,
    users,
    announcements,
    pushSubscriptions,
  };

  for (const { key, model } of SITE_SCOPED_MODELS) {
    data[key] = await model.find({ site_id: { $in: siteIds } }).lean();
  }

  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));

  const payload = {
    meta: {
      exportedAt: new Date().toISOString(),
      ownerId,
      ownerEmail: (owner.email as string) ?? '',
      ownerName: (owner.name as string) ?? '',
      siteIds,
      siteNames: sites.map((s) => (s.name as string) ?? ''),
      counts,
      formatVersion: 1,
    },
    data,
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `washiq-backup-${(owner.name as string || 'owner').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
