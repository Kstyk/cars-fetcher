import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  favorites,
  filterGroups,
  filters,
  listingMatches,
  listingPriceHistory,
  listings,
} from '../../db/schema.js';
import { NotFoundError } from '../../lib/errors.js';
import { paginate, type Paginated } from '../../lib/pagination.js';
import type { ListingQuery } from './listings.schemas.js';

export interface ListingView {
  id: string;
  provider: string;
  externalId: string;
  url: string;
  title: string;
  make: string | null;
  model: string | null;
  version: string | null;
  price: number | null;
  currency: string;
  year: number | null;
  mileageKm: number | null;
  fuelType: string | null;
  gearbox: string | null;
  bodyType: string | null;
  enginePowerHp: number | null;
  engineCapacityCm3: number | null;
  city: string | null;
  region: string | null;
  countryOrigin: string | null;
  color: string | null;
  sellerType: string;
  sellerName: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isActive: boolean;
  isFavorite: boolean;
  /** Which of the caller's groups surfaced this listing, for the card badges. */
  groups: Array<{ id: string; name: string; color: string | null }>;
  priceChangePct: number | null;
}

/**
 * Reads listings out of our own database - the fetcher is what talks to
 * providers. Every result is scoped to groups owned by the caller.
 */
export async function searchListings(
  userId: string,
  query: ListingQuery,
): Promise<Paginated<ListingView>> {
  const conditions: SQL[] = [
    // Only listings reachable through this user's filter groups.
    exists(
      db
        .select({ one: sql`1` })
        .from(listingMatches)
        .innerJoin(filterGroups, eq(filterGroups.id, listingMatches.groupId))
        .where(
          and(
            eq(listingMatches.listingId, listings.id),
            eq(filterGroups.userId, userId),
            query.groupId ? eq(listingMatches.groupId, query.groupId) : undefined,
            query.filterId ? eq(listingMatches.filterId, query.filterId) : undefined,
          ),
        ),
    ),
  ];

  if (!query.includeInactive) conditions.push(eq(listings.isActive, true));
  if (query.provider?.length) {
    conditions.push(inArray(listings.provider, query.provider));
  }
  if (query.make) conditions.push(ilike(listings.make, query.make));
  if (query.model) conditions.push(ilike(listings.model, query.model));
  if (query.priceFrom !== undefined) conditions.push(gte(listings.price, query.priceFrom));
  if (query.priceTo !== undefined) conditions.push(lte(listings.price, query.priceTo));
  if (query.yearFrom !== undefined) conditions.push(gte(listings.year, query.yearFrom));
  if (query.yearTo !== undefined) conditions.push(lte(listings.year, query.yearTo));
  if (query.mileageTo !== undefined) {
    conditions.push(lte(listings.mileageKm, query.mileageTo));
  }
  if (query.fuelType?.length) conditions.push(inArray(listings.fuelType, query.fuelType));
  if (query.gearbox?.length) conditions.push(inArray(listings.gearbox, query.gearbox));
  if (query.bodyType?.length) conditions.push(inArray(listings.bodyType, query.bodyType));
  if (query.sellerType?.length) {
    conditions.push(inArray(listings.sellerType, query.sellerType));
  }
  if (query.countryOrigin?.length) {
    conditions.push(inArray(listings.countryOrigin, query.countryOrigin));
  }
  if (query.color?.length) {
    conditions.push(inArray(listings.color, query.color));
  }
  if (query.powerFrom !== undefined) {
    conditions.push(gte(listings.enginePowerHp, query.powerFrom));
  }
  if (query.powerTo !== undefined) {
    conditions.push(lte(listings.enginePowerHp, query.powerTo));
  }

  if (query.q) {
    const pattern = `%${query.q}%`;
    const search = or(
      ilike(listings.title, pattern),
      ilike(listings.make, pattern),
      ilike(listings.model, pattern),
      ilike(listings.version, pattern),
    );
    if (search) conditions.push(search);
  }

  if (query.onlyNew) {
    conditions.push(sql`${listings.firstSeenAt} > now() - interval '24 hours'`);
  }

  if (query.onlyFavorites) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(favorites)
          .where(
            and(eq(favorites.listingId, listings.id), eq(favorites.userId, userId)),
          ),
      ),
    );
  }

  const where = and(...conditions);

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: listings.id,
        provider: listings.provider,
        externalId: listings.externalId,
        url: listings.url,
        title: listings.title,
        make: listings.make,
        model: listings.model,
        version: listings.version,
        price: listings.price,
        currency: listings.currency,
        year: listings.year,
        mileageKm: listings.mileageKm,
        fuelType: listings.fuelType,
        gearbox: listings.gearbox,
        bodyType: listings.bodyType,
        enginePowerHp: listings.enginePowerHp,
        engineCapacityCm3: listings.engineCapacityCm3,
        city: listings.city,
        region: listings.region,
        countryOrigin: listings.countryOrigin,
        color: listings.color,
        sellerType: listings.sellerType,
        sellerName: listings.sellerName,
        thumbnailUrl: listings.thumbnailUrl,
        publishedAt: listings.publishedAt,
        firstSeenAt: listings.firstSeenAt,
        lastSeenAt: listings.lastSeenAt,
        isActive: listings.isActive,
        // Table names are spelled out: inside a select field drizzle emits
        // unqualified column names, which would collide in these subqueries.
        isFavorite: sql<boolean>`exists (
          select 1 from favorites f
          where f.listing_id = listings.id and f.user_id = ${userId}
        )`.mapWith(Boolean),
        groups: sql<Array<{ id: string; name: string; color: string | null }>>`coalesce((
          select jsonb_agg(distinct jsonb_build_object(
            'id', g.id, 'name', g.name, 'color', g.color
          ))
          from listing_matches m
          join filter_groups g on g.id = m.group_id
          where m.listing_id = listings.id and g.user_id = ${userId}
        ), '[]'::jsonb)`,
        priceChangePct: sql<number | null>`(
          select h.delta_pct from listing_price_history h
          where h.listing_id = listings.id
          order by h.recorded_at desc
          limit 1
        )`.mapWith((v) => (v === null ? null : Number(v))),
      })
      .from(listings)
      .where(where)
      .orderBy(...orderBy(query.sort))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),

    db
      .select({ value: countDistinct(listings.id) })
      .from(listings)
      .where(where),
  ]);

  return paginate(rows as ListingView[], totals?.value ?? 0, query);
}

