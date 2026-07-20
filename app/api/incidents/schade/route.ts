import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IncidentSchade } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sendPushToAll } from '@/lib/push';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  await dbConnect();

  const doc = await IncidentSchade.create({
    site_id: body.siteId,
    reported_by: session.userId,
    reported_by_name: session.name,
    type_voertuig: body.type_voertuig ?? '',
    merk_model: body.merk_model ?? '',
    nummerplaat: body.nummerplaat ?? '',
    datum_uur: body.datum_uur ? new Date(body.datum_uur) : new Date(),
    naam_eigenaar: body.naam_eigenaar ?? '',
    tel_gsm: body.tel_gsm ?? '',
    email: body.email ?? '',
    omschrijving: body.omschrijving ?? '',
    schade_locaties: Array.isArray(body.schade_locaties) ? body.schade_locaties : [],
    onbetwist: body.onbetwist ?? false,
    installatiefout: body.installatiefout ?? false,
    klant_verantwoordelijk: body.klant_verantwoordelijk ?? false,
    verzekeringsdocumenten: body.verzekeringsdocumenten ?? false,
    photos: Array.isArray(body.photos) ? body.photos : [],
  });

  sendPushToAll({
    title: 'Nieuw schade-incident',
    body: `${body.merk_model ?? ''} ${body.nummerplaat ?? ''}`.trim() || 'Een schade-incident werd ingediend.',
    url: '/incidenten/schade',
  }).catch(() => {});

  return NextResponse.json({ id: doc._id.toString() }, { status: 201 });
}
