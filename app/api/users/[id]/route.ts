import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { User } from '@/lib/models';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await dbConnect();
  const { id } = await params;
  const body = await req.json() as {
    role?: 'developer' | 'owner' | 'employee';
    siteIds?: string[];
    addSiteId?: string;
    removeSiteId?: string;
    name?: string;
    email?: string;
    newPassword?: string;
  };

  const update: Record<string, unknown> = {};
  const arrayOps: Record<string, unknown> = {};

  if (body.role)       update.role  = body.role;
  if (body.name)       update.name  = body.name.trim();
  if (body.email)      update.email = body.email.trim().toLowerCase();
  if (body.siteIds)    update.site_ids = body.siteIds.map((s) => new mongoose.Types.ObjectId(s));
  if (body.newPassword) update.password_hash = await bcrypt.hash(body.newPassword, 12);
  if (body.addSiteId)    arrayOps['$addToSet'] = { site_ids: new mongoose.Types.ObjectId(body.addSiteId) };
  if (body.removeSiteId) arrayOps['$pull']     = { site_ids: new mongoose.Types.ObjectId(body.removeSiteId) };

  const setOp = Object.keys(update).length ? { $set: update } : {};
  await User.findByIdAndUpdate(id, { ...setOp, ...arrayOps });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await dbConnect();
  const { id } = await params;
  await User.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
