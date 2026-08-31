import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Translation } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import nlMessages from '@/messages/nl.json';
import frMessages from '@/messages/fr.json';

function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (obj !== undefined && obj !== null) {
    out[prefix] = String(obj);
  }
  return out;
}

function csvEscape(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

// GET /api/developer/translations/export — CSV of all keys: nl (source) + fr (current)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();
  const overrides = await Translation.find({ locale: 'fr' }).select('key value').lean();
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.key as string, o.value as string]));

  const nlFlat = flatten(nlMessages);
  const frFlat = flatten(frMessages);

  const rows = [['key', 'nl', 'fr']];
  for (const key of Object.keys(nlFlat).sort()) {
    const fr = overrideMap[key] ?? frFlat[key] ?? '';
    rows.push([key, nlFlat[key], fr]);
  }

  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="washiq-vertalingen-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
