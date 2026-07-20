import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Defect } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sendPushToAll } from '@/lib/push';

const ERNST_LABEL: Record<string, string> = { laag: 'Laag', medium: 'Medium', hoog: 'HOOG ⚠️' };

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  await dbConnect();

  const ernst = ['laag', 'medium', 'hoog'].includes(body.ernst) ? body.ernst : 'medium';

  const doc = await Defect.create({
    site_id: body.siteId,
    reported_by: session.userId,
    reported_by_name: session.name,
    omschrijving: body.omschrijving ?? '',
    ernst,
    assigned_to_name: body.assigned_to_name ?? '',
  });

  sendPushToAll({
    title: `Nieuw defect gemeld — ${ERNST_LABEL[ernst]}`,
    body: body.omschrijving ?? 'Een defect werd ingediend.',
    url: '/incidenten',
  }).catch(() => {});

  return NextResponse.json({ id: doc._id.toString() }, { status: 201 });
}
