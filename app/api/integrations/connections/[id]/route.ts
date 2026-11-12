import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { IntegrationConnection, SiteIntegration } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { isManager } from '@/lib/permissions';
import { seal } from '@/lib/secret-box';
import { canUseConnection, discoverTargets, publicConnection } from '@/lib/integrations';

// PATCH /api/integrations/connections/[id] — change label or credentials (re-tested)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session || !isManager(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  await dbConnect();
  if (!(await canUseConnection(session, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const doc = await IntegrationConnection.findById(id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json()) as { label?: string; baseUrl?: string; username?: string; customerId?: string; secret?: string };
  if (typeof body.label === 'string') doc.label = body.label.trim();
  const credsChanged = ['baseUrl', 'username', 'customerId', 'secret'].some((k) => typeof (body as Record<string, unknown>)[k] === 'string' && (body as Record<string, string>)[k].trim() !== '');
  if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) {
    if (!/^https:\/\//i.test(body.baseUrl.trim())) return NextResponse.json({ error: 'De URL moet met https:// beginnen' }, { status: 400 });
    doc.base_url = body.baseUrl.trim();
  }
  if (typeof body.username === 'string' && body.username.trim()) doc.username = body.username.trim();
  if (typeof body.customerId === 'string' && body.customerId.trim()) doc.customer_id = body.customerId.trim();
  if (typeof body.secret === 'string' && body.secret.trim()) doc.secret_enc = seal(body.secret.trim());

  if (credsChanged) {
    try {
      await discoverTargets(doc);
      doc.last_ok_at = new Date();
      doc.last_error = '';
    } catch (err) {
      return NextResponse.json({ error: `Verbinding mislukt: ${err instanceof Error ? err.message : String(err)}` }, { status: 422 });
    }
  }
  await doc.save();
  return NextResponse.json(publicConnection(doc.toObject()));
}

// DELETE /api/integrations/connections/[id] — also unlinks it from every carwash.
// Already fetched day figures stay (they were real figures).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session || !isManager(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  await dbConnect();
  const doc = await IntegrationConnection.findById(id).select('owner_id').lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Only its creator (or a developer) may remove it: it may serve other owners' sites
  if (session.role !== 'developer' && String((doc as { owner_id?: unknown }).owner_id) !== session.userId) {
    return NextResponse.json({ error: 'Alleen wie de koppeling aanmaakte kan ze verwijderen' }, { status: 403 });
  }
  await SiteIntegration.deleteMany({ connection_id: id });
  await IntegrationConnection.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
