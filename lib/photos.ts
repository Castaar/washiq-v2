import crypto from 'crypto';
import { del, put } from '@vercel/blob';

// Incident photos live in a private Vercel Blob store (glosiv-photos). The database
// only keeps a link like /api/photos/incidents/<siteId>/<kind>/<id>.jpg; that route
// checks the session and the user's access to the carwash before serving the file.
// Older records may still hold the photo itself as a data:image URL — both work.

export const PHOTO_ROUTE = '/api/photos/';
export type PhotoKind = 'defect' | 'schade' | 'ehbo';

const MAX_BYTES = 8 * 1024 * 1024;

const STORED = /^\/api\/photos\/incidents\/[a-f0-9]{24}\/(defect|schade|ehbo)\/[\w-]+\.(jpg|png|webp|gif|heic|heif)$/i;
export function isStoredPhoto(v: unknown): v is string {
  return typeof v === 'string' && STORED.test(v);
}

function parseDataUrl(v: string): { type: string; data: Buffer } | null {
  const m = /^data:(image\/(?:jpeg|jpg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(v);
  if (!m) return null;
  const data = Buffer.from(m[2], 'base64');
  if (data.length === 0 || data.length > MAX_BYTES) return null;
  return { type: m[1].toLowerCase().replace('image/jpg', 'image/jpeg'), data };
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif' };

// Upload new photos (data:image URLs) and return the links to store. Links that already
// point at the photo route are kept; anything else (foreign URLs, junk) is dropped.
export async function storePhotos(photos: unknown, siteId: string, kind: PhotoKind): Promise<string[]> {
  if (!Array.isArray(photos)) return [];
  const out: string[] = [];
  for (const p of photos) {
    if (isStoredPhoto(p)) { out.push(p); continue; }
    if (typeof p !== 'string') continue;
    const parsed = parseDataUrl(p);
    if (!parsed) continue;
    const pathname = `incidents/${siteId}/${kind}/${crypto.randomUUID()}.${EXT[parsed.type] ?? 'jpg'}`;
    await put(pathname, parsed.data, { access: 'private', contentType: parsed.type, addRandomSuffix: false });
    out.push(`${PHOTO_ROUTE}${pathname}`);
  }
  return out;
}

// Best effort: a failed delete only leaves an orphan file behind.
export async function deletePhotos(photos: unknown): Promise<void> {
  if (!Array.isArray(photos)) return;
  const pathnames = photos.filter(isStoredPhoto).map((p) => p.slice(PHOTO_ROUTE.length));
  if (pathnames.length === 0) return;
  try {
    await del(pathnames);
  } catch (err) {
    console.error('[photos] delete failed', err);
  }
}
