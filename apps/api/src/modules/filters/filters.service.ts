import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  fetchRuns,
  filterGroups,
  filters,
  listingMatches,
  listings,
  type Filter,
  type FilterGroup,
} from '../../db/schema.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
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
        total: count(),
        // "New" = surfaced in the last 24 h, which is what the UI badge shows.
        fresh: sql<number>`count(*) filter (where ${listingMatches.firstMatchedAt} > now() - interval '24 hours')`.mapWith(
          Number,
        ),
      })
      .from(listingMatches)
      .innerJoin(listings, eq(listings.id, listingMatches.listingId))
      .where(
        and(inArray(listingMatches.groupId, groupIds), eq(listings.isActive, true)),
      )
      .groupBy(listingMatches.groupId),

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

export async function listRuns(userId: string, groupId: string, limit = 20) {
  await assertGroupOwner(userId, groupId);
  return db
    .select({
      id: fetchRuns.id,
      filterId: fetchRuns.filterId,
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
