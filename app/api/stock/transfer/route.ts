import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { ChemicalStock } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// POST /api/stock/transfer — move stock of one product from one site to another
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    fromSiteId?: string;
    toSiteId?: string;
    name?: string;
    quantity?: number;
  };

  const { fromSiteId, toSiteId, name } = body;
  const quantity = Number(body.quantity);

  if (!fromSiteId || !toSiteId || !name || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'Ongeldige gegevens' }, { status: 400 });
  }
  if (fromSiteId === toSiteId) {
    return NextResponse.json({ error: 'Bron en bestemming zijn dezelfde carwash' }, { status: 400 });
  }

  await dbConnect();

  const fromStock = await ChemicalStock.findOne({ site_id: fromSiteId, name });
  if (!fromStock) return NextResponse.json({ error: 'Product niet gevonden bij bronsite' }, { status: 404 });

  fromStock.current_stock = Math.max(0, (fromStock.current_stock ?? 0) - quantity);
  fromStock.last_updated = new Date();
  await fromStock.save();

  const toStock = await ChemicalStock.findOneAndUpdate(
    { site_id: toSiteId, name },
    {
      $inc: { current_stock: quantity },
      $set: { last_updated: new Date() },
      $setOnInsert: { site_id: toSiteId, name, unit: fromStock.unit, min_stock_alert: 0 },
    },
    { upsert: true, new: true },
  );

  return NextResponse.json({
    ok: true,
    from: { id: fromStock._id.toString(), current_stock: fromStock.current_stock },
    to: { id: toStock._id.toString(), current_stock: toStock.current_stock },
  });
}
