import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbConnect } from '@/lib/db/mongoose';
import { PushSubscription } from '@/lib/models';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, keys } = body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  await dbConnect();

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      endpoint,
      keys,
      user_id: session.userId,
      site_ids: session.siteIds,
      created_at: new Date(),
    },
    { upsert: true, new: true },
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint } = body as { endpoint: string };

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  await dbConnect();
  await PushSubscription.deleteOne({ endpoint, user_id: session.userId });

  return NextResponse.json({ ok: true });
}
