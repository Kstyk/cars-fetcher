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
  listingViews,
} from '../../db/schema.js';
import { NotFoundError } from '../../lib/errors.js';
import { paginate, type Paginated } from '../../lib/pagination.js';
import { geocode } from '../geo/geocoding.service.js';
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
  vin: string | null;
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
  isArchived: boolean;
  archivedAt: Date | null;
  isFavorite: boolean;
  /** Which of the caller's groups surfaced this listing, for the card badges. */
  groups: Array<{ id: string; name: string; color: string | null }>;
  priceChangePct: number | null;
  /**
   * Negative means below the market median for similar cars (good price),
   * positive means above it. `null` when the listing itself lacks
   * make/model/year/mileage, or too few comparables exist to trust a median.
   */
  priceVsMarketPct: number | null;
  /** The same car, still live on another marketplace - see `mergedIntoId`. */
  duplicates: ListingDuplicate[];
  /** Days since the ad went up (marketplace's own date, `firstSeenAt` as fallback). */
  daysListed: number;
  /** Median days-to-sell for similar cars that already sold. `null` = too few comparables. */
  medianDaysToSellCohort: number | null;
}

export interface ListingDuplicate {
  id: string;
  provider: string;
  url: string;
  price: number | null;
  city: string | null;
}

/** Below this many comparables, a median is noise, not a signal. */
const MIN_MARKET_SAMPLE_SIZE = 5;

/**
 * Correlated subquery comparing a listing's price against the median of
 * "similar enough" comparables (same make/model, year +/-1, mileage +/-30%).
 * Shared between `listingColumns()` (search results / listing cards) and
 * `getPriceVsMarketForListings()` (the "okazja" notification check fired
 * right after ingest) so the two definitions of "good deal" never drift
 * apart.
 */
function priceVsMarketPctSql() {
  return sql<number | null>`(
    select case when (stats->>'count')::int >= ${MIN_MARKET_SAMPLE_SIZE}
      then round((
        (${listings.price} - (stats->>'median')::numeric)
        / (stats->>'median')::numeric * 100
      )::numeric, 1)
      else null
    end
    from (
      select jsonb_build_object(
        'median', percentile_cont(0.5) within group (order by l2.price),
        'count', count(*)
      ) as stats
      from listings l2
      where l2.make = listings.make
        and l2.model = listings.model
        and l2.year between listings.year - 1 and listings.year + 1
        and l2.mileage_km between listings.mileage_km * 0.7 and listings.mileage_km * 1.3
        and l2.price is not null
        and l2.is_active = true
        and l2.is_archived = false
        and l2.id != listings.id
    ) cohort
  )`.mapWith((v) => (v === null ? null : Number(v)));
}

/**
 * Lightweight price-vs-market lookup for a handful of listing ids - used
 * right after ingest to decide which brand-new listings are an "okazja"
 * worth their own notification. Skips the full `listingColumns()` shape
 * (duplicates/groups/favourite joins a just-inserted listing never needs).
 */
export async function getPriceVsMarketForListings(
  listingIds: string[],
): Promise<Map<string, { title: string; price: number | null; priceVsMarketPct: number | null }>> {
  if (listingIds.length === 0) return new Map();

  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      price: listings.price,
      priceVsMarketPct: priceVsMarketPctSql(),
    })
    .from(listings)
    .where(inArray(listings.id, listingIds));

  return new Map(
    rows.map((row) => [
      row.id,
      { title: row.title, price: row.price, priceVsMarketPct: row.priceVsMarketPct },
    ]),
  );
}

/**
 * The full per-row shape every listing list (search results, recently
 * viewed) renders the same `ListingCard` from - one set of column
 * definitions so the favourite/group/price-trend subqueries are not
 * duplicated (and cannot drift) between them.
 */
