import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { DailyChecklist, MaintenanceTask, MaintenanceLog } from '@/lib/models';
import { getSession } from '@/lib/session';
import { sendPushToSite } from '@/lib/push';
import type { Types } from 'mongoose';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  await dbConnect();

  const body = await req.json() as {
    siteId: string;
    items: { label: string; checked: boolean; opmerking: string }[];
    dagrapport: string;
    maintenanceChecks?: { taskId: string; notes?: string }[];
    totalWagens?: number;
  };

  const doc = await DailyChecklist.create({
    site_id: body.siteId,
    user_id: session.userId,
    date: new Date(),
    items: body.items,
    defect_note: body.dagrapport,
    submitted_at: new Date(),
  });

  if (body.maintenanceChecks?.length) {
    const now = new Date();
    await Promise.all(
      body.maintenanceChecks.map((check) =>
        Promise.all([
          MaintenanceTask.findByIdAndUpdate(check.taskId, {
            $set: {
              last_done_at: now,
              washes_at_last_done: body.totalWagens ?? 0,
              is_overdue: false,
            },
          }),
          MaintenanceLog.create({
            task_id: check.taskId,
            site_id: body.siteId,
            done_by: session.userId,
            done_at: now,
            notes: check.notes ?? '',
          }),
        ]),
      ),
    );
  }

  const hasIssues =
    body.items.some((item) => !item.checked || item.opmerking) ||
    (body.dagrapport && body.dagrapport.trim().length > 0);

  if (hasIssues) {
    sendPushToSite(body.siteId, {
      title: 'Dagfiche ingediend met opmerkingen',
      body: body.dagrapport?.trim() || 'Controleer de dagfiche voor details.',
      url: `/dagfiche?site=${body.siteId}`,
    }).catch(() => {});
  }

  return NextResponse.json({ id: (doc._id as Types.ObjectId).toString() }, { status: 201 });
}
