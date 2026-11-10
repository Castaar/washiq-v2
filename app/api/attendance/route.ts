import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { AttendanceLog, ContractReachedSent, User } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { brusselsInstant } from '@/lib/dates';
import type { AttendanceType } from '@/lib/attendance-hours';
import { sendPushToUser, afterResponse } from '@/lib/push';
import { brusselsMonth, contractStatuses } from '@/lib/contract-hours';
import type { Types } from 'mongoose';

// GET /api/attendance?siteId=xxx&date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  const dateParam = req.nextUrl.searchParams.get('date');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();

  const filter: Record<string, unknown> = { site_id: siteId };
  if (dateParam) {
    const from = new Date(dateParam);
    const to = new Date(dateParam);
    to.setDate(to.getDate() + 1);
    filter.timestamp = { $gte: from, $lt: to };
  } else {
    // Default: last 30 days
    const from = new Date();
    from.setDate(from.getDate() - 30);
    filter.timestamp = { $gte: from };
  }

  const logs = await AttendanceLog.find(filter).sort({ timestamp: -1 }).limit(200).lean();

  return NextResponse.json(
    logs.map((l) => ({
      id: (l._id as Types.ObjectId).toString(),
      siteId: (l.site_id as Types.ObjectId).toString(),
      userId: (l.user_id as Types.ObjectId).toString(),
      userName: l.user_name,
      type: l.type,
      personType: l.person_type ?? 'employee',
      registeredByName: l.registered_by_name ?? '',
      timestamp: (l.timestamp as Date).toISOString(),
      note: l.note ?? '',
    })),
  );
}

// POST /api/attendance  — log arrival or departure (employee, or an external
// technician registered on their behalf since technicians have no app account)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    siteId: string;
    type: AttendanceType;
    note?: string;
    personType?: 'employee' | 'technician_extern' | 'jobstudent';
    personName?: string;
    onBehalfOfUserId?: string;
    onBehalfOfUserName?: string;
    timestamp?: string;
  };
  if (!body.siteId || !['opening', 'sluiting', 'pauze_start', 'pauze_einde'].includes(body.type)) {
    return NextResponse.json({ error: 'siteId and type required' }, { status: 400 });
  }

  const isExtern = body.personType === 'technician_extern' || body.personType === 'jobstudent';
  if (isExtern && !body.personName?.trim()) {
    return NextResponse.json({ error: 'personName required' }, { status: 400 });
  }

  // Owner/developer registering on behalf of an employee who forgot to
  // check themselves in/out — logged under that employee's own account so
  // it counts correctly toward their monthly hours.
  const isOnBehalf = Boolean(body.onBehalfOfUserId);
  if (isOnBehalf && session.role !== 'owner' && session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();

  // Owner/developer can backdate an on-behalf registration to the time it
  // actually happened (e.g. filling it in after the fact at end of day) —
  // everyone else always logs at "now".
  // A named jobstudent can be filled in afterwards by the owner as well.
  const isOwnerRole = session.role === 'owner' || session.role === 'developer';
  const canBackdate = isOnBehalf || (body.personType === 'jobstudent' && isOwnerRole);
  const timestamp = canBackdate && body.timestamp ? new Date(body.timestamp) : new Date();

  // A backdated departure that falls before that person's arrival the same day is
  // almost always a 12h/24h slip (06:30 meant as 18:30) — refuse it with a hint.
  if (canBackdate && body.type === 'sluiting' && body.timestamp) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(timestamp);
    const person = isOnBehalf
      ? { user_id: body.onBehalfOfUserId }
      : { person_type: 'jobstudent', user_name: new RegExp(`^${body.personName!.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    const arrival = await AttendanceLog.findOne({
      ...person,
      type: 'opening',
      timestamp: { $gte: brusselsInstant(day, '00:00:00'), $lte: timestamp },
    }).sort({ timestamp: 1 }).lean();
    const laterArrival = arrival ? null : await AttendanceLog.findOne({
      ...person,
      type: 'opening',
      timestamp: { $gt: timestamp, $lte: brusselsInstant(day, '23:59:59') },
    }).lean();
    if (laterArrival) {
      const t = (d: Date) => d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
      return NextResponse.json({
        error: `Vertrek (${t(timestamp)}) ligt vóór de aankomst van die dag (${t(new Date(laterArrival.timestamp as Date))}). Kies het uur in 24u-formaat, bv. 18 u voor 6 uur 's avonds.`,
      }, { status: 400 });
    }
  }

  const log = await AttendanceLog.create({
    site_id: body.siteId,
    user_id: isOnBehalf ? body.onBehalfOfUserId : session.userId,
    user_name: isOnBehalf ? (body.onBehalfOfUserName ?? '') : isExtern ? body.personName!.trim() : session.name,
    type: body.type,
    person_type: isOnBehalf ? 'employee' : isExtern ? body.personType! : 'employee',
    registered_by_name: (isOnBehalf || isExtern) ? session.name : '',
    timestamp,
    note: body.note?.trim() ?? '',
  });

  const actionLabel = { opening: 'is aangekomen', sluiting: 'is vertrokken', pauze_start: 'neemt pauze', pauze_einde: 'is terug van pauze' }[body.type];
  // Only owners (scoped to their own sites) and developers are notified of
  // arrivals/departures — colleagues don't need to know who clocks in when.
  afterResponse(User.find({ is_active: true, $or: [{ role: 'developer' }, { site_ids: body.siteId, role: 'owner' }] })
    .select('_id')
    .lean()
    .then((notifyUsers) =>
      Promise.allSettled(
        notifyUsers
          .filter((u) => (u._id as Types.ObjectId).toString() !== session.userId)
          .map((u) =>
            sendPushToUser((u._id as Types.ObjectId).toString(), {
              title: `${log.user_name} ${actionLabel}`,
              body: timestamp.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }),
              url: `/logboek?site=${body.siteId}&item=${(log._id as Types.ObjectId).toString()}`,
            }),
          ),
      ),
    )
    .catch(() => {}));

  // A departure can push an employee past their monthly contract hours — tell
  // the owners once per month (the dedupe marker's unique index makes it race-safe).
  if (body.type === 'sluiting' && !isExtern) {
    const workerId = isOnBehalf ? body.onBehalfOfUserId! : session.userId;
    const { year, month, key } = brusselsMonth(timestamp);
    afterResponse(contractStatuses(year, month, [workerId])
      .then(async ([status]) => {
        if (!status?.reached) return;
        try {
          await ContractReachedSent.create({ user_id: workerId, month: key });
        } catch {
          return; // already told this month
        }
        const owners = await User.find({ is_active: true, role: 'owner', site_ids: body.siteId }).select('_id').lean();
        const fmt = (n: number) => n.toLocaleString('nl-BE', { maximumFractionDigits: 2 });
        await Promise.allSettled(owners.map((o) => sendPushToUser(String(o._id), {
          title: `${status.name}: contracturen bereikt`,
          body: `${fmt(status.workedHours)} u gewerkt van ${fmt(status.contractHours)} u deze maand. Wat erboven komt, telt als overuren.`,
          url: `/logboek?site=${body.siteId}`,
        })));
      })
      .catch(() => {}));
  }

  return NextResponse.json({
    id: (log._id as Types.ObjectId).toString(),
    userId: (log.user_id as Types.ObjectId).toString(),
    userName: log.user_name,
    type: log.type,
    personType: log.person_type,
    registeredByName: log.registered_by_name,
    timestamp: (log.timestamp as Date).toISOString(),
  }, { status: 201 });
}
