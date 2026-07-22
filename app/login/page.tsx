import type { Types } from 'mongoose';
import { dbConnect } from '@/lib/db/mongoose';
import { Site } from '@/lib/models';
import { LoginForm } from '@/components/auth/LoginForm/LoginForm';
import styles from './page.module.scss';

export default async function LoginPage() {
  await dbConnect();
  const sites = await Site.find({}).select('_id name').lean();
  const siteList = sites.map((s) => ({
    id: (s._id as Types.ObjectId).toString(),
    name: (s.name as string) ?? '',
  }));

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <LoginForm sites={siteList} />
      </main>
    </div>
  );
}
