import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Defect, ActivityLog } from '@/lib/models';
import { canModify } from '@/lib/permissions';
import { getSessionFromRequest } from '@/lib/session';

// PUT /api/incidents/defect/[id] — toggle resolved status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { is_resolved?: boolean; resolve_note?: string; omschrijving?: string; ernst?: string };

  await dbConnect();

  const update: Record<string, unknown> = {};
  if (body.is_resolved !== undefined) {
    Object.assign(update, body.is_resolved
      ? { is_resolved: true, resolved_at: new Date(), resolved_by_name: session.name, resolve_note: body.resolve_note ?? '' }
      : { is_resolved: false, resolved_at: null, resolved_by_name: '', resolve_note: '' });
  }
  // Correcting the report itself: only a manager or the person who reported it.
  if (body.omschrijving !== undefined || body.ernst !== undefined) {
    const existing = await Defect.findById(id).select('reported_by').lean();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canModify(session, (existing as { reported_by?: unknown }).reported_by)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (body.omschrijving !== undefined) update.omschrijving = body.omschrijving.trim();
    if (body.ernst !== undefined && ['laag', 'medium', 'hoog'].includes(body.ernst)) update.ernst = body.ernst;
  }

  const doc = await Defect.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/incidents/defect/[id] — remove a wrong report (manager or reporter)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const doc = await Defect.findById(id).select('reported_by').lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canModify(session, (doc as { reported_by?: unknown }).reported_by)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await Defect.findByIdAndDelete(id);
  await ActivityLog.deleteMany({ ref_id: id, ref_type: 'defect' });
  return NextResponse.json({ ok: true });
}
