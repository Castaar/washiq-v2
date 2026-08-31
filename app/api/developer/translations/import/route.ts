import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { Translation } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';

// Minimal RFC4180-ish CSV line parser (handles quoted fields with commas/quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); if (row.some((f) => f !== '')) rows.push(row); }
  return rows;
}

// POST /api/developer/translations/import — body: { csv: string }
// Upserts non-empty "fr" values as runtime translation overrides.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'developer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { csv?: string } | null;
  if (!body?.csv) return NextResponse.json({ error: 'Geen CSV-inhoud ontvangen' }, { status: 400 });

  const rows = parseCsv(body.csv);
  if (rows.length === 0) return NextResponse.json({ error: 'Leeg bestand' }, { status: 400 });

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const keyIdx = header.indexOf('key');
  const frIdx = header.indexOf('fr');
  if (keyIdx === -1 || frIdx === -1) {
    return NextResponse.json({ error: 'Verwacht kolommen "key" en "fr"' }, { status: 400 });
  }

  await dbConnect();

  let updated = 0;
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const key = row[keyIdx]?.trim();
    const fr = row[frIdx];
    if (!key || fr === undefined || fr.trim() === '') { skipped++; continue; }
    await Translation.findOneAndUpdate(
      { locale: 'fr', key },
      { value: fr, updated_at: new Date() },
      { upsert: true },
    );
    updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped, total: rows.length - 1 });
}
