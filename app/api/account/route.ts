import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { User } from '@/lib/models';
import bcrypt from 'bcryptjs';
import { sendPasswordChangedEmail } from '@/lib/email';
import { getSessionFromRequest } from '@/lib/session';

// PATCH /api/account — update the logged-in user's own e-mail, password or
// birthday. Always acts on the session's user, never on an id from the body.
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();

  const body = await req.json() as {
    email?: string;
    newPassword?: string;
    birthday?: string;
  };
  const { email, newPassword, birthday } = body;

  const updates: Record<string, string> = {};
  if (email) {
    const normalized = email.trim().toLowerCase();
    const taken = await User.findOne({ email: normalized, _id: { $ne: session.userId } }).select('_id').lean();
    if (taken) return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 409 });
    updates.email = normalized;
  }
  if (newPassword) updates.password_hash = await bcrypt.hash(newPassword, 12);
  if (typeof birthday === 'string') updates.birthday = birthday.trim();

  if (Object.keys(updates).length > 0) {
    const updatedUser = await User.findByIdAndUpdate(session.userId, { $set: updates }, { new: true });
    if (newPassword && updatedUser) {
      const notifyEmail = updates.email ?? updatedUser.email;
      sendPasswordChangedEmail(notifyEmail, updatedUser.name as string).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true });
}