function listingColumns(userId: string) {
  return {
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
    vin: listings.vin,
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
    isArchived: listings.isArchived,
    archivedAt: listings.archivedAt,
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
      where m.listing_id = listings.id and g.user_id = ${userId} and m.removed_at is null
    ), '[]'::jsonb)`,
    priceChangePct: sql<number | null>`(
      select h.delta_pct from listing_price_history h
      where h.listing_id = listings.id
      order by h.recorded_at desc
      limit 1
    )`.mapWith((v) => (v === null ? null : Number(v))),
    // The other side of `mergedIntoId`: this listing's own followers, i.e.
    // the same car live on other marketplaces. Only ever populated on a
    // primary row - a merged-away row is excluded from results entirely (see
    // the `WHERE` clause in `searchListings`), so it can never itself be
    // "this listing" here.
    duplicates: sql<ListingDuplicate[]>`coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'provider', d.provider, 'url', d.url, 'price', d.price, 'city', d.city
      ) order by d.price asc nulls last)
      from listings d
      where d.merged_into_id = listings.id
        and d.is_active = true
        and d.is_archived = false
    ), '[]'::jsonb)`,
    // Same make/model, published within a year, mileage within 30% -
    // "similar enough" without shrinking the cohort to nothing. One
    // correlated subquery does both the median and the sample size so
    // the cohort is only scanned once.
    priceVsMarketPct: priceVsMarketPctSql(),
    // How long this exact ad has been up - the raw number the frontend
    // compares against `medianDaysToSellCohort` to flag it as sitting
    // unusually long (see `SellerDialog`/the "long on market" badge).
    daysListed: sql<number>`extract(epoch from (
      now() - coalesce(${listings.publishedAt}, ${listings.firstSeenAt})
    )) / 86400`.mapWith((v) => Math.round(Number(v))),
    // Same make/model, year within a year - how long *similar cars* took to
    // sell, from ones that already did (mileage is left out here, unlike the
    // price cohort above: archived rows are scarcer, and days-to-sell
    // correlates far less with exact mileage than price does, so the wider
    // net matters more than the extra precision would).
    medianDaysToSellCohort: sql<number | null>`(
      select case when (stats->>'count')::int >= ${MIN_MARKET_SAMPLE_SIZE}
        then round((stats->>'median')::numeric, 1)
        else null
      end
      from (
        select jsonb_build_object(
          'median', percentile_cont(0.5) within group (
            order by extract(epoch from (l2.archived_at - coalesce(l2.published_at, l2.first_seen_at))) / 86400
          ),
          'count', count(*)
        ) as stats
        from listings l2
        where l2.make = listings.make
          and l2.model = listings.model
          and l2.year between listings.year - 1 and listings.year + 1
          and l2.is_archived = true
          and l2.archived_at is not null
          and l2.id != listings.id
      ) cohort
    )`.mapWith((v) => (v === null ? null : Number(v))),
  };
}

/**
 * Reads listings out of our own database - the fetcher is what talks to
 * providers. Every result is scoped to groups owned by the caller.
 */
/**
 * Where a radius search is centred. An explicit pin from the map takes
 * precedence; otherwise the city name is geocoded (cache first, network only
 * for a city we have never seen).
 */
async function resolveAnchor(
  query: ListingQuery,
): Promise<{ latitude: number; longitude: number } | null> {
  if (query.lat !== undefined && query.lon !== undefined) {
    return { latitude: query.lat, longitude: query.lon };
  }
  if (!query.city || !query.radiusKm) return null;

  return geocode(query.city, query.region?.[0] ?? null);
}

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
            sql`${listingMatches.removedAt} IS NULL`,
            query.groupId ? eq(listingMatches.groupId, query.groupId) : undefined,
            query.filterId ? eq(listingMatches.filterId, query.filterId) : undefined,
          ),
        ),
    ),
  ];

  // A listing folded into another (the same car, live on a different
  // marketplace - see `mergedIntoId`) drops out of the results on its own;
  // it surfaces in its primary's `duplicates` list instead. The one
  // exception: once that primary itself is archived (sold on *that* site),
  // this row stops being a mere alternate and becomes its own listing again
  // - it may still be genuinely available through the marketplace it came
  // from, which the user should not lose sight of just because the listing
  // that happened to absorb it first sold out.
  conditions.push(sql`(
    ${listings.mergedIntoId} IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM listings p WHERE p.id = ${listings.mergedIntoId} AND p.is_archived = false
    )
  )`);

  // Archived listings are excluded by default - they are no longer for sale.
  if (query.archived === 'no') conditions.push(eq(listings.isArchived, false));
  if (query.archived === 'yes') conditions.push(eq(listings.isArchived, true));

  // Only constrain activity when archived rows are not the point of the query.
  if (!query.includeInactive && query.archived === 'no') {
    conditions.push(eq(listings.isActive, true));
  }
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

  if (query.region?.length) {
    conditions.push(inArray(listings.region, query.region));
  }

  // Radius search: an explicit pin wins, otherwise the named city is geocoded.
  const anchor = await resolveAnchor(query);
  if (anchor && query.radiusKm) {
    // Great-circle distance in kilometres. Listings without coordinates cannot
    // be placed on a map, so they are excluded rather than silently kept.
    conditions.push(sql`
      ${listings.latitude} IS NOT NULL AND ${listings.longitude} IS NOT NULL
      AND 6371 * acos(
        least(1, greatest(-1,
          sin(radians(${anchor.latitude})) * sin(radians(${listings.latitude}))
          + cos(radians(${anchor.latitude})) * cos(radians(${listings.latitude}))
            * cos(radians(${listings.longitude}) - radians(${anchor.longitude}))
        ))
      ) <= ${query.radiusKm}
    `);
  } else if (query.city) {
    // No radius (or no coordinates for that city) - fall back to a name match.
    conditions.push(ilike(listings.city, query.city));
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
      .select(listingColumns(userId))
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

/**
 * "Newest" means when the advert appeared on the marketplace, not when we
 * scraped it - a filter added today would otherwise report years-old cars as
 * brand new. `first_seen_at` is the fallback for providers that omit the date,
 * and stays available as its own sort option.
 */
const PUBLISHED_AT = sql`coalesce(${listings.publishedAt}, ${listings.firstSeenAt})`;

function orderBy(sort: ListingQuery['sort']): SQL[] {
  switch (sort) {
    case 'oldest':
      return [sql`${PUBLISHED_AT} asc`];
    case 'added_newest':
      return [desc(listings.firstSeenAt)];
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
      return [sql`${PUBLISHED_AT} desc`];
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
      // Left, not inner: a deleted filter nulls `filterId` (see the schema
      // doc comment) but the group still owns the match, so the listing must
      // stay reachable here too - an inner join would 404 a listing that
      // `searchListings` (group-scoped, not filter-scoped) still lists fine.
      .leftJoin(filters, eq(filters.id, listingMatches.filterId))
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

/** Cities present in the caller's listings, for the location filter select. */
export async function listCities(userId: string) {
  const rows = await db
    .selectDistinct({ city: listings.city, region: listings.region })
    .from(listings)
    .where(
      and(
        sql`${listings.city} IS NOT NULL`,
        exists(
          db
            .select({ one: sql`1` })
            .from(listingMatches)
            .innerJoin(filterGroups, eq(filterGroups.id, listingMatches.groupId))
            .where(
              and(
                eq(listingMatches.listingId, listings.id),
                eq(filterGroups.userId, userId),
                sql`${listingMatches.removedAt} IS NULL`,
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(listings.city));

  return rows.filter((row): row is { city: string; region: string | null } =>
    Boolean(row.city),
  );
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
        where m.listing_id = ${listings.id} and g.user_id = ${userId} and m.removed_at is null
      ), '[]'::jsonb)`,
      duplicates: sql<ListingDuplicate[]>`coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', d.id, 'provider', d.provider, 'url', d.url, 'price', d.price, 'city', d.city
        ) order by d.price asc nulls last)
        from listings d
        where d.merged_into_id = ${listings.id}
          and d.is_active = true
          and d.is_archived = false
      ), '[]'::jsonb)`,
    })
    .from(favorites)
    .innerJoin(listings, eq(listings.id, favorites.listingId))
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt));

  return rows.map(({ listing, groups, duplicates, ...rest }) => ({
    ...rest,
    listing: {
      ...listing,
      groups,
      duplicates,
      isFavorite: true,
      priceChangePct: null,
      daysListed: Math.round(
        (Date.now() - (listing.publishedAt ?? listing.firstSeenAt).getTime()) / 86_400_000,
      ),
      // Not worth a second cohort subquery here for a page that is usually
      // a handful of rows - the stale-listing badge just stays off on
      // Favorites, `priceVsMarketPct` already carries the "good price" signal.
      medianDaysToSellCohort: null,
    },
  }));
}

