import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Defect } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// PUT /api/incidents/defect/[id] — toggle resolved status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { is_resolved: boolean; resolve_note?: string };

  await dbConnect();

  const update = body.is_resolved
    ? { is_resolved: true, resolved_at: new Date(), resolved_by_name: session.name, resolve_note: body.resolve_note ?? '' }
    : { is_resolved: false, resolved_at: null, resolved_by_name: '', resolve_note: '' };

  const doc = await Defect.findByIdAndUpdate(id, update, { new: true });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
