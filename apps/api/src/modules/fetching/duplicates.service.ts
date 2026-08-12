import { and, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { listings } from '../../db/schema.js';

/**
 * A prospective duplicate needs at least these to be worth comparing at all.
 * Accepts `undefined` too, so `toListingRow`'s insert-shaped object (where an
 * unset optional column types as `T | undefined`, not just `T | null`) can be
 * passed straight in without the caller normalising it first.
 */
interface Candidate {
  provider: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  price?: number | null;
  mileageKm?: number | null;
  city?: string | null;
  sellerName?: string | null;
  vin?: string | null;
}

interface ExistingRow {
  id: string;
  price: number | null;
  mileageKm: number | null;
  city: string | null;
  sellerName: string | null;
  vin: string | null;
}

/** `undefined` and `null` mean the same "unset" thing here - collapse to one. */
interface NormalizedCandidate {
  provider: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileageKm: number | null;
  city: string | null;
  sellerName: string | null;
  vin: string | null;
}

/**
 * The same car, listed by the same person, tends to be posted at a nearly
 * identical price and mileage across marketplaces - it is the same physical
 * vehicle on the day it went up for sale everywhere at once. Small drift is
 * still expected (rounding, a few days between postings, a portal-specific
 * fee baked into the price), so this is a tolerance match, not an equality
 * one.
 */
function withinTolerance(
  a: number,
  b: number,
  pct: number,
  minAbsolute = 0,
): boolean {
  const diff = Math.abs(a - b);
  return diff <= minAbsolute || diff <= Math.max(Math.abs(a), Math.abs(b)) * pct;
}

const normalizeSellerName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

/** Tight match: no shared identity needed, the numbers alone have to agree closely. */
function isFieldMatch(candidate: NormalizedCandidate, row: ExistingRow): boolean {
  if (candidate.price === null || row.price === null) return false;
  if (candidate.mileageKm === null || row.mileageKm === null) return false;
  if (!withinTolerance(candidate.price, row.price, 0.03)) return false;
  if (!withinTolerance(candidate.mileageKm, row.mileageKm, 0.03, 1_000)) return false;
  // Only a disagreement counts against it - two blank cities say nothing.
  if (
    candidate.city &&
    row.city &&
    candidate.city.toLowerCase() !== row.city.toLowerCase()
  ) {
    return false;
  }
  return true;
}

/** Looser match: the same named seller re-listing, so prices/mileage may drift more. */
function isSellerMatch(candidate: NormalizedCandidate, row: ExistingRow): boolean {
  if (!candidate.sellerName || !row.sellerName) return false;
  if (normalizeSellerName(candidate.sellerName) !== normalizeSellerName(row.sellerName)) {
    return false;
  }
  if (candidate.price === null || row.price === null) return false;
  if (candidate.mileageKm === null || row.mileageKm === null) return false;
  if (!withinTolerance(candidate.price, row.price, 0.1)) return false;
  if (!withinTolerance(candidate.mileageKm, row.mileageKm, 0.1, 2_000)) return false;
  return true;
}

/**
 * Looks for an already-known, still-live listing from a *different* provider
 * that is almost certainly the same physical car, so a brand-new row can be
 * folded into it (`listings.mergedIntoId`) instead of showing up as a second
 * card for the same vehicle. Only ever called for a listing that is new to
 * our database - an existing row's merge decision, once made, is not
 * revisited.
 *
 * Deliberately conservative: a false positive *hides* a real, distinct car
 * behind someone else's listing, which is worse than occasionally missing a
 * duplicate and showing both. Two ways to qualify (`isFieldMatch` /
 * `isSellerMatch`, see above), and a VIN present on both sides that
 * *disagrees* vetoes the match outright regardless of everything else lining
 * up - that is proof, not a hint.
 */
export async function findDuplicateOf(
  // Only ever needs to read, so a plain `db` and a transaction both fit -
  // the full `Database` type does not, since a transaction handle lacks the
  // pool-level members (`$client`) it carries.
  tx: Pick<Database, 'select'>,
  raw: Candidate,
): Promise<string | null> {
  const candidate: NormalizedCandidate = {
    provider: raw.provider,
    make: raw.make ?? null,
    model: raw.model ?? null,
    year: raw.year ?? null,
    price: raw.price ?? null,
    mileageKm: raw.mileageKm ?? null,
    city: raw.city ?? null,
    sellerName: raw.sellerName ?? null,
    vin: raw.vin ?? null,
  };
  if (!candidate.make || !candidate.model || candidate.year === null) return null;

  const rows = await tx
    .select({
      id: listings.id,
      price: listings.price,
      mileageKm: listings.mileageKm,
      city: listings.city,
      sellerName: listings.sellerName,
      vin: listings.vin,
    })
    .from(listings)
    .where(
      and(
        ne(listings.provider, candidate.provider as (typeof listings.provider.enumValues)[number]),
        eq(listings.make, candidate.make),
        eq(listings.model, candidate.model),
        eq(listings.year, candidate.year),
        eq(listings.isActive, true),
        eq(listings.isArchived, false),
        sql`${listings.mergedIntoId} IS NULL`,
      ),
    )
    // A single make/model/year bucket, already narrowed to other providers'
    // live listings, is never large enough in practice to need more than this.
    .limit(200);

  for (const row of rows) {
    if (candidate.vin && row.vin && candidate.vin !== row.vin) continue;
    if (isFieldMatch(candidate, row) || isSellerMatch(candidate, row)) return row.id;
  }

  return null;
}
