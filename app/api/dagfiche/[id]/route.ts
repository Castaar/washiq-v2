import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { DailyChecklist, ActivityLog } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { canModify } from '@/lib/permissions';

// PATCH /api/dagfiche/[id] — correct a submitted dagfiche (manager or the person who submitted it)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    items?: { label: string; checked: boolean; opmerking?: string }[];
    dagrapport?: string;
  };

  await dbConnect();

  const doc = await DailyChecklist.findById(id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canModify(session, doc.user_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (Array.isArray(body.items)) {
    doc.items = body.items.map((it) => ({ label: it.label, checked: Boolean(it.checked), opmerking: it.opmerking ?? '' }));
  }
  if (typeof body.dagrapport === 'string') doc.defect_note = body.dagrapport;
  await doc.save();

  return NextResponse.json({ ok: true });
}

// DELETE /api/dagfiche/[id] — remove a wrong dagfiche (manager or submitter).
// Maintenance completions logged through it are separate and can be undone under Onderhoud.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const doc = await DailyChecklist.findById(id).select('user_id').lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canModify(session, (doc as { user_id?: unknown }).user_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await DailyChecklist.findByIdAndDelete(id);
  await ActivityLog.deleteMany({ ref_id: id, ref_type: 'daily_checklist' });
  return NextResponse.json({ ok: true });
}
