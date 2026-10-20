import { NextRequest, NextResponse } from 'next/server';
import type { Types } from 'mongoose';
import { dbConnect } from '@/lib/db/mongoose';
import { User } from '@/lib/models';
import { getSessionFromRequest, signSession, sessionCookieOptions } from '@/lib/session';

// POST /api/demo/switch { role } — demo sessions only: continue as the demo
// account of another role (eigenaar / technieker / werknemer).
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.demo) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { role } = (await req.json()) as { role?: string };
  if (role !== 'owner' && role !== 'technician' && role !== 'employee') {
    return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 });
  }

  await dbConnect();
  const user = await User.findOne({ is_demo: true, role, is_active: { $ne: false } });
  if (!user) return NextResponse.json({ error: 'Demo-account niet gevonden' }, { status: 404 });

  const token = await signSession({
    userId: (user._id as Types.ObjectId).toString(),
    name: user.name as string,
    email: user.email as string,
    role: user.role as 'owner' | 'technician' | 'employee',
    siteIds: ((user.site_ids as Types.ObjectId[]) ?? []).map((id) => id.toString()),
    demo: true,
  });

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}
