import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { getSessionFromRequest } from '@/lib/session';

// GET /api/photos/incidents/<siteId>/<kind>/<file> — serves a private incident photo
// to logged-in users with access to that carwash (developers: every carwash).
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSessionFromRequest(req);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { path } = await params;
  const [root, siteId, kind, file] = path ?? [];
  if (path.length !== 4 || root !== 'incidents' || !/^[a-f0-9]{24}$/i.test(siteId ?? '') || !['defect', 'schade', 'ehbo'].includes(kind ?? '') || !/^[\w-]+\.(jpg|png|webp|gif|heic|heif)$/i.test(file ?? '')) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (session.role !== 'developer' && !(session.siteIds ?? []).includes(siteId)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const result = await get(path.join('/'), { access: 'private' }).catch(() => null);
  if (!result || result.statusCode !== 200 || !result.stream) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType ?? 'image/jpeg',
      // File names are unique and never change: let the browser keep them, but never shared caches
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
