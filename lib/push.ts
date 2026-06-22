import webpush from 'web-push';
import { dbConnect } from './db/mongoose';
import { PushSubscription } from './models';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

async function sendToSubscriptions(
  subscriptions: Awaited<ReturnType<typeof PushSubscription.find>>,
  data: string,
) {
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          data,
        );
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err) {
          const status = (err as { statusCode: number }).statusCode;
          if (status === 404 || status === 410) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
        }
      }
    }),
  );
}

/**
 * Send a push notification to a specific user across all their devices.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  await dbConnect();
  const subscriptions = await PushSubscription.find({ user_id: userId });
  if (!subscriptions.length) return;
  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    icon: payload.icon ?? '/icons/icon-192.png',
  });
  await sendToSubscriptions(subscriptions, data);
}

/**
 * Send a push notification to every subscriber across all sites.
 * Used for problems that everyone in the company should know about instantly.
 */
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  await dbConnect();

  const subscriptions = await PushSubscription.find({});
  if (!subscriptions.length) return;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    icon: payload.icon ?? '/icons/icon-192.png',
  });

  await sendToSubscriptions(subscriptions, data);
}

export async function sendPushToSite(
  siteId: string,
  payload: PushPayload,
): Promise<void> {
  await dbConnect();

  const subscriptions = await PushSubscription.find({ site_ids: siteId });
  if (!subscriptions.length) return;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    icon: payload.icon ?? '/icons/icon-192.png',
  });

  await sendToSubscriptions(subscriptions, data);
}
