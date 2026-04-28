import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { DailyChecklist } from '@/lib/models';
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
  };

  const doc = await DailyChecklist.create({
    site_id: body.siteId,
    user_id: session.userId,
    date: new Date(),
    items: body.items,
    defect_note: body.dagrapport,
    submitted_at: new Date(),
  });

  const hasIssues =
    body.items.some((item) => !item.checked || item.opmerking) ||
    (body.dagrapport && body.dagrapport.trim().length > 0);

  if (hasIssues) {
    sendPushToSite(body.siteId, {
      title: 'Dagfiche ingediend met opmerkingen',
      body: body.dagrapport?.trim() || 'Controleer de dagfiche voor details.',
      url: '/dagfiche',
    }).catch(() => {});
  }

  return NextResponse.json({ id: (doc._id as Types.ObjectId).toString() }, { status: 201 });
}
