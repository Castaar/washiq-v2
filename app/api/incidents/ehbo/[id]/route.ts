import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IncidentEhbo, ActivityLog } from '@/lib/models';
import { canModify } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/session';

const EDITABLE = ['naam_slachtoffer', 'afdeling_locatie', 'verwonding', 'ehbo_handeling', 'ehbo_verlener', 'beschrijving', 'uur', 'dokter_nodig'] as const;

// PUT /api/incidents/ehbo/[id] — toggle resolved status and/or correct the report's fields
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { is_resolved?: boolean } & Partial<Record<(typeof EDITABLE)[number], string | boolean>>;

  await dbConnect();

  const update: Record<string, unknown> = {};
  if (body.is_resolved !== undefined) {
    Object.assign(update, body.is_resolved
      ? { is_resolved: true, resolved_by_name: session.name }
      : { is_resolved: false, resolved_by_name: '' });
  }
  const edits = EDITABLE.filter((f) => body[f] !== undefined);
  if (edits.length > 0) {
    const existing = await IncidentEhbo.findById(id).select('reported_by').lean();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canModify(session, (existing as { reported_by?: unknown }).reported_by)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    for (const f of edits) update[f] = body[f];
  }

  const doc = await IncidentEhbo.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/incidents/ehbo/[id] — remove a wrong report (manager or reporter)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const doc = await IncidentEhbo.findById(id).select('reported_by').lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canModify(session, (doc as { reported_by?: unknown }).reported_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await IncidentEhbo.findByIdAndDelete(id);
  await ActivityLog.deleteMany({ ref_id: id, ref_type: 'incident_ehbo' });
  return NextResponse.json({ ok: true });
}
