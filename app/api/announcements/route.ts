import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Announcement } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import type { Types } from 'mongoose';

// GET /api/announcements?siteId=xxx
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const siteId = req.nextUrl.searchParams.get('siteId');
  await dbConnect();

  const filter = siteId
    ? { $or: [{ is_all_sites: true }, { site_ids: siteId }] }
    : { is_all_sites: true };

  const limit = req.nextUrl.searchParams.get('limit');
  const docs = await Announcement.find(filter).sort({ created_at: -1 }).limit(limit ? parseInt(limit) : 10).lean();

  return NextResponse.json(
    docs.map((d) => ({
      id: (d._id as Types.ObjectId).toString(),
      text: d.text,
      text_fr: d.text_fr ?? '',
      kind: d.kind ?? 'general',
      created_by_name: d.created_by_name,
      is_all_sites: d.is_all_sites,
      created_at: (d.created_at as Date).toISOString(),
    })),
  );
}

// POST /api/announcements
// — birthday wishes: any logged-in user
// — general announcements (visible across filialen): owner/developer only
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { text: string; text_fr?: string; siteId?: string; is_all_sites?: boolean; kind?: 'general' | 'birthday' };
  if (!body.text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const kind = body.kind === 'birthday' ? 'birthday' : 'general';
  if (kind === 'general' && session.role !== 'owner' && session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();

  const isAll = body.is_all_sites !== false;
  const doc = await Announcement.create({
    text: body.text.trim(),
    text_fr: body.text_fr?.trim() || undefined,
    kind,
    created_by_name: session.name,
    is_all_sites: isAll,
    site_ids: isAll ? [] : (body.siteId ? [body.siteId] : []),
  });

  return NextResponse.json({ id: (doc._id as Types.ObjectId).toString() }, { status: 201 });
}

// DELETE /api/announcements?id=xxx — owner/developer only
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await dbConnect();
  await Announcement.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
