import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { User } from '@/lib/models';
import bcrypt from 'bcryptjs';
import type { Types } from 'mongoose';
import { signSession, sessionCookieOptions } from '@/lib/session';

export async function POST(req: NextRequest) {
  await dbConnect();

  const body = await req.json() as { email?: string; password?: string };
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Vul alle velden in' }, { status: 400 });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (!user) {
    return NextResponse.json({ error: 'Gebruikersnaam of wachtwoord onjuist' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash as string);
  if (!valid) {
    return NextResponse.json({ error: 'Gebruikersnaam of wachtwoord onjuist' }, { status: 401 });
  }

  const siteIds = ((user.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString());

  const token = await signSession({
    userId: (user._id as Types.ObjectId).toString(),
    name: user.name as string,
    email: user.email as string,
    role: user.role as 'developer' | 'owner' | 'employee',
    siteIds,
  });

  const res = NextResponse.json({
    ok: true,
    role: user.role,
    siteIds,
    helpSeen: !!(user.help_seen),
  });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
