import type { Types } from 'mongoose';
import { NavBar } from '@/components/layout/NavBar/NavBar';
import { DiversenPanel } from '@/components/diversen/DiversenPanel/DiversenPanel';
import type { BirthdayPerson, AnnouncementItem } from '@/components/diversen/DiversenPanel/DiversenPanel';
import { dbConnect } from '@/lib/db/mongoose';
import { User, Announcement } from '@/lib/models';
import { getSession } from '@/lib/session';
import styles from './page.module.scss';

export default async function DiversenPage() {
  const session = await getSession();
  await dbConnect();

  const [users, announcementDocs] = await Promise.all([
    User.find({ is_active: true, birthday: { $ne: '' } }).select('_id name birthday').lean(),
    Announcement.find({}).sort({ created_at: -1 }).limit(20).lean(),
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
  }));

  const canPostGeneral = session?.role === 'owner' || session?.role === 'developer';

  return (
    <div className={styles.root}>
      <NavBar centerTitle="Diversen" backHref="/" />
      <main className={styles.main}>
        <div className={styles.content}>
          <DiversenPanel
            birthdays={birthdays}
            announcements={announcements}
            canPostGeneral={canPostGeneral}
          />
        </div>
      </main>
    </div>
  );
}
