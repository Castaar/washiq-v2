import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { User } from '@/lib/models';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  await dbConnect();

  const body = await req.json() as {
    siteIds?: string[];
    name?: string;
    email?: string;
    password?: string;
    role?: 'developer' | 'owner' | 'employee';
  };
  const { siteIds, name, email, password, role = 'employee' } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Naam, e-mail en wachtwoord zijn verplicht' }, { status: 400 });
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

  return NextResponse.json({ id: user._id.toString() }, { status: 201 });
}
