import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongoose';
import { User } from '@/lib/models';
import { getSession } from '@/lib/session';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });

  await dbConnect();
  await User.findByIdAndUpdate(session.userId, { help_seen: true });

  return NextResponse.json({ ok: true });
}
