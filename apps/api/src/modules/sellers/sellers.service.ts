import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { listings } from '../../db/schema.js';
import { NotFoundError } from '../../lib/errors.js';

export interface SellerListing {
  id: string;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  currency: string;
  provider: string;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  /** Same "long on market" signal as the listing grid, computed here since a seller profile has no cohort context of its own. */
  daysListed: number;
}

export interface SellerProfile {
  sellerName: string;
  totalActive: number;
  totalArchived: number;
  /** Every marketplace this name has posted under, in our data. */
  providers: string[];
  firstSeenAt: string;
  /**
   * How long *this seller's own* past ads typically took to sell - not the
   * market-wide cohort (`medianDaysToSellCohort` on a listing row), which
   * answers "how fast do similar cars sell"; this answers "how fast does
   * *this seller* sell", the number a stale-vs-this-seller comparison needs.
   */
  medianDaysToSellOwn: number | null;
  activeListings: SellerListing[];
}

/**
 * Sellers have no id anywhere in this data - only the free-text name each
 * provider shows. Grouped by that name (trimmed, case-insensitive) across
 * every provider on purpose: a dealer cross-posting the same inventory under
 * one business name is exactly the pattern worth surfacing as "this is a
 * dealer with N cars", not N unrelated one-off private sellers. The
 * trade-off is the flip side of the same coin - two different private
 * sellers who happen to share a common name collide too. Heuristic, not a
 * guarantee, same as the cross-provider duplicate detection.
 */
export async function getSellerProfile(rawName: string): Promise<SellerProfile> {
  const name = rawName.trim();

  const [stats] = await db
    .select({
      totalActive: sql<number>`count(*) filter (where ${listings.isActive} and not ${listings.isArchived})`.mapWith(
        Number,
      ),
      totalArchived: sql<number>`count(*) filter (where ${listings.isArchived})`.mapWith(Number),
      firstSeenAt: sql<string>`min(${listings.firstSeenAt})`,
      medianDaysToSellOwn: sql<number | null>`percentile_cont(0.5) within group (
        order by extract(epoch from (${listings.archivedAt} - coalesce(${listings.publishedAt}, ${listings.firstSeenAt}))) / 86400
      ) filter (where ${listings.isArchived} and ${listings.archivedAt} is not null)`.mapWith((v) =>
        v === null ? null : Math.round(Number(v) * 10) / 10,
      ),
      providers: sql<string[]>`coalesce(array_agg(distinct ${listings.provider}), '{}')`,
    })
    .from(listings)
    .where(ilike(listings.sellerName, name));

  if (!stats || (stats.totalActive === 0 && stats.totalArchived === 0)) {
    throw new NotFoundError('Nie znaleziono ogłoszeń tego sprzedawcy');
  }

  const activeRows = await db
    .select({
      id: listings.id,
      title: listings.title,
      make: listings.make,
      model: listings.model,
      year: listings.year,
      price: listings.price,
      currency: listings.currency,
      provider: listings.provider,
      url: listings.url,
      thumbnailUrl: listings.thumbnailUrl,
      publishedAt: listings.publishedAt,
      firstSeenAt: listings.firstSeenAt,
    })
    .from(listings)
    .where(and(ilike(listings.sellerName, name), eq(listings.isActive, true), eq(listings.isArchived, false)))
    .orderBy(desc(listings.publishedAt))
    .limit(50);

  const activeListings: SellerListing[] = activeRows.map((row) => {
    const { firstSeenAt, ...rest } = row;
    const anchor = row.publishedAt ?? firstSeenAt;
    return {
      ...rest,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      daysListed: Math.round((Date.now() - anchor.getTime()) / 86_400_000),
    };
  });

  return {
    sellerName: name,
    totalActive: stats.totalActive,
    totalArchived: stats.totalArchived,
    providers: stats.providers,
    firstSeenAt: stats.firstSeenAt,
    medianDaysToSellOwn: stats.medianDaysToSellOwn,
    activeListings,
  };
}
