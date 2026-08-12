import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  sql,
} from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  fetchRuns,
  filterGroups,
  filters,
  listingMatches,
  listings,
  notifications,
  type Filter,
  type FilterGroup,
} from '../../db/schema.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { buildFilterMatchCondition } from './filter-match.js';
import type { CreateGroupInput, FilterInput } from './filters.schemas.js';

export interface GroupWithStats extends FilterGroup {
  filters: Filter[];
  listingCount: number;
  newListingCount: number;
  lastRun: {
    status: string;
    finishedAt: Date | null;
    itemsNew: number;
  } | null;
}

export async function listGroups(userId: string): Promise<GroupWithStats[]> {
  const groups = await db
    .select()
    .from(filterGroups)
    .where(eq(filterGroups.userId, userId))
    .orderBy(asc(filterGroups.position), asc(filterGroups.createdAt));

  if (groups.length === 0) return [];

  const groupIds = groups.map((g) => g.id);

  const [groupFilters, counts, lastRuns] = await Promise.all([
    db
      .select()
      .from(filters)
      .where(inArray(filters.groupId, groupIds))
      .orderBy(asc(filters.createdAt)),

    db
      .select({
        groupId: listingMatches.groupId,
        // Distinct on the listing, not a plain row count: two now-deleted
        // filters that had both matched the same listing each leave their
        // own orphaned (filterId null) row behind, which would otherwise
        // double-count that one car.
        total: countDistinct(listingMatches.listingId),
        /*
         * "New" = discovered since the previous fetch, so each completed run
         * clears the badge.
         *
         * It used to count everything matched within 24 h, which for a group
         * created today meant every single row - "+535 new" on 535 offers.
         * Groups that never ran twice have no marker yet; there the publication
         * date is the closest honest answer.
         */
        fresh: sql<number>`count(distinct ${listingMatches.listingId}) filter (
          where ${listingMatches.firstMatchedAt} > coalesce(
            ${filterGroups.previousFetchedAt},
            now() - interval '24 hours'
          )
        )`.mapWith(Number),
      })
      .from(listingMatches)
      .innerJoin(listings, eq(listings.id, listingMatches.listingId))
      // Needed for `previous_fetched_at`, the cut-off the "new" count uses.
      .innerJoin(filterGroups, eq(filterGroups.id, listingMatches.groupId))
      .where(
        and(inArray(listingMatches.groupId, groupIds), eq(listings.isActive, true)),
      )
      .groupBy(listingMatches.groupId, filterGroups.previousFetchedAt),

    db
      .selectDistinctOn([fetchRuns.groupId], {
        groupId: fetchRuns.groupId,
        status: fetchRuns.status,
        finishedAt: fetchRuns.finishedAt,
        itemsNew: fetchRuns.itemsNew,
      })
      .from(fetchRuns)
      .where(inArray(fetchRuns.groupId, groupIds))
      .orderBy(fetchRuns.groupId, desc(fetchRuns.startedAt)),
  ]);

  const filtersByGroup = new Map<string, Filter[]>();
  for (const filter of groupFilters) {
    const bucket = filtersByGroup.get(filter.groupId) ?? [];
    bucket.push(filter);
    filtersByGroup.set(filter.groupId, bucket);
  }

  const countsByGroup = new Map(counts.map((c) => [c.groupId, c]));
  const runsByGroup = new Map(lastRuns.map((r) => [r.groupId, r]));

  return groups.map((group) => {
    const stats = countsByGroup.get(group.id);
    const run = runsByGroup.get(group.id);
    return {
      ...group,
      filters: filtersByGroup.get(group.id) ?? [],
      listingCount: stats?.total ?? 0,
      newListingCount: stats?.fresh ?? 0,
      lastRun: run
        ? { status: run.status, finishedAt: run.finishedAt, itemsNew: run.itemsNew }
        : null,
    };
  });
}

export async function getGroup(
  userId: string,
  groupId: string,
): Promise<GroupWithStats> {
  const groups = await listGroups(userId);
  const group = groups.find((g) => g.id === groupId);
  if (!group) throw new NotFoundError('Grupa filtrów nie istnieje');
  return group;
}

export async function createGroup(
  userId: string,
  input: CreateGroupInput,
): Promise<GroupWithStats> {
  const [duplicate] = await db
    .select({ id: filterGroups.id })
    .from(filterGroups)
    .where(and(eq(filterGroups.userId, userId), eq(filterGroups.name, input.name)))
    .limit(1);

  if (duplicate) {
    throw new ConflictError('Grupa o tej nazwie już istnieje');
  }

  const [{ value: existingCount } = { value: 0 }] = await db
    .select({ value: count() })
    .from(filterGroups)
    .where(eq(filterGroups.userId, userId));

  const groupId = await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(filterGroups)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        isActive: input.isActive,
        notifyOnNew: input.notifyOnNew,
        refreshIntervalMinutes: input.refreshIntervalMinutes,
        position: existingCount,
      })
      .returning({ id: filterGroups.id });

    if (!group) throw new Error('Nie udało się utworzyć grupy');

    if (input.filters.length > 0) {
      await tx
        .insert(filters)
        .values(input.filters.map((f) => toFilterRow(f, group.id)));
    }

    return group.id;
  });

  return getGroup(userId, groupId);
}

