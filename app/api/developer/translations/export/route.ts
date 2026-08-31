import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { getSessionFromRequest } from '@/lib/session';
import { getAllTranslationRows } from '@/lib/translationKeys';

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
  const allRows = await getAllTranslationRows();

  const rows = [['key', 'nl', 'fr'], ...allRows.map((r) => [r.key, r.nl, r.fr])];
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="washiq-vertalingen-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
