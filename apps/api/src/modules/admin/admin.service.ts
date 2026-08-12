import { and, count, desc, eq, ne, sql } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { fetchRuns, filterGroups, filters, listings, users } from '../../db/schema.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { scrapingClient } from '../../providers/scraping/http-client.js';
import type { UpdateUserInput } from './admin.schemas.js';

export async function getStats() {
  const [[userTotals], [listingTotals], [groupTotals], byProvider] = await Promise.all([
    db
      .select({
        total: count(),
        active: count(sql`case when ${users.isActive} then 1 end`),
        admins: count(sql`case when ${users.role} = 'admin' then 1 end`),
      })
      .from(users),

    db
      .select({
        total: count(),
        active: count(sql`case when ${listings.isActive} and not ${listings.isArchived} then 1 end`),
        archived: count(sql`case when ${listings.isArchived} then 1 end`),
      })
      .from(listings),

    db.select({ total: count() }).from(filterGroups),

    db
      .select({ provider: listings.provider, total: count() })
      .from(listings)
      .groupBy(listings.provider)
      .orderBy(desc(count())),
  ]);

  return {
    users: userTotals,
    listings: listingTotals,
    groups: groupTotals,
    byProvider,
    scheduler: { enabled: env.SCHEDULER_ENABLED, cron: env.SCHEDULER_CRON },
  };
}

export async function listUsers() {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      isActive: users.isActive,
      emailVerifiedAt: users.emailVerifiedAt,
      hasPassword: sql<boolean>`${users.passwordHash} is not null`.mapWith(Boolean),
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      groupCount: sql<number>`(
        select count(*) from filter_groups g where g.user_id = users.id
      )`.mapWith(Number),
      favoriteCount: sql<number>`(
        select count(*) from favorites f where f.user_id = users.id
      )`.mapWith(Number),
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

/** Promote/demote a role or block/unblock a user - never the caller's own account. */
export async function updateUser(
  adminId: string,
  targetUserId: string,
  patch: UpdateUserInput,
): Promise<void> {
  if (targetUserId === adminId) {
    throw new ForbiddenError('Nie możesz zmienić własnej roli ani zablokować siebie');
  }

  const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!target) throw new NotFoundError('Użytkownik nie istnieje');

  if (patch.role === 'user' && target.role === 'admin') {
    const [otherAdmins] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), ne(users.id, targetUserId)));
    if ((otherAdmins?.value ?? 0) === 0) {
      throw new BadRequestError('To jedyne konto administratora - nie ma komu przekazać roli');
    }
  }

  await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, targetUserId));
}

export function listScraperCircuits() {
  return scrapingClient.getCircuitStatus().map((entry) => ({
    ...entry,
    blocked: entry.openUntil !== null && entry.openUntil > Date.now(),
  }));
}

export function resetScraperCircuit(host: string): boolean {
  return scrapingClient.resetCircuit(host);
}

/** Fetch runs across every user's groups - an ops view, not the per-group one. */
export async function listRecentRuns(limit = 50) {
  return db
    .select({
      id: fetchRuns.id,
      provider: fetchRuns.provider,
      status: fetchRuns.status,
      trigger: fetchRuns.trigger,
      itemsSeen: fetchRuns.itemsSeen,
      itemsNew: fetchRuns.itemsNew,
      errorMessage: fetchRuns.errorMessage,
      startedAt: fetchRuns.startedAt,
      durationMs: fetchRuns.durationMs,
      groupName: filterGroups.name,
      filterName: filters.name,
      filterMake: filters.make,
      filterModel: filters.model,
      ownerEmail: users.email,
    })
    .from(fetchRuns)
    .leftJoin(filterGroups, eq(filterGroups.id, fetchRuns.groupId))
    .leftJoin(filters, eq(filters.id, fetchRuns.filterId))
    .leftJoin(users, eq(users.id, filterGroups.userId))
    .orderBy(desc(fetchRuns.startedAt))
    .limit(limit);
}