export async function updateGroup(
  userId: string,
  groupId: string,
  patch: Partial<Omit<CreateGroupInput, 'filters'>>,
): Promise<GroupWithStats> {
  await assertGroupOwner(userId, groupId);

  const [updated] = await db
    .update(filterGroups)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
      ...(patch.color !== undefined ? { color: patch.color ?? null } : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon ?? null } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.notifyOnNew !== undefined ? { notifyOnNew: patch.notifyOnNew } : {}),
      ...(patch.refreshIntervalMinutes !== undefined
        ? { refreshIntervalMinutes: patch.refreshIntervalMinutes }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(filterGroups.id, groupId))
    .returning({ id: filterGroups.id });

  if (!updated) throw new NotFoundError('Grupa filtrów nie istnieje');
  return getGroup(userId, groupId);
}

export async function deleteGroup(userId: string, groupId: string): Promise<void> {
  await assertGroupOwner(userId, groupId);
  await db.delete(filterGroups).where(eq(filterGroups.id, groupId));
}

/**
 * Folds one or more groups into `targetGroupId`: their filters move over (so
 * they keep fetching, now under the target's schedule/notification
 * settings), and so does everything that points at them - matches, fetch
 * history, notifications - before the now-empty source groups are deleted.
 * Nothing is re-created and no listing is touched; this only repoints
 * ownership, the same "history survives, only the container changes" idea
 * `removeStaleMatches`/the filter-delete fix already lean on elsewhere in
 * this module.
 */
export async function mergeGroups(
  userId: string,
  targetGroupId: string,
  sourceGroupIds: string[],
): Promise<GroupWithStats> {
  const sources = [...new Set(sourceGroupIds)].filter((id) => id !== targetGroupId);
  if (sources.length === 0) {
    throw new ConflictError('Wskaż co najmniej jedną inną grupę do scalenia');
  }

  const owned = await db
    .select({ id: filterGroups.id })
    .from(filterGroups)
    .where(
      and(inArray(filterGroups.id, [targetGroupId, ...sources]), eq(filterGroups.userId, userId)),
    );

  if (owned.length !== sources.length + 1) {
    throw new NotFoundError('Jedna z grup nie istnieje');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(filters)
      .set({ groupId: targetGroupId })
      .where(inArray(filters.groupId, sources));
    await tx
      .update(listingMatches)
      .set({ groupId: targetGroupId })
      .where(inArray(listingMatches.groupId, sources));
    await tx
      .update(fetchRuns)
      .set({ groupId: targetGroupId })
      .where(inArray(fetchRuns.groupId, sources));
    await tx
      .update(notifications)
      .set({ groupId: targetGroupId })
      .where(inArray(notifications.groupId, sources));
    await tx.delete(filterGroups).where(inArray(filterGroups.id, sources));
  });

  return getGroup(userId, targetGroupId);
}

export async function addFilter(
  userId: string,
  groupId: string,
  input: FilterInput,
): Promise<Filter> {
  await assertGroupOwner(userId, groupId);

  const [created] = await db
    .insert(filters)
    .values(toFilterRow(input, groupId))
    .returning();

  if (!created) throw new Error('Nie udało się dodać filtra');
  return created;
}

export async function updateFilter(
  userId: string,
  groupId: string,
  filterId: string,
  input: FilterInput,
): Promise<Filter> {
  await assertGroupOwner(userId, groupId);

  const [updated] = await db
    .update(filters)
    .set({ ...toFilterRow(input, groupId), updatedAt: new Date() })
    .where(and(eq(filters.id, filterId), eq(filters.groupId, groupId)))
    .returning();

  if (!updated) throw new NotFoundError('Filtr nie istnieje');
  return updated;
}

export async function deleteFilter(
  userId: string,
  groupId: string,
  filterId: string,
): Promise<void> {
  await assertGroupOwner(userId, groupId);
  const deleted = await db
    .delete(filters)
    .where(and(eq(filters.id, filterId), eq(filters.groupId, groupId)))
    .returning({ id: filters.id });

  if (deleted.length === 0) throw new NotFoundError('Filtr nie istnieje');
}

/**
 * Drops matches the user no longer wants to see, two kinds at once:
 *
 * 1. The listing no longer satisfies its filter's *current* criteria - a
 *    filter edited after the fact (price ceiling lowered, a fuel type
 *    unchecked, ...). Nothing else ever re-evaluates an existing match,
 *    since a fetch only adds/refreshes matches for what it just found.
 * 2. The filter itself is gone entirely (`filterId IS NULL` - see the schema
 *    doc comment on `listingMatches.filterId`). Deleting a filter leaves its
 *    old finds reachable on purpose, in case they are still wanted; this is
 *    the deliberate, on-demand way to say "no, I'm done with those too" -
 *    e.g. dropped the Alfa Romeo filter and do not want its old matches
 *    hanging around either.
 *
 * Either way, only the match link goes - never the listing itself, never
 * `isArchived`. The car may still be for sale, it just stopped being (or
 * outright stopped being asked to be) what this group is looking for. A
 * listing left with no match anywhere (this was its only one) simply stops
 * showing up anywhere in the app, which is the point - it is not "sold", so
 * it must not carry that badge.
 */
