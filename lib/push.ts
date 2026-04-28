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

/**
 * Send a push notification to all subscribers for a given site.
 * Silently removes subscriptions that are no longer valid (410 Gone).
 */
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

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          data,
        );
      } catch (err: unknown) {
        // If subscription is expired/unsubscribed, remove it
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
