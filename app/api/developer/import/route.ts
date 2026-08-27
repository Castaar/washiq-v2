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

interface ImportPayload {
  meta?: { siteIds?: string[]; ownerEmail?: string; ownerName?: string; exportedAt?: string; formatVersion?: number };
  data?: Record<string, Record<string, unknown>[]>;
}

function isValidPayload(body: unknown): body is ImportPayload {
  if (!body || typeof body !== 'object') return false;
  const b = body as ImportPayload;
  return !!b.data && Array.isArray(b.data.sites) && !!b.meta && Array.isArray(b.meta.siteIds);
}

// POST /api/developer/import — restore a backup made by /api/developer/export
// body: { dryRun: boolean, payload: <export JSON> }
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { dryRun?: boolean; payload?: unknown } | null;
  if (!body || !isValidPayload(body.payload)) {
    return NextResponse.json({ error: 'Ongeldig back-up bestand' }, { status: 400 });
  }

  const { payload, dryRun = true } = body;
  const siteIds = (payload.meta?.siteIds ?? []).map(String);
  if (siteIds.length === 0) {
    return NextResponse.json({ error: 'Geen carwashes gevonden in dit bestand' }, { status: 400 });
  }

  await dbConnect();

  if (dryRun) {
    const currentCounts: Record<string, number> = {
      sites: await Site.countDocuments({ _id: { $in: siteIds } }),
      users: await User.countDocuments({ site_ids: { $in: siteIds } }),
      announcements: await Announcement.countDocuments({ site_ids: { $in: siteIds } }),
      pushSubscriptions: await PushSubscription.countDocuments({ site_ids: { $in: siteIds } }),
    };
    for (const { key, model } of SITE_SCOPED_MODELS) {
      currentCounts[key] = await model.countDocuments({ site_id: { $in: siteIds } });
    }

    const importCounts = Object.fromEntries(
      Object.entries(payload.data ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
    );

    return NextResponse.json({
      ok: true,
      preview: true,
      meta: payload.meta,
      currentCounts,
      importCounts,
    });
  }

  // ── Actual restore: wipe existing data for these sites, reinsert the snapshot ──
  const data = payload.data ?? {};
  const userIds = (data.users ?? []).map((u) => String(u._id));

  await Site.deleteMany({ _id: { $in: siteIds } });
  if (data.sites?.length) await Site.insertMany(data.sites, { ordered: false });

  await User.deleteMany({ site_ids: { $in: siteIds } });
  if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
  if (data.users?.length) await User.insertMany(data.users, { ordered: false });

  await Announcement.deleteMany({ site_ids: { $in: siteIds } });
  if (data.announcements?.length) await Announcement.insertMany(data.announcements, { ordered: false });

  await PushSubscription.deleteMany({ $or: [{ user_id: { $in: userIds } }, { site_ids: { $in: siteIds } }] });
  if (data.pushSubscriptions?.length) await PushSubscription.insertMany(data.pushSubscriptions, { ordered: false });

  for (const { key, model } of SITE_SCOPED_MODELS) {
    await model.deleteMany({ site_id: { $in: siteIds } });
    const docs = data[key];
    if (docs?.length) await model.insertMany(docs, { ordered: false });
  }

  return NextResponse.json({ ok: true, restored: true, siteIds });
}