function orderBy(sort: ListingQuery['sort']): SQL[] {
  switch (sort) {
    case 'oldest':
      return [asc(listings.firstSeenAt)];
    case 'price_asc':
      return [sql`${listings.price} asc nulls last`, desc(listings.firstSeenAt)];
    case 'price_desc':
      return [sql`${listings.price} desc nulls last`, desc(listings.firstSeenAt)];
    case 'mileage_asc':
      return [sql`${listings.mileageKm} asc nulls last`];
    case 'year_desc':
      return [sql`${listings.year} desc nulls last`];
    case 'newest':
    default:
      return [desc(listings.firstSeenAt)];
  }
}

export async function getListing(userId: string, listingId: string) {
  const [row] = await db
    .select()
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!row) throw new NotFoundError('Ogłoszenie nie istnieje');

  const [priceHistory, matchedGroups, favorite] = await Promise.all([
    db
      .select({
        price: listingPriceHistory.price,
        currency: listingPriceHistory.currency,
        deltaAmount: listingPriceHistory.deltaAmount,
        deltaPct: listingPriceHistory.deltaPct,
        recordedAt: listingPriceHistory.recordedAt,
      })
      .from(listingPriceHistory)
      .where(eq(listingPriceHistory.listingId, listingId))
      .orderBy(asc(listingPriceHistory.recordedAt)),

    db
      .select({
        groupId: filterGroups.id,
        groupName: filterGroups.name,
        filterId: filters.id,
        filterName: filters.name,
        firstMatchedAt: listingMatches.firstMatchedAt,
      })
      .from(listingMatches)
      .innerJoin(filterGroups, eq(filterGroups.id, listingMatches.groupId))
      .innerJoin(filters, eq(filters.id, listingMatches.filterId))
      .where(
        and(eq(listingMatches.listingId, listingId), eq(filterGroups.userId, userId)),
      ),

    db
      .select()
      .from(favorites)
      .where(and(eq(favorites.listingId, listingId), eq(favorites.userId, userId)))
      .limit(1),
  ]);

  if (matchedGroups.length === 0) {
    // Not reachable through any of the caller's groups.
    throw new NotFoundError('Ogłoszenie nie istnieje');
  }

  return {
    ...row,
    priceHistory,
    matchedGroups,
    favorite: favorite[0] ?? null,
  };
}

