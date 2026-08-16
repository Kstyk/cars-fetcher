import { eq } from 'drizzle-orm';
import { emailConfigured, env, pushConfigured, telegramConfigured } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { db } from '../../db/client.js';
import {
  notifications,
  pushSubscriptions,
  users,
  type Notification,
  type NotificationPreferences,
} from '../../db/schema.js';
import { sendTelegramNotification } from '../telegram/telegram-link.service.js';
import { sendNotificationEmail } from './email.service.js';
import { sendPushNotification } from './push.service.js';

/**
 * Fans a freshly-inserted in-app notification out to e-mail and push, per the
 * user's channel preferences. Called right after `notify()` inserts the row.
 *
 * Delivery failures are caught and recorded on the row (`emailError`,
 * `pushError`) rather than thrown - a dead SMTP server or an expired push
 * subscription must never fail the fetch run that triggered the notification.
 */
export async function dispatchNotification(
  notification: Notification,
  prefs: NotificationPreferences,
): Promise<void> {
  const jobs: Promise<void>[] = [];

  if (prefs.emailEnabled) jobs.push(dispatchEmail(notification));
  if (prefs.pushEnabled) jobs.push(dispatchPush(notification));
  if (prefs.telegramEnabled) jobs.push(dispatchTelegram(notification, prefs));

  if (jobs.length === 0) return;
  await Promise.all(jobs);
}

async function dispatchEmail(notification: Notification): Promise<void> {
  if (!emailConfigured) return;

  try {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, notification.userId))
      .limit(1);
    if (!user) return;

    await sendNotificationEmail({
      to: user.email,
      notification,
      actionUrl: buildActionUrl(notification),
      actionLabel: notification.listingId ? 'Zobacz ofertę' : 'Otwórz aplikację',
    });

    await db
      .update(notifications)
      .set({ emailSentAt: new Date(), emailError: null })
      .where(eq(notifications.id, notification.id));
  } catch (err) {
    logger.warn({ err, notificationId: notification.id }, 'Wysyłka e-mail nie powiodła się');
    await db
      .update(notifications)
      .set({ emailError: String(err instanceof Error ? err.message : err).slice(0, 500) })
      .where(eq(notifications.id, notification.id));
  }
}

async function dispatchPush(notification: Notification): Promise<void> {
  if (!pushConfigured) return;

  try {
    const subs = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, notification.userId));

    if (subs.length === 0) return;

    await sendPushNotification(subs, {
      notification,
      url: buildActionUrl(notification),
    });

    await db
      .update(notifications)
      .set({ pushSentAt: new Date(), pushError: null })
      .where(eq(notifications.id, notification.id));
  } catch (err) {
    logger.warn({ err, notificationId: notification.id }, 'Wysyłka push nie powiodła się');
    await db
      .update(notifications)
      .set({ pushError: String(err instanceof Error ? err.message : err).slice(0, 500) })
      .where(eq(notifications.id, notification.id));
  }
}

async function dispatchTelegram(
  notification: Notification,
  prefs: NotificationPreferences,
): Promise<void> {
  if (!telegramConfigured || !prefs.telegramChatId) return;

  try {
    await sendTelegramNotification(prefs.telegramChatId, buildTelegramText(notification));

    await db
      .update(notifications)
      .set({ telegramSentAt: new Date(), telegramError: null })
      .where(eq(notifications.id, notification.id));
  } catch (err) {
    logger.warn({ err, notificationId: notification.id }, 'Wysyłka Telegram nie powiodła się');
    await db
      .update(notifications)
      .set({ telegramError: String(err instanceof Error ? err.message : err).slice(0, 500) })
      .where(eq(notifications.id, notification.id));
  }
}

function buildTelegramText(notification: Notification): string {
  const lines = [`<b>${escapeHtml(notification.title)}</b>`];
  if (notification.body) lines.push(escapeHtml(notification.body));
  lines.push(buildActionUrl(notification));
  return lines.join('\n\n');
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Deep link the e-mail button / push click should open. */
function buildActionUrl(notification: Notification): string {
  if (notification.groupId) {
    return `${env.APP_URL}/listings?groupId=${notification.groupId}`;
  }
  return `${env.APP_URL}/notifications`;
}
