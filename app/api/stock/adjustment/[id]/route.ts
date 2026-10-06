import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { StockAdjustment } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { isManager } from '@/lib/permissions';
import { recomputeChemical } from '@/lib/stock-ledger';

// DELETE /api/stock/adjustment/[id] — undo a manual stock correction
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!isManager(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await dbConnect();
  const { id } = await params;

  const adj = await StockAdjustment.findById(id);
  if (!adj) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const chemicalId = adj.chemical_id.toString();
  await adj.deleteOne();
  await recomputeChemical(chemicalId);

  return NextResponse.json({ ok: true });
}
