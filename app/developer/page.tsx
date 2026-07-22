import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { DeveloperPanel } from '@/components/developer/DeveloperPanel/DeveloperPanel';
import type { DeveloperUser, DeveloperSite, DeveloperProgram, DeveloperMaintenanceTask, DeveloperStockItem } from '@/components/developer/DeveloperPanel/DeveloperPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User, WashProgram, MaintenanceTask, ChemicalStock } from '@/lib/models';
import styles from './page.module.scss';

export default async function DeveloperPage() {
  await dbConnect();

  const [siteDocs, userDocs, programDocs, taskDocs, stockDocs] = await Promise.all([
    Site.find({}).select('_id name location').lean(),
    User.find({}).select('_id name email role site_ids whatsapp is_active').lean(),
    WashProgram.find({}).select('_id site_id name tier chemicals').lean(),
    MaintenanceTask.find({}).sort({ description: 1 }).lean(),
    ChemicalStock.find({}).select('_id site_id name unit').sort({ name: 1 }).lean(),
  ]);

  const sites: DeveloperSite[] = siteDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: (s.name as string) ?? '',
    location: (s.location as string) ?? '',
  }));

  const siteMap = Object.fromEntries(sites.map((s) => [s.id, s.name]));

  const users: DeveloperUser[] = userDocs.map((u) => {
    const siteIds = ((u.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
    return {
      id: (u._id as Types.ObjectId).toString(),
      name: (u.name as string) ?? '',
      email: (u.email as string) ?? '',
      role: (u.role as DeveloperUser['role']) ?? 'employee',
      siteIds,
      siteNames: siteIds.map((sid) => siteMap[sid] ?? '').filter(Boolean),
      whatsapp: (u.whatsapp as string) ?? '',
      is_active: (u.is_active as boolean) ?? true,
    };
  });

  const programs: DeveloperProgram[] = programDocs.map((p) => ({
    id: (p._id as Types.ObjectId).toString(),
    siteId: (p.site_id as Types.ObjectId).toString(),
    name: (p.name as string) ?? '',
    tier: (p.tier as number) ?? 0,
    chemicals: (p.chemicals as string[]) ?? [],
  }));

  const maintenanceTasks: DeveloperMaintenanceTask[] = taskDocs.map((t) => ({
    id: (t._id as Types.ObjectId).toString(),
    siteId: (t.site_id as Types.ObjectId).toString(),
    description: (t.description as string) ?? '',
    trigger_type: (t.trigger_type as DeveloperMaintenanceTask['trigger_type']) ?? 'months',
    trigger_value: (t.trigger_value as number) ?? 0,
    trigger_day: (t.trigger_day as number) ?? 0,
    trigger_month: (t.trigger_month as number) ?? 0,
    trigger_month_list: (t.trigger_month_list as number[]) ?? [],
    last_done_at: t.last_done_at ? (t.last_done_at as Date).toISOString().slice(0, 10) : undefined,
    washes_at_last_done: t.washes_at_last_done != null ? (t.washes_at_last_done as number) : undefined,
  }));

  const stockItems: DeveloperStockItem[] = stockDocs.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    siteId: (s.site_id as Types.ObjectId).toString(),
    name: (s.name as string) ?? '',
    unit: (s.unit as string) ?? 'L',
  }));

  return (
    <div className={styles.root}>
      <NavBar centerTitle="Developer" backHref="/" />
      <main className={styles.main}>
        <DeveloperPanel users={users} sites={sites} programs={programs} maintenanceTasks={maintenanceTasks} stockItems={stockItems} />
      </main>
    </div>
  );
}
