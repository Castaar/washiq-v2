import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { User } from '@/lib/models';

// GET /api/cron/purge-expired-users — called daily by Vercel Cron (see
// vercel.json). Permanently deletes accounts that have had no site access
// for 30+ days (site_ids emptied via "Toegang opzeggen").
export async function GET(req: NextRequest) {
  // Fail closed: without CRON_SECRET configured, this endpoint refuses every
  // request rather than running unauthenticated.
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const result = await User.deleteMany({
    pending_deletion_at: { $ne: null, $lte: new Date() },
  });

  return NextResponse.json({ ok: true, deleted: result.deletedCount });
}
