import webpush from 'web-push';
import { pushConfigured, env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { db } from '../../db/client.js';
import { pushSubscriptions } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { Notification } from '../../db/schema.js';

let configured = false;

function ensureConfigured(): boolean {
  if (!pushConfigured) return false;
  if (!configured) {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY!,
      env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return true;
}

export interface PushPayload {
  notification: Pick<Notification, 'type' | 'title' | 'body'>;
  /** Where a click on the notification should land. */
  url: string;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends one push message to every device the user has registered.
 *
 * A subscription can go stale at any time (browser uninstalled, permission
 * revoked) - the push service then answers 404/410, which is the signal to
 * delete that row rather than keep retrying it forever.
 */
export async function sendPushNotification(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!ensureConfigured()) {
    throw new Error('VAPID nie jest skonfigurowane (brak kluczy)');
  }
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify({
    title: payload.notification.title,
    body: payload.notification.body ?? '',
    url: payload.url,
    tag: payload.notification.type,
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        sent += 1;
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
      } catch (err) {
        failed += 1;
        const statusCode = (err as { statusCode?: number }).statusCode;

        if (statusCode === 404 || statusCode === 410) {
          logger.info(
            { endpoint: sub.endpoint.slice(0, 60) },
            'Subskrypcja push wygasła, usuwam',
          );
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        } else {
          logger.warn({ err, endpoint: sub.endpoint.slice(0, 60) }, 'Push nie powiódł się');
        }
      }
    }),
  );

  if (sent === 0 && failed > 0) {
    throw new Error(`Wszystkie ${failed} wysyłki push nie powiodły się`);
  }

  return { sent, failed };
}
