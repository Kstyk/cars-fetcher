import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { filterGroups, filters, listingMatches, listings, listingViews } from '../../db/schema.js';

export interface FilterUsageStat {
  filterId: string;
  filterName: string | null;
  make: string | null;
  model: string | null;
  provider: string;
  createdAt: string;
  groupId: string;
  groupName: string;
  groupColor: string | null;
  /** Distinct listings this filter has ever matched. */
  totalMatches: number;
  /** Of those, how many are still active and not archived (sold). */
  activeMatches: number;
  /** How many times *this user* clicked through to a listing this filter matched. */
  totalViews: number;
  /** When this filter most recently matched a listing it had never matched before - not just re-confirmed one it already knew. */
  lastNewMatchAt: string | null;
  daysSinceLastNewMatch: number | null;
  /**
   * No new find in three weeks, past a three-day grace period for filters
   * that are simply new. Not a verdict on the filter's criteria alone - a
   * paused group or a stopped scheduler looks identical from here, this
   * only reports what happened, not why.
   */
  isDead: boolean;
}

const GRACE_PERIOD_DAYS = 3;
const DEAD_THRESHOLD_DAYS = 21;

/**
 * One row per filter the user owns (across every group), with match and
 * click-through counts - "which filters actually pull their weight" needs
 * both: a filter that matches 50 listings nobody ever clicks is as much of
 * a signal as one that has not found anything new in a month.
 */
export async function getFilterUsageStats(userId: string): Promise<FilterUsageStat[]> {
  const rows = await db
    .select({
      filterId: filters.id,
      filterName: filters.name,
      make: filters.make,
      model: filters.model,
      provider: filters.provider,
      createdAt: filters.createdAt,
      groupId: filterGroups.id,
      groupName: filterGroups.name,
      groupColor: filterGroups.color,
      totalMatches: sql<number>`count(distinct ${listingMatches.listingId})`.mapWith(Number),
      activeMatches: sql<number>`count(distinct ${listingMatches.listingId}) filter (
        where ${listings.isActive} and not ${listings.isArchived}
      )`.mapWith(Number),
      totalViews: sql<number>`coalesce(sum(${listingViews.viewCount}), 0)`.mapWith(Number),
      lastNewMatchAt: sql<string | null>`max(${listingMatches.firstMatchedAt})`.mapWith((v) =>
        v === null ? null : new Date(v).toISOString(),
      ),
    })
    .from(filters)
    .innerJoin(filterGroups, eq(filterGroups.id, filters.groupId))
    .leftJoin(listingMatches, eq(listingMatches.filterId, filters.id))
    .leftJoin(listings, eq(listings.id, listingMatches.listingId))
    .leftJoin(
      listingViews,
      sql`${listingViews.listingId} = ${listingMatches.listingId} and ${listingViews.userId} = ${userId}`,
    )
    .where(eq(filterGroups.userId, userId))
    .groupBy(filters.id, filterGroups.id)
    .orderBy(filterGroups.name, filters.createdAt);

  const now = Date.now();
  const daysSince = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 86_400_000);

  return rows.map((row) => {
    const daysSinceLastNewMatch = row.lastNewMatchAt ? daysSince(row.lastNewMatchAt) : null;
    const pastGracePeriod = daysSince(row.createdAt.toISOString()) > GRACE_PERIOD_DAYS;
    const noRecentNewMatch =
      daysSinceLastNewMatch === null || daysSinceLastNewMatch > DEAD_THRESHOLD_DAYS;

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      daysSinceLastNewMatch,
      isDead: pastGracePeriod && noRecentNewMatch,
    };
  });
}
