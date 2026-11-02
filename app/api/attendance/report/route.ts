import { NextRequest, NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { dbConnect } from '@/lib/db/mongoose';
import { Site } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { buildMonthlyReport } from '@/lib/attendance-report';

// GET /api/attendance/report?year=2026&month=10 — worked hours over all the
// owner's carwashes (developer: every carwash). Owner/developer only.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const year = parseInt(req.nextUrl.searchParams.get('year') ?? '');
  const month = parseInt(req.nextUrl.searchParams.get('month') ?? '');
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year and month required' }, { status: 400 });
  }

  await dbConnect();
  const siteIds = session.role === 'developer'
    ? (await Site.find({}).select('_id').lean()).map((s) => String(s._id))
    : session.siteIds.filter((id) => isValidObjectId(id));

  return NextResponse.json(await buildMonthlyReport(siteIds, year, month));
}
