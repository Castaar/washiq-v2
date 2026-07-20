import Image from 'next/image';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { TechniekerPanel } from '@/components/technieker/TechniekerPanel/TechniekerPanel';
import type { TechniekerItem } from '@/components/technieker/TechniekerPanel/TechniekerPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User, Defect, IncidentSchade, MaintenanceTask, WeeklyEntry } from '@/lib/models';
import { getSession } from '@/lib/session';
import { computeIsOverdue } from '@/lib/maintenance';
import styles from './page.module.scss';

function fmtDate(d: Date) {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export default async function TechniekerPage() {
  const session = await getSession();
  await dbConnect();

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = (userRole === 'developer' || userRole === 'technician')
    ? siteDocs
    : siteDocs.filter((s) => userSiteIds.includes((s._id as Types.ObjectId).toString()));

  const siteIds = allowedSites.map((s) => (s._id as Types.ObjectId).toString());
  const siteNameById = Object.fromEntries(
    allowedSites.map((s) => [(s._id as Types.ObjectId).toString(), s.name as string]),
  );

  const [defects, schades, tasks, latestEntries, techUsers] = await Promise.all([
    Defect.find({
      site_id: { $in: siteIds },
      $or: [{ is_resolved: false }, { is_resolved: { $exists: false } }],
    }).sort({ created_at: -1 }).lean(),
    IncidentSchade.find({
      site_id: { $in: siteIds },
      $or: [{ is_resolved: false }, { is_resolved: { $exists: false } }],
    }).sort({ created_at: -1 }).lean(),
    MaintenanceTask.find({ site_id: { $in: siteIds } }).lean(),
    Promise.all(
      siteIds.map((sId) => WeeklyEntry.findOne({ site_id: sId }).sort({ week_start: -1 }).select('tellerstand').lean()),
    ),
    User.find({ site_ids: { $in: siteIds }, role: { $in: ['employee', 'technician'] } }).select('_id name').lean(),
  ]);

  const tellerstandBySite: Record<string, number> = {};
  siteIds.forEach((sId, i) => {
    tellerstandBySite[sId] = (latestEntries[i] as { tellerstand?: number } | null)?.tellerstand ?? 0;
  });

  const now = new Date();

  const items: TechniekerItem[] = [
    ...defects.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      kind: 'defect' as const,
      siteId: (d.site_id as Types.ObjectId).toString(),
      siteName: siteNameById[(d.site_id as Types.ObjectId).toString()] ?? '',
      title: (d.omschrijving as string) || 'Defect',
      subtitle: '',
      severity: ((d.ernst as string) === 'hoog' ? 'high' : (d.ernst as string) === 'laag' ? 'low' : 'medium') as 'low' | 'medium' | 'high',
      date: fmtDate(new Date(d.created_at as Date)),
      assignedToName: (d.assigned_to_name as string) || undefined,
    })),
    ...schades.map((s) => ({
      id: (s._id as Types.ObjectId).toString(),
      kind: 'schade' as const,
      siteId: (s.site_id as Types.ObjectId).toString(),
      siteName: siteNameById[(s.site_id as Types.ObjectId).toString()] ?? '',
      title: (s.merk_model as string) || (s.naam_eigenaar as string) || 'Schade',
      subtitle: ((s.schade_locaties as string[]) ?? []).join(', '),
      severity: 'high' as const,
      date: fmtDate(new Date(s.created_at as Date)),
    })),
    ...tasks
      .filter((t) => computeIsOverdue(t, now, tellerstandBySite[(t.site_id as Types.ObjectId).toString()] || undefined))
      .map((t) => ({
        id: (t._id as Types.ObjectId).toString(),
        kind: 'maintenance' as const,
        siteId: (t.site_id as Types.ObjectId).toString(),
        siteName: siteNameById[(t.site_id as Types.ObjectId).toString()] ?? '',
        title: t.description as string,
        subtitle: '',
        severity: 'medium' as const,
        date: '',
      })),
  ].sort((a, b) => a.siteName.localeCompare(b.siteName));

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden="true">
        <Image src="/background.png" alt="" fill style={{ objectFit: 'cover' }} priority />
      </div>
      <NavBar centerTitle="Technieker" />
      <main className={styles.main}>
        <div className={styles.content}>
          <TechniekerPanel
            items={items}
            userRole={userRole}
            allowedSites={allowedSites.map((s) => ({ id: (s._id as Types.ObjectId).toString(), name: s.name as string }))}
            availableUsers={(techUsers as { _id: Types.ObjectId; name: string }[]).map((u) => ({ id: u._id.toString(), name: u.name }))}
          />
        </div>
      </main>
    </div>
  );
}
