import { and, eq, isNull, sql } from 'drizzle-orm';
import { logger } from '../../config/logger.js';
import { db } from '../../db/client.js';
import { geoLocations } from '../../db/schema.js';
import { HostRateLimiter, sleep } from '../../providers/scraping/rate-limiter.js';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Resolves Polish place names to coordinates via OpenStreetMap Nominatim.
 *
 * None of the marketplaces publish coordinates, so radius search has to derive
 * them from the city name. Results are cached in `geo_locations` - the set of
 * distinct cities is small (a few hundred) and essentially static.
 *
 * Nominatim's usage policy allows at most one request per second and requires
 * an identifying User-Agent; both are enforced here.
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'cars-fetcher/0.1 (osobisty agregator ogloszen motoryzacyjnych)';

/** Their policy is 1 req/s; the extra 100 ms keeps us clear of the edge. */
const limiter = new HostRateLimiter(1100);

/** Give up after this many failed lookups for the same place. */
const MAX_ATTEMPTS = 3;

const memoryCache = new Map<string, Coordinates | null>();

function cacheKey(city: string, region: string | null): string {
  return `${city.toLowerCase()}|${(region ?? '').toLowerCase()}`;
}

/** Cache-only lookup - never hits the network, safe on the ingest hot path. */
export async function lookupCached(
  city: string | null | undefined,
  region: string | null | undefined,
): Promise<Coordinates | null> {
  if (!city) return null;

  const key = cacheKey(city, region ?? null);
  const cached = memoryCache.get(key);
  if (cached !== undefined) return cached;

  const [row] = await db
    .select({ latitude: geoLocations.latitude, longitude: geoLocations.longitude })
    .from(geoLocations)
    .where(
      and(
        sql`lower(${geoLocations.city}) = ${city.toLowerCase()}`,
        sql`coalesce(lower(${geoLocations.region}), '') = ${(region ?? '').toLowerCase()}`,
      ),
    )
    .limit(1);

  const result =
    row?.latitude !== null && row?.latitude !== undefined && row.longitude !== null
      ? { latitude: row.latitude, longitude: row.longitude }
      : null;

  memoryCache.set(key, result);
  return result;
}

/**
 * Resolves a place, querying Nominatim when it is not cached yet. Used by the
 * backfill script and by the API when a user picks a city we have not seen.
 */
export async function geocode(
  city: string,
  region: string | null,
): Promise<Coordinates | null> {
  const cached = await lookupCached(city, region);
  if (cached) return cached;

  const [existing] = await db
    .select({ id: geoLocations.id, failedAttempts: geoLocations.failedAttempts })
    .from(geoLocations)
    .where(
      and(
        sql`lower(${geoLocations.city}) = ${city.toLowerCase()}`,
        sql`coalesce(lower(${geoLocations.region}), '') = ${(region ?? '').toLowerCase()}`,
      ),
    )
    .limit(1);

  if (existing && existing.failedAttempts >= MAX_ATTEMPTS) return null;

  const coordinates = await queryNominatim(city, region);

  // The unique index is on expressions, which `onConflictDoUpdate` cannot
  // target in a typed way - branching on the row we already read is simpler.
  if (existing) {
    await db
      .update(geoLocations)
      .set({
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        failedAttempts: coordinates ? 0 : existing.failedAttempts + 1,
        resolvedAt: new Date(),
      })
      .where(eq(geoLocations.id, existing.id));
  } else {
    await db.insert(geoLocations).values({
      city,
      region,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      failedAttempts: coordinates ? 0 : 1,
      resolvedAt: new Date(),
    });
  }

  memoryCache.set(cacheKey(city, region), coordinates);
  return coordinates;
}

async function queryNominatim(
  city: string,
  region: string | null,
): Promise<Coordinates | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('country', 'Poland');
  url.searchParams.set('city', city);
  if (region) url.searchParams.set('state', region);
  url.searchParams.set('limit', '1');

  try {
    const body = await limiter.schedule('nominatim', async () => {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });

      if (response.status === 429) {
        // Back off hard - their policy treats this as abuse.
        await sleep(5_000);
        throw new Error('Nominatim rate limit');
      }
      if (!response.ok) throw new Error(`Nominatim zwróciło ${response.status}`);
      return (await response.json()) as Array<{ lat?: string; lon?: string }>;
    });

    const first = body[0];
    if (!first?.lat || !first?.lon) return null;

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch (err) {
    logger.warn({ err, city, region }, 'Geokodowanie nie powiodło się');
    return null;
  }
}

/** Distinct places that still need coordinates, most common first. */
export async function listUnresolvedPlaces(): Promise<
  Array<{ city: string; region: string | null; listings: number }>
> {
  const rows = await db.execute<{ city: string; region: string | null; listings: number }>(
    sql`
      SELECT l.city, l.region, count(*)::int AS listings
      FROM listings l
      LEFT JOIN geo_locations g
        ON lower(g.city) = lower(l.city)
       AND coalesce(lower(g.region), '') = coalesce(lower(l.region), '')
      WHERE l.city IS NOT NULL
        AND (g.id IS NULL OR (g.latitude IS NULL AND g.failed_attempts < ${MAX_ATTEMPTS}))
      GROUP BY l.city, l.region
      ORDER BY count(*) DESC
    `,
  );
  return rows.rows;
}

/** Copies cached coordinates onto listings that do not have them yet. */
export async function backfillListingCoordinates(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE listings l
    SET latitude = g.latitude, longitude = g.longitude
    FROM geo_locations g
    WHERE lower(g.city) = lower(l.city)
      AND coalesce(lower(g.region), '') = coalesce(lower(l.region), '')
      AND g.latitude IS NOT NULL
      AND l.latitude IS NULL
  `);
  return result.rowCount ?? 0;
}

export { isNull, eq };