export async function removeStaleMatches(
  userId: string,
  groupId: string,
): Promise<{ removed: number; checkedFilters: number }> {
  await assertGroupOwner(userId, groupId);

  const groupFilters = await db
    .select()
    .from(filters)
    .where(eq(filters.groupId, groupId));

  let removed = 0;
  for (const filter of groupFilters) {
    const stillMatching = db
      .select({ id: listings.id })
      .from(listings)
      .where(buildFilterMatchCondition(filter));

    const dropped = await db
      .delete(listingMatches)
      .where(
        and(
          eq(listingMatches.filterId, filter.id),
          notInArray(listingMatches.listingId, stillMatching),
        ),
      )
      .returning({ listingId: listingMatches.listingId });

    removed += dropped.length;
  }

  const orphaned = await db
    .delete(listingMatches)
    .where(and(eq(listingMatches.groupId, groupId), isNull(listingMatches.filterId)))
    .returning({ listingId: listingMatches.listingId });
  removed += orphaned.length;

  return { removed, checkedFilters: groupFilters.length };
}

export async function listRuns(userId: string, groupId: string, limit = 20) {
  await assertGroupOwner(userId, groupId);
  return db
    .select({
      id: fetchRuns.id,
      filterId: fetchRuns.filterId,
      // Which search this run covered - a group has many filters and the table
      // is unreadable without it.
      filterName: filters.name,
      filterMake: filters.make,
      filterModel: filters.model,
      filterProvider: filters.provider,
      status: fetchRuns.status,
      trigger: fetchRuns.trigger,
      pagesFetched: fetchRuns.pagesFetched,
      itemsSeen: fetchRuns.itemsSeen,
      itemsNew: fetchRuns.itemsNew,
      itemsUpdated: fetchRuns.itemsUpdated,
      errorMessage: fetchRuns.errorMessage,
      startedAt: fetchRuns.startedAt,
      finishedAt: fetchRuns.finishedAt,
      durationMs: fetchRuns.durationMs,
    })
    .from(fetchRuns)
    // Left join: a filter deleted after its run still leaves the history row.
    .leftJoin(filters, eq(filters.id, fetchRuns.filterId))
    .where(eq(fetchRuns.groupId, groupId))
    .orderBy(desc(fetchRuns.startedAt))
    .limit(limit);
}

export async function assertGroupOwner(
  userId: string,
  groupId: string,
): Promise<void> {
  const [group] = await db
    .select({ id: filterGroups.id })
    .from(filterGroups)
    .where(and(eq(filterGroups.id, groupId), eq(filterGroups.userId, userId)))
    .limit(1);

  if (!group) throw new NotFoundError('Grupa filtrów nie istnieje');
}

function toFilterRow(
  input: FilterInput,
  groupId: string,
): typeof filters.$inferInsert {
  return {
    groupId,
    provider: input.provider,
    name: input.name ?? null,
    isActive: input.isActive,
    make: input.make ?? null,
    model: input.model ?? null,
    generation: input.generation ?? null,
    version: input.version ?? null,
    query: input.query ?? null,
    yearFrom: input.yearFrom ?? null,
    yearTo: input.yearTo ?? null,
    priceFrom: input.priceFrom ?? null,
    priceTo: input.priceTo ?? null,
    currency: input.currency,
    mileageFrom: input.mileageFrom ?? null,
    mileageTo: input.mileageTo ?? null,
    enginePowerFrom: input.enginePowerFrom ?? null,
    enginePowerTo: input.enginePowerTo ?? null,
    engineCapacityFrom: input.engineCapacityFrom ?? null,
    engineCapacityTo: input.engineCapacityTo ?? null,
    fuelTypes: input.fuelTypes ?? null,
    gearboxes: input.gearboxes ?? null,
    bodyTypes: input.bodyTypes ?? null,
    driveTypes: input.driveTypes ?? null,
    condition: input.condition ?? null,
    sellerType: input.sellerType ?? null,
    excludeDamaged: input.excludeDamaged,
    onlyWithPhotos: input.onlyWithPhotos,
    registeredInPl: input.registeredInPl ?? null,
    firstOwner: input.firstOwner ?? null,
    countryOrigin: input.countryOrigin ?? null,
    region: input.region ?? null,
    city: input.city ?? null,
    radiusKm: input.radiusKm ?? null,
    colors: input.colors ?? null,
    doorCounts: input.doorCounts ?? null,
    seatCounts: input.seatCounts ?? null,
    noAccident: input.noAccident ?? null,
    servicedAtAso: input.servicedAtAso ?? null,
    hasVin: input.hasVin ?? null,
    vatInvoice: input.vatInvoice ?? null,
    equipment: input.equipment ?? null,
    extraParams: (input.extraParams as Record<string, unknown> | null) ?? null,
  };
}
