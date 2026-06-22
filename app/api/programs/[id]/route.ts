import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { WashProgram } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

async function canManage(session: { role: string; siteIds: string[] } | null, id: string): Promise<boolean> {
  if (!session) return false;
  if (session.role === 'developer') return true;
  if (session.role !== 'owner') return false;
  const doc = await WashProgram.findById(id).select('site_id').lean();
  if (!doc) return false;
  return session.siteIds.includes((doc.site_id as Types.ObjectId).toString());
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  const { id } = await params;

  await dbConnect();
  if (!(await canManage(session, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    tier?: number;
    chemicals?: string[];
  };

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
  const { id } = await params;

  await dbConnect();
  if (!(await canManage(session, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await WashProgram.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
