import { and, eq, inArray, lte, or, isNull, sql } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { db } from '../../db/client.js';
import {
  fetchRuns,
  filterGroups,
  filters,
  listings,
  type Filter,
} from '../../db/schema.js';
import { NotFoundError } from '../../lib/errors.js';
import { getSource } from '../../providers/registry.js';
import * as notificationsService from '../notifications/notifications.service.js';
import { deactivateStaleListings, ingestListings } from './ingest.service.js';

export type FetchTrigger = 'manual' | 'scheduler' | 'seed';

export interface FilterRunResult {
  filterId: string;
  filterName: string;
  status: 'success' | 'partial' | 'failed';
  pagesFetched: number;
  itemsSeen: number;
  itemsNew: number;
  itemsUpdated: number;
  newMatches: number;
  deactivated: number;
  error?: string;
}

export interface GroupRunResult {
  groupId: string;
  groupName: string;
  filters: FilterRunResult[];
  totalNew: number;
  totalSeen: number;
  durationMs: number;
}

/** Runs every active filter in a group and reports per-filter outcomes. */
export async function runGroup(
  groupId: string,
  userId: string,
  trigger: FetchTrigger = 'manual',
): Promise<GroupRunResult> {
  const startedAt = Date.now();

  const [group] = await db
    .select()
    .from(filterGroups)
    .where(and(eq(filterGroups.id, groupId), eq(filterGroups.userId, userId)))
    .limit(1);

  if (!group) throw new NotFoundError('Grupa filtrów nie istnieje');

  const groupFilters = await db
    .select()
    .from(filters)
    .where(and(eq(filters.groupId, groupId), eq(filters.isActive, true)));

  if (groupFilters.length === 0) {
    logger.info({ groupId }, 'Group has no active filters, nothing to fetch');
  }

  const results: FilterRunResult[] = [];
  for (const filter of groupFilters) {
    results.push(await runFilter(filter, group.id, userId, trigger, group.notifyOnNew));
  }

  // The previous marker moves up to where this run began, so "new since last
  // fetch" is measured against the run before this one.
  await db
    .update(filterGroups)
    .set({
      previousFetchedAt: new Date(startedAt),
      lastFetchedAt: new Date(),
    })
    .where(eq(filterGroups.id, groupId));

  return {
    groupId: group.id,
    groupName: group.name,
    filters: results,
    totalNew: results.reduce((sum, r) => sum + r.itemsNew, 0),
    totalSeen: results.reduce((sum, r) => sum + r.itemsSeen, 0),
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Executes one filter: pages through the provider, ingests each page, then
 * retires listings the provider no longer returns.
 */
export async function runFilter(
  filter: Filter,
  groupId: string,
  userId: string,
  trigger: FetchTrigger,
  notifyOnNew: boolean,
): Promise<FilterRunResult> {
  const runStartedAt = new Date();
  const label =
    filter.name ??
    ([filter.make, filter.model].filter(Boolean).join(' ') || 'Filtr');

  const [run] = await db
    .insert(fetchRuns)
    .values({
      provider: filter.provider,
      groupId,
      filterId: filter.id,
      status: 'running',
      trigger,
      startedAt: runStartedAt,
    })
    .returning({ id: fetchRuns.id });

  const result: FilterRunResult = {
    filterId: filter.id,
    filterName: label,
    status: 'success',
    pagesFetched: 0,
    itemsSeen: 0,
    itemsNew: 0,
    itemsUpdated: 0,
    newMatches: 0,
    deactivated: 0,
  };

  const newListingIds: string[] = [];
  const priceDrops: Array<{ listingId: string; from: number; to: number; deltaPct: number }> = [];

  try {
    const source = getSource(filter.provider);
    if (!source.isConfigured()) {
      throw new Error(`Dostawca ${filter.provider} nie jest skonfigurowany`);
    }

    for (let page = 1; page <= env.FETCH_MAX_PAGES; page += 1) {
      const searchResult = await source.search(filter, {
        page,
        pageSize: env.FETCH_PAGE_SIZE,
      });

      const summary = await ingestListings(
        searchResult.items,
        { filterId: filter.id, groupId, userId },
        (page - 1) * env.FETCH_PAGE_SIZE,
      );

      result.pagesFetched = page;
      result.itemsSeen += summary.seen;
      result.itemsNew += summary.created;
      result.itemsUpdated += summary.updated;
      result.newMatches += summary.newMatches;

      newListingIds.push(...summary.newListings.map((o) => o.listingId));
      for (const drop of summary.priceDrops) {
        if (drop.priceChange) {
          priceDrops.push({ listingId: drop.listingId, ...drop.priceChange });
        }
      }

      if (!searchResult.hasNextPage || searchResult.items.length === 0) break;
    }

    result.deactivated = await deactivateStaleListings(filter.id, runStartedAt);
  } catch (err) {
    result.status = 'failed';
    result.error = err instanceof Error ? err.message : String(err);
    logger.error({ err, filterId: filter.id }, 'Filter run failed');

    await notificationsService.notify({
      userId,
      type: 'fetch_failed',
      title: `Nie udało się pobrać ofert: ${label}`,
      body: result.error,
      groupId,
    });
  }

  const finishedAt = new Date();
  if (run) {
    await db
      .update(fetchRuns)
      .set({
        status: result.status,
        pagesFetched: result.pagesFetched,
        itemsSeen: result.itemsSeen,
        itemsNew: result.itemsNew,
        itemsUpdated: result.itemsUpdated,
        errorMessage: result.error ?? null,
        finishedAt,
        durationMs: finishedAt.getTime() - runStartedAt.getTime(),
      })
      .where(eq(fetchRuns.id, run.id));
  }

  if (result.status === 'success') {
    await emitListingNotifications(userId, groupId, label, {
      notifyOnNew,
      newListingIds,
      priceDrops,
    });
  }

  return result;
}

async function emitListingNotifications(
  userId: string,
  groupId: string,
  filterLabel: string,
  data: {
    notifyOnNew: boolean;
    newListingIds: string[];
    priceDrops: Array<{ listingId: string; from: number; to: number; deltaPct: number }>;
  },
): Promise<void> {
  const prefs = await notificationsService.getPreferences(userId);

  if (data.notifyOnNew && data.newListingIds.length > 0) {
    // A run can surface dozens of cars; announce a handful individually and
    // roll the rest into one summary so the bell stays usable.
    const detailed = data.newListingIds.slice(0, 5);
    const rows = await db
      .select({ id: listings.id, title: listings.title, price: listings.price })
      .from(listings)
      .where(inArray(listings.id, detailed));

    for (const row of rows) {
      await notificationsService.notify({
        userId,
        type: 'new_listing',
        title: `Nowa oferta: ${row.title}`,
        body: row.price ? `${formatPln(row.price)} — filtr "${filterLabel}"` : filterLabel,
        listingId: row.id,
        groupId,
      });
    }

    const remaining = data.newListingIds.length - rows.length;
    if (remaining > 0) {
      await notificationsService.notify({
        userId,
        type: 'new_listing',
        title: `${remaining} kolejnych nowych ofert`,
        body: `Filtr "${filterLabel}"`,
        groupId,
        payload: { count: remaining },
      });
    }
  }

  for (const drop of data.priceDrops) {
    if (!notificationsService.isPriceDropWorthNotifying(prefs, drop.deltaPct)) {
      continue;
    }
    const [row] = await db
      .select({ title: listings.title })
      .from(listings)
      .where(eq(listings.id, drop.listingId))
      .limit(1);

    await notificationsService.notify({
      userId,
      type: 'price_drop',
      title: `Spadek ceny: ${row?.title ?? 'oferta'}`,
      body: `${formatPln(drop.from)} → ${formatPln(drop.to)} (${drop.deltaPct.toFixed(1)}%)`,
      listingId: drop.listingId,
      groupId,
      payload: { from: drop.from, to: drop.to, deltaPct: drop.deltaPct },
    });
  }
}

/**
 * Picks the groups whose refresh interval has elapsed. Used by the scheduler so
 * a group set to "co 6 h" is not hit on every cron tick.
 */
export async function runDueGroups(): Promise<GroupRunResult[]> {
  const due = await db
    .select({
      id: filterGroups.id,
      userId: filterGroups.userId,
      name: filterGroups.name,
    })
    .from(filterGroups)
    .where(
      and(
        eq(filterGroups.isActive, true),
        or(
          isNull(filterGroups.lastFetchedAt),
          lte(
            filterGroups.lastFetchedAt,
            sql`now() - (${filterGroups.refreshIntervalMinutes} || ' minutes')::interval`,
          ),
        ),
      ),
    );

  logger.info({ count: due.length }, 'Scheduler: groups due for refresh');

  const results: GroupRunResult[] = [];
  for (const group of due) {
    try {
      results.push(await runGroup(group.id, group.userId, 'scheduler'));
    } catch (err) {
      logger.error({ err, groupId: group.id }, 'Scheduled group run failed');
    }
  }
  return results;
}

function formatPln(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(value);
}