/* ------------------------------ recently viewed ---------------------------- */

/**
 * Fired when the user actually clicks through to the marketplace - not when
 * a card merely renders in a list. Repeat clicks bump the same row instead
 * of piling up duplicates, so "recently viewed" reads as a stack of distinct
 * cars, not a click log.
 */
export async function recordListingView(userId: string, listingId: string): Promise<void> {
  const [listing] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!listing) throw new NotFoundError('Ogłoszenie nie istnieje');

  await db
    .insert(listingViews)
    .values({ userId, listingId })
    .onConflictDoUpdate({
      target: [listingViews.userId, listingViews.listingId],
      set: { viewedAt: new Date(), viewCount: sql`${listingViews.viewCount} + 1` },
    });
}

export async function listRecentlyViewed(
  userId: string,
  limit = 60,
): Promise<ListingView[]> {
  const rows = await db
    .select(listingColumns(userId))
    .from(listingViews)
    .innerJoin(listings, eq(listings.id, listingViews.listingId))
    .where(eq(listingViews.userId, userId))
    .orderBy(desc(listingViews.viewedAt))
    .limit(limit);

  return rows as ListingView[];
}

/* --------------------------------- stats --------------------------------- */

export async function getStats(userId: string) {
  // Current relevance: does this listing still have a *live* match to one of
  // the caller's groups. Used for anything describing "now" (the top tiles,
  // "by make").
  const scoped = exists(
    db
      .select({ one: sql`1` })
      .from(listingMatches)
      .innerJoin(filterGroups, eq(filterGroups.id, listingMatches.groupId))
      .where(
        and(
          eq(listingMatches.listingId, listings.id),
          eq(filterGroups.userId, userId),
          sql`${listingMatches.removedAt} IS NULL`,
        ),
      ),
  );

  // Historical relevance: was this listing *ever* matched by one of the
  // caller's groups, live match or not. `soldByModel` below is the one
  // consumer - whether a car sold is a fact about the past, and editing a
  // filter's criteria (then running "Wyczyść nieaktualne") must not be able
  // to make that car quietly vanish from the sold count just because it no
  // longer fits *today's* narrower criteria. See the `removedAt` doc comment
  // on `listingMatches` for the full reasoning.
  const scopedEver = exists(
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

  /**
   * Sold-vs-listed per model. "Sold" means the advert disappeared from the
   * marketplace, which is the only signal these sites give us. Models with a
   * single listing are dropped - a 100% ratio off one car says nothing.
   *
   * Deliberately `scopedEver`, not `scoped`: a car that sold while this
   * group was tracking it stays counted here even if a filter edit later
   * (plus "Wyczyść nieaktualne") removed its live match - the sale already
   * happened, tightening a price range today cannot un-happen it.
   */
  const soldByModel = await db
    .select({
      make: listings.make,
      model: listings.model,
      total: countDistinct(listings.id),
      sold: sql<number>`count(distinct ${listings.id}) filter (where ${listings.isArchived})`.mapWith(
        Number,
      ),
      avgSoldPrice: sql<number | null>`avg(${listings.price}) filter (where ${listings.isArchived})`.mapWith(
        (v) => (v === null ? null : Math.round(Number(v))),
      ),
      /** Median days between first sighting and disappearance. */
      medianDaysToSell: sql<number | null>`percentile_cont(0.5) within group (
        order by extract(epoch from (${listings.archivedAt} - ${listings.firstSeenAt})) / 86400
      ) filter (where ${listings.isArchived} and ${listings.archivedAt} is not null)`.mapWith(
        (v) => (v === null ? null : Math.round(Number(v) * 10) / 10),
      ),
    })
    .from(listings)
    .where(and(scopedEver, sql`${listings.make} is not null`))
    .groupBy(listings.make, listings.model)
    .having(sql`count(distinct ${listings.id}) > 1`)
    .orderBy(desc(sql`count(distinct ${listings.id}) filter (where ${listings.isArchived})`))
    .limit(25);

  // Same reasoning as `soldByModel` - a car sold is a fact about the past.
  const [archivedTotals] = await db
    .select({
      archived: sql<number>`count(distinct ${listings.id}) filter (where ${listings.isArchived})`.mapWith(
        Number,
      ),
    })
    .from(listings)
    .where(scopedEver);

  return {
    total: totals?.total ?? 0,
    active: totals?.active ?? 0,
    fresh24h: totals?.fresh24h ?? 0,
    avgPrice: totals?.avgPrice ?? null,
    favorites: favoriteCount?.value ?? 0,
    archived: archivedTotals?.archived ?? 0,
    byMake: byMake.filter((m) => m.make !== null),
    soldByModel,
  };
}
