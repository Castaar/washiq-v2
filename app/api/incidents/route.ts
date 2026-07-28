import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IncidentSchade, IncidentEhbo, Defect, WeeklyEntry } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

const PAGE_SIZE = 15;

function fmtDate(d: Date) {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // skip is used for pagination ("laad meer")
  const skip = parseInt(req.nextUrl.searchParams.get('skip') ?? '0') || 0;
  const perType = PAGE_SIZE;

  await dbConnect();

  const [schades, ehbos, defects, totalSchade, allSchades, latestEntry] = await Promise.all([
    IncidentSchade.find({ site_id: siteId }).sort({ created_at: -1 }).skip(skip > 0 ? skip : 0).limit(perType).lean(),
    IncidentEhbo.find({ site_id: siteId }).sort({ created_at: -1 }).skip(skip > 0 ? skip : 0).limit(perType).lean(),
    Defect.find({ site_id: siteId }).sort({ created_at: -1 }).skip(skip > 0 ? skip : 0).limit(perType).lean(),
    IncidentSchade.countDocuments({ site_id: siteId }),
    IncidentSchade.find({ site_id: siteId }).select('schade_locaties').lean(),
    WeeklyEntry.findOne({ site_id: siteId }).sort({ week_start: -1 }).select('tellerstand').lean(),
  ]);

  const items = [
    ...schades.map((s) => ({
      id: (s._id as Types.ObjectId).toString(),
      type: 'schade' as const,
      title: s.merk_model || s.naam_eigenaar || 'Schade',
      subtitle: [s.omschrijving, (s.schade_locaties ?? []).join(', ')].filter(Boolean).join(' — '),
      date: fmtDate(new Date(s.created_at)),
      is_resolved: s.is_resolved ?? false,
      resolved_by_name: s.resolved_by_name ?? '',
      refType: 'incident_schade',
      payload: {
        type: 'schade' as const,
        reportedBy: s.reported_by_name || '',
        date: fmtDate(new Date(s.created_at)),
        typeVoertuig: s.type_voertuig || '',
        merkModel: s.merk_model || '',
        nummerplaat: s.nummerplaat || '',
        naamEigenaar: s.naam_eigenaar || '',
        telGsm: s.tel_gsm || '',
        email: s.email || '',
        omschrijving: s.omschrijving || '',
        onbetwist: Boolean(s.onbetwist),
        installatiefout: Boolean(s.installatiefout),
        klantVerantwoordelijk: Boolean(s.klant_verantwoordelijk),
        verzekeringsdocumenten: Boolean(s.verzekeringsdocumenten),
      },
    })),
    ...ehbos.map((e) => ({
      id: (e._id as Types.ObjectId).toString(),
      type: 'ehbo' as const,
      title: e.naam_slachtoffer || 'EHBO',
      subtitle: e.verwonding || '',
      date: fmtDate(new Date(e.created_at)),
      is_resolved: false,
      resolved_by_name: '',
      refType: 'incident_ehbo',
      payload: {
        type: 'ehbo' as const,
        reportedBy: e.reported_by_name || '',
        date: fmtDate(new Date(e.created_at)),
        uur: e.uur || '',
        naamSlachtoffer: e.naam_slachtoffer || '',
        afdelingLocatie: e.afdeling_locatie || '',
        verwonding: e.verwonding || '',
        ehboHandeling: e.ehbo_handeling || '',
        ehboVerlener: e.ehbo_verlener || '',
        beschrijving: e.beschrijving || '',
        dokterNodig: Boolean(e.dokter_nodig),
      },
    })),
    ...defects.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      type: 'defect' as const,
      title: d.omschrijving?.slice(0, 40) || 'Defect',
      subtitle: d.ernst || '',
      date: fmtDate(new Date(d.created_at)),
      is_resolved: d.is_resolved ?? false,
      resolved_by_name: d.resolved_by_name ?? '',
      refType: 'defect',
      payload: {
        type: 'defect' as const,
        reportedBy: d.reported_by_name || '',
        date: fmtDate(new Date(d.created_at)),
        omschrijving: d.omschrijving || '',
        ernst: d.ernst || 'medium',
      },
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const currentTellerstand = (latestEntry as { tellerstand?: number } | null)?.tellerstand ?? 0;
  const schadesPer1000 = currentTellerstand > 0
    ? Math.round((totalSchade / currentTellerstand) * 1000 * 10) / 10
    : null;

  const locatieCounts: Record<string, number> = {};
  for (const s of allSchades as { schade_locaties?: string[] }[]) {
    for (const loc of s.schade_locaties ?? []) {
      locatieCounts[loc] = (locatieCounts[loc] ?? 0) + 1;
    }
  }
  const schadeLocatieStats = Object.entries(locatieCounts).map(([locatie, count]) => ({
    locatie,
    count,
    per1000: currentTellerstand > 0 ? Math.round((count / currentTellerstand) * 1000 * 10) / 10 : null,
  }));

  return NextResponse.json({
    items,
    stats: { totalSchade, currentTellerstand, schadesPer1000, schadeLocatieStats },
  });
}
