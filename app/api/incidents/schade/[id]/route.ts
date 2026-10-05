import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IncidentSchade, ActivityLog } from '@/lib/models';
import { canModify } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/session';

interface SchadeUpdateBody {
  is_resolved?: boolean;
  type_voertuig?: string;
  merk_model?: string;
  nummerplaat?: string;
  naam_eigenaar?: string;
  tel_gsm?: string;
  email?: string;
  omschrijving?: string;
  onbetwist?: boolean;
  installatiefout?: boolean;
  klant_verantwoordelijk?: boolean;
  verzekeringsdocumenten?: boolean;
}

const EDITABLE_FIELDS: (keyof SchadeUpdateBody)[] = [
  'type_voertuig', 'merk_model', 'nummerplaat', 'naam_eigenaar', 'tel_gsm', 'email',
  'omschrijving', 'onbetwist', 'installatiefout', 'klant_verantwoordelijk', 'verzekeringsdocumenten',
];

// PUT /api/incidents/schade/[id] — toggle resolved status, and/or edit the report's fields
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as SchadeUpdateBody;

  await dbConnect();

  const update: Record<string, unknown> = {};
  if (EDITABLE_FIELDS.some((f) => body[f] !== undefined)) {
    const existing = await IncidentSchade.findById(id).select('reported_by').lean();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canModify(session, (existing as { reported_by?: unknown }).reported_by)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  if (body.is_resolved !== undefined) {
    Object.assign(update, body.is_resolved
      ? { is_resolved: true, resolved_at: new Date(), resolved_by_name: session.name }
      : { is_resolved: false, resolved_at: null, resolved_by_name: '' });
  }
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  const doc = await IncidentSchade.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/incidents/schade/[id] — remove a wrong report (manager or reporter)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const doc = await IncidentSchade.findById(id).select('reported_by').lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canModify(session, (doc as { reported_by?: unknown }).reported_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await IncidentSchade.findByIdAndDelete(id);
  await ActivityLog.deleteMany({ ref_id: id, ref_type: 'incident_schade' });
  return NextResponse.json({ ok: true });
}
