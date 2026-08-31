import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Translation } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { getAllTranslationRows } from '@/lib/translationKeys';

function canManage(role: string) {
  return role === 'owner' || role === 'developer';
}

// GET /api/translations — every translatable key: current NL + FR value
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManage(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();
  const rows = await getAllTranslationRows();
  return NextResponse.json(rows);
}

// PATCH /api/translations — body: { key, value } — upsert one FR override.
// An empty value removes the override (falls back to NL).
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !canManage(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { key?: string; value?: string };
  if (!body.key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  await dbConnect();

  const value = (body.value ?? '').trim();
  if (value === '') {
    await Translation.deleteOne({ locale: 'fr', key: body.key });
  } else {
    await Translation.findOneAndUpdate(
      { locale: 'fr', key: body.key },
      { value, updated_at: new Date() },
      { upsert: true },
    );
  }

  return NextResponse.json({ ok: true });
}
