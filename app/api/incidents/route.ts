import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IncidentSchade, IncidentEhbo, Defect } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

function fmtDate(d: Date) {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  await dbConnect();

  const [schades, ehbos, defects] = await Promise.all([
    IncidentSchade.find({ site_id: siteId }).sort({ created_at: -1 }).limit(20).lean(),
    IncidentEhbo.find({ site_id: siteId }).sort({ created_at: -1 }).limit(20).lean(),
    Defect.find({ site_id: siteId }).sort({ created_at: -1 }).limit(20).lean(),
  ]);

  const items = [
    ...schades.map((s) => ({
      id: (s._id as Types.ObjectId).toString(),
      type: 'schade' as const,
      title: s.merk_model || s.naam_eigenaar || 'Schade',
      subtitle: s.omschrijving || '',
      date: fmtDate(new Date(s.created_at)),
    })),
    ...ehbos.map((e) => ({
      id: (e._id as Types.ObjectId).toString(),
      type: 'ehbo' as const,
      title: e.naam_slachtoffer || 'EHBO',
      subtitle: e.verwonding || '',
      date: fmtDate(new Date(e.created_at)),
    })),
    ...defects.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      type: 'defect' as const,
      title: d.omschrijving?.slice(0, 40) || 'Defect',
      subtitle: d.ernst || '',
      date: fmtDate(new Date(d.created_at)),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json(items);
}
