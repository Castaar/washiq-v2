import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Brush, WeeklyEntry } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// POST /api/brushes/[id]/replace — log that new textile was mounted on this
// brush today. Any logged-in user (e.g. a technician doing the physical
// work), not owner-only.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const brush = await Brush.findById(id).lean();
  if (!brush) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const latestEntry = await WeeklyEntry.findOne({ site_id: brush.site_id })
    .sort({ week_start: -1 })
    .select('tellerstand')
    .lean();
  const currentTellerstand = (latestEntry as { tellerstand?: number } | null)?.tellerstand ?? 0;

  const now = new Date();
  await Brush.findByIdAndUpdate(id, {
    $set: { washes_at_last_replacement: currentTellerstand, last_replaced_at: now },
  });

  return NextResponse.json({
    ok: true,
    washesAtLastReplacement: currentTellerstand,
    lastReplacedAt: now.toISOString(),
  });
}
