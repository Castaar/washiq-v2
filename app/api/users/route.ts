import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { User } from '@/lib/models';
import { getSessionFromRequest } from '@/lib/session';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail } from '@/lib/email';

const OWNER_CREATABLE_ROLES = ['employee', 'technician', 'owner'];

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'owner' && session.role !== 'developer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await dbConnect();

  const body = await req.json() as {
    siteIds?: string[];
    name?: string;
    email?: string;
    password?: string;
    role?: 'developer' | 'owner' | 'employee' | 'technician';
  };
  const { siteIds, name, email, password, role = 'employee' } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Naam, e-mail en wachtwoord zijn verplicht' }, { status: 400 });
  }

  if (session.role === 'owner') {
    if (!OWNER_CREATABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if ((siteIds ?? []).some((id) => !session.siteIds.includes(id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const existing = await User.findOne({ email: email.trim().toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: 'E-mailadres is al in gebruik' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const user = await User.create({
    site_ids: siteIds ?? [],
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password_hash,
    role,
  });

  sendWelcomeEmail(email.trim().toLowerCase(), name.trim(), password).catch(() => null);

  return NextResponse.json({ id: user._id.toString() }, { status: 201 });
}
