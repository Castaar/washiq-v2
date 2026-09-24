import { cookies } from 'next/headers';
import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { DiversenPanel } from '@/components/diversen/DiversenPanel/DiversenPanel';
import type { BirthdayPerson, AnnouncementItem } from '@/components/diversen/DiversenPanel/DiversenPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { Site, User, Announcement } from '@/lib/models';
import { getSession } from '@/lib/session';
import { filterSitesForUser, resolveActiveSite, redirectIfSetupNeeded, redirectWithSiteParam } from '@/lib/getUserSites';
import styles from './page.module.scss';

export default async function DiversenPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site } = await searchParams;
  const session = await getSession();
  await dbConnect();

  const cookieStore = await cookies();
  const cookieSite = cookieStore.get('dodane_active_site')?.value;

  const [siteDocs, userDoc] = await Promise.all([
    Site.find({}).select('_id name location site_type').lean(),
    session ? User.findById(session.userId).select('site_ids role').lean() : null,
  ]);

  const userRole = (userDoc?.role as string) ?? session?.role ?? 'employee';
  const userSiteIds = ((userDoc?.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());
  const allowedSites = filterSitesForUser(siteDocs as Parameters<typeof filterSitesForUser>[0], userSiteIds, userRole);
  const siteId = resolveActiveSite(allowedSites, site ?? cookieSite) || null;
  await redirectIfSetupNeeded(siteId ?? '', userRole);
  redirectWithSiteParam('/diversen', { site }, siteId ?? '');
  const siteName = allowedSites.find((s) => s.id === siteId)?.name ?? '';

  const [users, announcementDocs] = await Promise.all([
    User.find({ is_active: true, birthday: { $ne: '' } }).select('_id name birthday').lean(),
    // Berichten voor alle filialen, plus berichten specifiek voor de actieve site.
    Announcement.find(siteId ? { $or: [{ is_all_sites: true }, { site_ids: siteId }] } : { is_all_sites: true })
      .sort({ created_at: -1 }).limit(20).lean(),
  ]);

  const today = new Date();
  const todayMD = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

  const birthdays: BirthdayPerson[] = users
    .filter((u) => u._id.toString() !== session?.userId)
    .map((u) => {
      const bday = (u.birthday as string) ?? '';
      const md = bday.length >= 5 ? bday.slice(5, 10) : '';
      return { id: (u._id as Types.ObjectId).toString(), name: u.name as string, isToday: md === todayMD };
    })
    .filter((b) => b.isToday);

  const announcements: AnnouncementItem[] = announcementDocs.map((a) => ({
    id: (a._id as Types.ObjectId).toString(),
    text: a.text as string,
    text_fr: (a.text_fr as string) ?? '',
    kind: (a.kind as string) === 'birthday' ? 'birthday' : 'general',
    created_by_name: (a.created_by_name as string) ?? '',
    created_at: (a.created_at as Date).toISOString(),
    isAllSites: Boolean(a.is_all_sites),
  }));

  const canPostGeneral = session?.role === 'owner' || session?.role === 'developer';

  return (
    <div className={styles.root}>
      <NavBar sites={allowedSites} activeSiteId={siteId ?? ''} backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
          <DiversenPanel
            birthdays={birthdays}
            announcements={announcements}
            canPostGeneral={canPostGeneral}
            siteId={siteId ?? ''}
            siteName={siteName}
          />
        </div>
      </main>
    </div>
  );
}
