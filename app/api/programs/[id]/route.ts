import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { WashProgram } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as {
    name?: string;
    tier?: number;
    chemicals?: string[];
  };

  await dbConnect();

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.tier !== undefined) update.tier = body.tier;
  if (body.chemicals !== undefined) {
    update.chemicals = body.chemicals.map((c: string) => c.trim()).filter(Boolean);
  }

  await WashProgram.findByIdAndUpdate(id, update);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await dbConnect();
  await WashProgram.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
