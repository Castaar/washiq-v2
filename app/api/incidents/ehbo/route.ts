import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IncidentEhbo } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sendPushToSite } from '@/lib/push';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  await dbConnect();

  const doc = await IncidentEhbo.create({
    site_id: body.siteId,
    reported_by: session.userId,
    reported_by_name: session.name,
    datum: body.datum ? new Date(body.datum) : new Date(),
    uur: body.uur ?? '',
    naam_slachtoffer: body.naam_slachtoffer ?? '',
    afdeling_locatie: body.afdeling_locatie ?? '',
    verwonding: body.verwonding ?? '',
    ehbo_handeling: body.ehbo_handeling ?? '',
    ehbo_verlener: body.ehbo_verlener ?? '',
    beschrijving: body.beschrijving ?? '',
    dokter_nodig: body.dokter_nodig ?? false,
  });

  sendPushToSite(body.siteId, {
    title: 'Nieuw EHBO-incident',
    body: body.naam_slachtoffer ? `Slachtoffer: ${body.naam_slachtoffer}` : 'Een EHBO-incident werd ingediend.',
    url: '/incidenten/ehbo',
  }).catch(() => {});

  return NextResponse.json({ id: doc._id.toString() }, { status: 201 });
}