/* ------------------------------- favourites ------------------------------ */

export async function addFavorite(
  userId: string,
  listingId: string,
  input: { note?: string | null; rating?: number | null },
) {
  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!listing) throw new NotFoundError('Ogłoszenie nie istnieje');

  const [row] = await db
    .insert(favorites)
    .values({
      userId,
      listingId,
      note: input.note ?? null,
      rating: input.rating ?? null,
    })
    .onConflictDoUpdate({
      target: [favorites.userId, favorites.listingId],
      set: { note: input.note ?? null, rating: input.rating ?? null },
    })
    .returning();

  return row;
}

export async function removeFavorite(
  userId: string,
  listingId: string,
): Promise<void> {
  await db
    .delete(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.listingId, listingId)));
}

export async function listFavorites(userId: string) {
  const rows = await db
    .select({
      listing: listings,
      note: favorites.note,
      rating: favorites.rating,
      addedAt: favorites.createdAt,
      // Same shape the listing grid uses, so one card component fits both.
      groups: sql<Array<{ id: string; name: string; color: string | null }>>`coalesce((
        select jsonb_agg(distinct jsonb_build_object(
          'id', g.id, 'name', g.name, 'color', g.color
        ))
        from listing_matches m
        join filter_groups g on g.id = m.group_id
        where m.listing_id = ${listings.id} and g.user_id = ${userId}
      ), '[]'::jsonb)`,
    })
    .from(favorites)
    .innerJoin(listings, eq(listings.id, favorites.listingId))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));

  return rows.map(({ listing, groups, ...rest }) => ({
    ...rest,
    listing: { ...listing, groups, isFavorite: true, priceChangePct: null },
  }));
}

/* --------------------------------- stats --------------------------------- */

export async function getStats(userId: string) {
  const scoped = exists(
    db
      .select({ one: sql`1` })
      .from(listingMatches)
      .innerJoin(filterGroups, eq(filterGroups.id, listingMatches.groupId))
      .where(
        and(
          eq(listingMatches.listingId, listings.id),
          eq(filterGroups.userId, userId),
        ),
      ),
  );

  const [[totals], [favoriteCount], byMake] = await Promise.all([
    db
      .select({
        total: countDistinct(listings.id),
        active: sql<number>`count(distinct ${listings.id}) filter (where ${listings.isActive})`.mapWith(
          Number,
        ),
        fresh24h: sql<number>`count(distinct ${listings.id}) filter (where ${listings.firstSeenAt} > now() - interval '24 hours')`.mapWith(
          Number,
        ),
        avgPrice: sql<number | null>`avg(${listings.price}) filter (where ${listings.isActive})`.mapWith(
          (v) => (v === null ? null : Math.round(Number(v))),
        ),
      })
      .from(listings)
      .where(scoped),

    db
      .select({ value: countDistinct(favorites.listingId) })
      .from(favorites)
      .where(eq(favorites.userId, userId)),

    db
      .select({
        make: listings.make,
        count: countDistinct(listings.id),
        avgPrice: sql<number | null>`avg(${listings.price})`.mapWith((v) =>
          v === null ? null : Math.round(Number(v)),
        ),
      })
      .from(listings)
      .where(and(scoped, eq(listings.isActive, true)))
      .groupBy(listings.make)
      .orderBy(desc(countDistinct(listings.id)))
      .limit(10),
  ]);

  return {
    total: totals?.total ?? 0,
    active: totals?.active ?? 0,
    fresh24h: totals?.fresh24h ?? 0,
    avgPrice: totals?.avgPrice ?? null,
    favorites: favoriteCount?.value ?? 0,
    byMake: byMake.filter((m) => m.make !== null),
  };
}
