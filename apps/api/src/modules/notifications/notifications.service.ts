import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  filterGroups,
  listings,
  notificationPreferences,
  notifications,
  pushSubscriptions,
  type NotificationPreferences,
} from '../../db/schema.js';
import { NotFoundError } from '../../lib/errors.js';
import { paginate, type Pagination } from '../../lib/pagination.js';
import { dispatchNotification } from './dispatch.service.js';

export type NotificationType =
  | 'new_listing'
  | 'good_deal'
  | 'price_drop'
  | 'price_raise'
  | 'listing_removed'
  | 'fetch_failed'
  | 'digest';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  listingId?: string | null;
  groupId?: string | null;
  payload?: Record<string, unknown> | null;
}

export async function getPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (prefs) return prefs;

  // Older accounts (or seeds) may predate the preferences row.
  const [created] = await db
    .insert(notificationPreferences)
    .values({ userId })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  throw new NotFoundError('Nie znaleziono ustawień powiadomień');
}

export async function updatePreferences(
  userId: string,
  patch: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>,
): Promise<NotificationPreferences> {
  await getPreferences(userId);

  const [updated] = await db
    .update(notificationPreferences)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(notificationPreferences.userId, userId))
    .returning();

  if (!updated) throw new NotFoundError('Nie znaleziono ustawień powiadomień');
  return updated;
}

/**
 * Persists a notification, honouring the user's per-type toggles and quiet
 * hours, then fans it out to e-mail/push per the user's channel settings.
 *
 * The in-app row is written even during quiet hours (so it's there once the
 * user opens the bell); only the outbound e-mail/push dispatch is skipped
 * during that window; a digest is delivered instead once one is implemented.
 */
export async function notify(input: CreateNotificationInput): Promise<void> {
  const prefs = await getPreferences(input.userId);
  if (!isTypeEnabled(prefs, input.type)) return;
  if (!prefs.inAppEnabled) return;

  const quiet = isQuietHours(prefs);
  if (quiet && prefs.digestFrequency === 'off') return;

  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      channel: 'in_app',
      title: input.title.slice(0, 200),
      body: input.body ?? null,
      listingId: input.listingId ?? null,
      groupId: input.groupId ?? null,
      payload: input.payload ?? null,
    })
    .returning();

  if (!row || quiet) return;

  // Awaited so a fetch run only finishes after delivery is attempted, but
  // failures are caught inside dispatchNotification and never thrown here.
  await dispatchNotification(row, prefs);
}

export async function notifyMany(
  inputs: CreateNotificationInput[],
): Promise<void> {
  for (const input of inputs) await notify(input);
}

export async function listNotifications(
  userId: string,
  pagination: Pagination,
  onlyUnread = false,
) {
  const where = onlyUnread
    ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
    : eq(notifications.userId, userId);

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        channel: notifications.channel,
        title: notifications.title,
        body: notifications.body,
        listingId: notifications.listingId,
        groupId: notifications.groupId,
        payload: notifications.payload,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        // Carried along so the bell can link straight to the marketplace
        // without a second round-trip per notification.
        listingUrl: listings.url,
        listingProvider: listings.provider,
        groupName: filterGroups.name,
      })
      .from(notifications)
      .leftJoin(listings, eq(listings.id, notifications.listingId))
      .leftJoin(filterGroups, eq(filterGroups.id, notifications.groupId))
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(pagination.pageSize)
      .offset((pagination.page - 1) * pagination.pageSize),
    db.select({ value: count() }).from(notifications).where(where),
  ]);

  return paginate(rows, totals?.value ?? 0, pagination);
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

export async function markRead(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        inArray(notifications.id, ids),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });
  return rows.length;
}

export async function markAllRead(userId: string): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
}

export async function deleteNotification(
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.id, id)));
}

/* ------------------------------ push devices ----------------------------- */

export async function registerPushSubscription(
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: input.p256dh, auth: input.auth, lastUsedAt: new Date() },
    });
}

export async function removePushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );
}

export async function listPushSubscriptions(userId: string) {
  return db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      userAgent: pushSubscriptions.userAgent,
      createdAt: pushSubscriptions.createdAt,
      lastUsedAt: pushSubscriptions.lastUsedAt,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.createdAt));
}

/* -------------------------------- helpers -------------------------------- */

function isTypeEnabled(
  prefs: NotificationPreferences,
  type: NotificationType,
): boolean {
  switch (type) {
    case 'new_listing':
      return prefs.notifyNewListing;
    case 'good_deal':
      return prefs.notifyGoodDeal;
    case 'price_drop':
    case 'price_raise':
      return prefs.notifyPriceDrop;
    case 'listing_removed':
      return prefs.notifyListingRemoved;
    case 'fetch_failed':
      return prefs.notifyFetchFailed;
    default:
      return true;
  }
}

/** Window may wrap midnight, e.g. 22 -> 7. */
function isQuietHours(prefs: NotificationPreferences): boolean {
  const { quietHoursStart: start, quietHoursEnd: end } = prefs;
  if (start === null || end === null) return false;

  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: prefs.timezone,
    }).format(new Date()),
  );

  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function isPriceDropWorthNotifying(
  prefs: NotificationPreferences,
  deltaPct: number,
): boolean {
  return Math.abs(deltaPct) >= prefs.priceDropThresholdPct;
}

/**
 * `priceVsMarketPct` is negative for a below-median listing (see
 * `listings.service.ts`'s `priceVsMarketPctSql`) - a "good deal" is one far
 * enough below zero to clear the user's threshold.
 */
export function isGoodDealWorthNotifying(
  prefs: NotificationPreferences,
  priceVsMarketPct: number | null,
): boolean {
  return priceVsMarketPct !== null && priceVsMarketPct <= -prefs.goodDealThresholdPct;
}

export { sql };
