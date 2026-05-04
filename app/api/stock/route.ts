import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { ChemicalStock } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();

  const siteId = req.nextUrl.searchParams.get('siteId');
  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  const stocks = await ChemicalStock.find({ site_id: siteId }).sort({ name: 1 }).lean();

  return NextResponse.json(
    stocks.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      current_stock: s.current_stock,
      min_stock_alert: s.min_stock_alert,
      unit: s.unit,
      last_updated: s.last_updated,
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();

  const body = await req.json();

  if (!body.siteId || !body.name || !body.unit) {
    return NextResponse.json({ error: 'siteId, name and unit are required' }, { status: 400 });
  }

  const stock = await ChemicalStock.create({
    site_id: body.siteId,
    name: body.name.trim(),
    current_stock: Number(body.current_stock) || 0,
    min_stock_alert: Number(body.min_stock_alert) || 0,
    unit: body.unit.trim(),
    last_updated: new Date(),
  });

  return NextResponse.json(
    {
      id: stock._id.toString(),
      name: stock.name,
      current_stock: stock.current_stock,
      min_stock_alert: stock.min_stock_alert,
      unit: stock.unit,
      last_updated: stock.last_updated,
    },
    { status: 201 },
  );
}
