import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { User } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import { sendPasswordResetEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';

function generateTempPassword(): string {
  // 12 random chars from an unambiguous alphabet (no 0/O/1/l/I)
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomFillSync(new Uint8Array(12)))
    .map((b) => alphabet[b % alphabet.length])
    .join('');
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'developer' && session.role !== 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();
  const { id } = await params;

  // Prevent any non-developer from removing site access from themselves
  const body = await req.json() as {
    role?: 'developer' | 'owner' | 'employee' | 'technician';
    siteIds?: string[];
    addSiteId?: string;
    removeSiteId?: string;
    name?: string;
    email?: string;
    newPassword?: string;
    resetPassword?: boolean;
    whatsapp?: string;
    is_active?: boolean;
  };

  if (session.role !== 'developer' && body.removeSiteId && id === session.userId) {
    return NextResponse.json({ error: 'Je kan je eigen toegang niet intrekken.' }, { status: 403 });
  }

  // Owners may only manage employees/technicians within their own sites — never
  // touch other owners/developers or assign roles/sites outside their scope.
  if (session.role === 'owner') {
    const target = await User.findById(id).select('role').lean();
    if (!target || (target.role !== 'employee' && target.role !== 'technician')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (body.role && body.role !== 'employee' && body.role !== 'technician') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const siteIdsToCheck = [
      ...(body.siteIds ?? []),
      ...(body.addSiteId ? [body.addSiteId] : []),
      ...(body.removeSiteId ? [body.removeSiteId] : []),
    ];
    if (siteIdsToCheck.some((sid) => !session.siteIds.includes(sid))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const update: Record<string, unknown> = {};
  const arrayOps: Record<string, unknown> = {};

  if (body.role)       update.role  = body.role;
  if (body.name)       update.name  = body.name.trim();
  if (body.email)      update.email = body.email.trim().toLowerCase();
  if (body.siteIds)    update.site_ids = body.siteIds.map((s) => new mongoose.Types.ObjectId(s));
  if (body.newPassword) update.password_hash = await bcrypt.hash(body.newPassword, 12);

  let tempPassword: string | null = null;
  if (body.resetPassword) {
    tempPassword = generateTempPassword();
    update.password_hash = await bcrypt.hash(tempPassword, 12);
  }
  if (body.whatsapp !== undefined) update.whatsapp = body.whatsapp.trim();
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.addSiteId)    arrayOps['$addToSet'] = { site_ids: new mongoose.Types.ObjectId(body.addSiteId) };
  if (body.removeSiteId) arrayOps['$pull']     = { site_ids: new mongoose.Types.ObjectId(body.removeSiteId) };

  // Losing access to a carwash (removeSiteId) can leave the account with no
  // site at all — schedule it for permanent deletion 30 days out. Re-adding
  // a site (here or later) clears the schedule again.
  if (body.removeSiteId || body.addSiteId || body.siteIds) {
    const current = await User.findById(id).select('site_ids').lean();
    const currentIds = ((current?.site_ids as mongoose.Types.ObjectId[]) ?? []).map((s) => s.toString());
    let resultingIds = body.siteIds ?? currentIds;
    if (body.removeSiteId) resultingIds = resultingIds.filter((s) => s !== body.removeSiteId);
    if (body.addSiteId && !resultingIds.includes(body.addSiteId)) resultingIds = [...resultingIds, body.addSiteId];

    if (resultingIds.length === 0) {
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      update.pending_deletion_at = in30Days;
    } else {
      update.pending_deletion_at = null;
    }
  }

  const setOp = Object.keys(update).length ? { $set: update } : {};
  const updated = await User.findByIdAndUpdate(id, { ...setOp, ...arrayOps }, { new: true }).select('name email').lean();

  if (tempPassword && updated) {
    sendPasswordResetEmail(updated.email as string, updated.name as string, tempPassword).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'developer') {
    return NextResponse.json({ error: 'Alleen een developer kan gebruikers verwijderen.' }, { status: 403 });
  }

  await dbConnect();
  const { id } = await params;

  if (id === session.userId) {
    return NextResponse.json({ error: 'Je kan je eigen account niet verwijderen.' }, { status: 403 });
  }

  await User.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
