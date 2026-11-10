import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { ActivityLog, DailyChecklist, User } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sendPushToUser, afterResponse } from '@/lib/push';
import type { Types } from 'mongoose';
import type { ActivityRefType } from '@/lib/types/dashboard';

function activityUrl(refType: string, refId: string, siteId: string): string {
  if (refType === 'incident_schade' || refType === 'incident_ehbo' || refType === 'defect') {
    return `/incidenten?site=${siteId}&item=${refId}`;
  }
  if (refType === 'maintenance_task' || refType === 'maintenance_log') {
    return `/onderhouden?site=${siteId}`;
  }
  return `/?site=${siteId}`;
}

const VALID_REF_TYPES: ActivityRefType[] = [
  'maintenance_task',
  'daily_checklist',
  'incident_schade',
  'incident_ehbo',
  'defect',
  'maintenance_log',
];

// GET /api/activity?refId=xxx&refType=xxx
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const refId   = req.nextUrl.searchParams.get('refId');
  const refType = req.nextUrl.searchParams.get('refType');

  if (!refId || !refType) {
    return NextResponse.json({ error: 'refId and refType are required' }, { status: 400 });
  }

  await dbConnect();

  const entries = await ActivityLog.find({ ref_id: refId, ref_type: refType })
    .sort({ created_at: 1 })
    .lean();

  return NextResponse.json(
    entries.map((e) => ({
      id:              (e._id as Types.ObjectId).toString(),
      actionType:      e.action_type,
      text:            e.text,
      performedByName: e.performed_by_name,
      createdAt:       (e.created_at as Date).toISOString(),
    })),
  );
}

// POST /api/activity  body: { refId, refType, siteId, text }
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    refId?: string;
    refType?: string;
    siteId?: string;
    text?: string;
  };

  const { refId, refType, siteId, text } = body;

  if (!refId || !refType || !siteId || !text?.trim()) {
    return NextResponse.json(
      { error: 'refId, refType, siteId and text are required' },
      { status: 400 },
    );
  }

  if (!VALID_REF_TYPES.includes(refType as ActivityRefType)) {
    return NextResponse.json({ error: 'Invalid refType' }, { status: 400 });
  }

  await dbConnect();

  const doc = await ActivityLog.create({
    ref_id:            refId,
    ref_type:          refType,
    site_id:           siteId,
    action_type:       'comment',
    text:              text.trim(),
    performed_by:      session.userId,
    performed_by_name: session.name,
  });

  // A reaction on a dagfiche only goes to whoever submitted it. When that person
  // reacts themselves, it goes to the others who reacted on it (the conversation).
  // Any other melding: everyone else at this site (any role) plus every developer.
  const recipientsQuery = refType === 'daily_checklist'
    ? (async () => {
        const fiche = await DailyChecklist.findById(refId).select('user_id').lean();
        const creator = fiche ? String((fiche as { user_id?: unknown }).user_id ?? '') : '';
        const ids = new Set<string>();
        if (creator && creator !== session.userId) ids.add(creator);
        else if (creator) {
          const earlier = await ActivityLog.find({ ref_id: refId, ref_type: refType, action_type: 'comment' }).select('performed_by').lean();
          for (const e of earlier) if (e.performed_by) ids.add(String(e.performed_by));
        }
        ids.delete(session.userId);
        return User.find({ is_active: true, _id: { $in: [...ids] } }).select('_id').lean();
      })()
    : User.find({
        is_active: true,
        _id: { $ne: session.userId },
        $or: [{ role: 'developer' }, { site_ids: siteId }],
      })
        .select('_id')
        .lean();
  afterResponse(Promise.resolve(recipientsQuery)
    .then((recipients) =>
      Promise.allSettled(
        recipients.map((u) =>
          sendPushToUser((u._id as Types.ObjectId).toString(), {
            title: `Nieuwe reactie — ${session.name}`,
            body: text.trim(),
            url: activityUrl(refType, refId, siteId),
          }),
        ),
      ),
    )
    .catch(() => {}));

  return NextResponse.json(
    {
      id:              (doc._id as Types.ObjectId).toString(),
      actionType:      doc.action_type,
      text:            doc.text,
      performedByName: doc.performed_by_name,
      createdAt:       (doc.created_at as Date).toISOString(),
    },
    { status: 201 },
  );
}
