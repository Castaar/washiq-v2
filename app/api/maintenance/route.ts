import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { MaintenanceTask } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// GET /api/maintenance?siteId=xxx  — list tasks for a site
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();
  const tasks = await MaintenanceTask.find({ site_id: siteId }).sort({ description: 1 }).lean();

  return NextResponse.json(
    tasks.map((t) => ({
      id: (t._id as Types.ObjectId).toString(),
      siteId: (t.site_id as Types.ObjectId).toString(),
      description: t.description,
      trigger_type: t.trigger_type,
      trigger_value: t.trigger_value ?? 0,
      trigger_day: t.trigger_day ?? 0,
      trigger_month: t.trigger_month ?? 0,
      trigger_month_list: t.trigger_month_list ?? [],
      last_done_at: t.last_done_at ? (t.last_done_at as Date).toISOString() : null,
      washes_at_last_done: t.washes_at_last_done ?? 0,
      is_overdue: t.is_overdue ?? false,
    })),
  );
}

// POST /api/maintenance  — create a task (owner or developer)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'developer' && session.role !== 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  type Body = {
    siteId: string;
    description: string;
    trigger_type: 'washes' | 'months' | 'fixed_date' | 'fixed_months';
    trigger_value?: number;
    trigger_day?: number;
    trigger_month?: number;
    trigger_month_list?: number[];
    last_done_at?: string;
    washes_at_last_done?: number;
  };

  const body = (await req.json()) as Body;
  if (!body.siteId || !body.description || !body.trigger_type) {
    return NextResponse.json({ error: 'siteId, description and trigger_type are required' }, { status: 400 });
  }

  await dbConnect();
  const hasLastDone = !!body.last_done_at;
  const doc = await MaintenanceTask.create({
    site_id: body.siteId,
    description: body.description.trim(),
    trigger_type: body.trigger_type,
    trigger_value: body.trigger_value ?? 0,
    trigger_day: body.trigger_day ?? 0,
    trigger_month: body.trigger_month ?? 0,
    trigger_month_list: body.trigger_month_list ?? [],
    last_done_at: hasLastDone ? new Date(body.last_done_at!) : undefined,
    washes_at_last_done: body.washes_at_last_done ?? 0,
    is_overdue: !hasLastDone && body.trigger_type === 'washes',
  });

  return NextResponse.json({ id: (doc._id as Types.ObjectId).toString() }, { status: 201 });
}
