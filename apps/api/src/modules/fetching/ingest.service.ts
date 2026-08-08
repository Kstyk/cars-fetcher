import { and, eq, sql } from 'drizzle-orm';
import { logger } from '../../config/logger.js';
import { db } from '../../db/client.js';
import {
  listingMatches,
  listingPriceHistory,
  listings,
  type Listing,
} from '../../db/schema.js';
import { normalizeVoivodeship } from '../../lib/regions.js';
import type { NormalizedListing } from '../../providers/types.js';
import { lookupCached } from '../geo/geocoding.service.js';

export interface IngestContext {
  filterId: string;
  groupId: string;
  userId: string;
}

export interface IngestOutcome {
  listingId: string;
  isNewListing: boolean;
  isNewMatch: boolean;
  priceChange: { from: number; to: number; deltaPct: number } | null;
}

export interface IngestSummary {
  seen: number;
  created: number;
  updated: number;
  newMatches: number;
  priceDrops: IngestOutcome[];
  newListings: IngestOutcome[];
}

/**
 * Writes one page of provider results into the database.
 *
 * Per listing: upsert on (provider, external_id), append a price-history row
 * when the price moved, and upsert the match row linking it to the filter.
 * Returns what changed so the notification layer can act on it.
 */
export async function ingestListings(
  items: NormalizedListing[],
  ctx: IngestContext,
  startRank = 0,
): Promise<IngestSummary> {
  const summary: IngestSummary = {
    seen: items.length,
    created: 0,
    updated: 0,
    newMatches: 0,
    priceDrops: [],
    newListings: [],
  };

  for (const [offset, item] of items.entries()) {
    try {
      const outcome = await ingestOne(item, ctx, startRank + offset);
      if (outcome.isNewListing) summary.created += 1;
      else summary.updated += 1;
      if (outcome.isNewMatch) {
        summary.newMatches += 1;
        summary.newListings.push(outcome);
      }
      if (outcome.priceChange && outcome.priceChange.deltaPct < 0) {
        summary.priceDrops.push(outcome);
      }
    } catch (err) {
      // One malformed advert must not abort the whole page.
      logger.warn(
        { err, externalId: item.externalId },
        'Failed to ingest listing, skipping',
      );
    }
  }

  return summary;
}

async function ingestOne(
  item: NormalizedListing,
  ctx: IngestContext,
  rank: number,
): Promise<IngestOutcome> {
  const now = new Date();

  // Cache-only lookup: no provider returns coordinates, and the ingest path
  // must not wait on a geocoding request. Misses are filled by `geo:backfill`.
  const coordinates =
    item.latitude !== null && item.latitude !== undefined
      ? null
      : await lookupCached(item.city, item.region);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: listings.id, price: listings.price, currency: listings.currency })
      .from(listings)
      .where(
        and(
          eq(listings.provider, item.provider),
          eq(listings.externalId, item.externalId),
        ),
      )
      .limit(1);

    const values = toListingRow(item, now, coordinates);

    const [saved] = await tx
      .insert(listings)
      .values(values)
      .onConflictDoUpdate({
        target: [listings.provider, listings.externalId],
        set: {
          ...values,
          // firstSeenAt belongs to the original sighting.
          firstSeenAt: sql`${listings.firstSeenAt}`,
          isActive: true,
          deactivatedAt: null,
          updatedAt: now,
        },
      })
      .returning({ id: listings.id });

    if (!saved) throw new Error('Upsert ogłoszenia nie zwrócił wiersza');

    let priceChange: IngestOutcome['priceChange'] = null;
    const newPrice = item.price ?? null;
    const oldPrice = existing?.price ?? null;

    if (newPrice !== null && oldPrice !== newPrice) {
      const deltaAmount = oldPrice === null ? null : newPrice - oldPrice;
      const deltaPct =
        oldPrice === null || oldPrice === 0
          ? null
          : Number((((newPrice - oldPrice) / oldPrice) * 100).toFixed(3));

      await tx.insert(listingPriceHistory).values({
        listingId: saved.id,
        price: newPrice,
        currency: item.currency,
        deltaAmount,
        deltaPct,
        recordedAt: now,
      });

      if (oldPrice !== null && deltaPct !== null) {
        priceChange = { from: oldPrice, to: newPrice, deltaPct };
      }
    }

    const [match] = await tx
      .insert(listingMatches)
      .values({
        listingId: saved.id,
        filterId: ctx.filterId,
        groupId: ctx.groupId,
        rank,
        firstMatchedAt: now,
        lastMatchedAt: now,
      })
      .onConflictDoUpdate({
        target: [listingMatches.listingId, listingMatches.filterId],
        set: { lastMatchedAt: now, rank },
      })
      .returning({
        firstMatchedAt: listingMatches.firstMatchedAt,
      });

    // A match row created just now has firstMatchedAt === now.
    const isNewMatch = match?.firstMatchedAt?.getTime() === now.getTime();

    return {
      listingId: saved.id,
      isNewListing: !existing,
      isNewMatch,
      priceChange,
    };
  });
}

function toListingRow(
  item: NormalizedListing,
  now: Date,
  coordinates: { latitude: number; longitude: number } | null,
): typeof listings.$inferInsert {
  return {
    provider: item.provider,
    externalId: item.externalId,
    url: item.url,
    title: item.title,
    make: item.make ?? null,
    model: item.model ?? null,
    generation: item.generation ?? null,
    version: item.version ?? null,
    price: item.price ?? null,
    currency: item.currency,
    priceGross: item.priceGross ?? null,
    hasVatInvoice: item.hasVatInvoice ?? null,
    year: item.year ?? null,
    mileageKm: item.mileageKm ?? null,
    fuelType: item.fuelType ?? null,
    gearbox: item.gearbox ?? null,
    bodyType: item.bodyType ?? null,
    driveType: item.driveType ?? null,
    engineCapacityCm3: item.engineCapacityCm3 ?? null,
    enginePowerHp: item.enginePowerHp ?? null,
    doors: item.doors ?? null,
    seats: item.seats ?? null,
    color: item.color ?? null,
    condition: item.condition ?? null,
    isDamaged: item.isDamaged ?? null,
    vin: item.vin ?? null,
    firstRegistrationDate: item.firstRegistrationDate ?? null,
    countryOrigin: item.countryOrigin ?? null,
    sellerType: item.sellerType,
    sellerName: item.sellerName ?? null,
    city: item.city ?? null,
    // Providers disagree on spelling ("Kujawsko pomorskie" vs "-pomorskie").
    region: normalizeVoivodeship(item.region),
    country: item.country ?? null,
    latitude: item.latitude ?? coordinates?.latitude ?? null,
    longitude: item.longitude ?? coordinates?.longitude ?? null,
    thumbnailUrl: item.thumbnailUrl ?? null,
    imagesCount: item.imagesCount ?? null,
    publishedAt: item.publishedAt ?? null,
    firstSeenAt: now,
    lastSeenAt: now,
    isActive: true,
    raw: item.raw,
    updatedAt: now,
  };
}

/**
 * Marks listings that a filter stopped returning as inactive. They stay in the
 * database (favourites and history keep working) but drop out of active views.
 */
export async function deactivateStaleListings(
  filterId: string,
  runStartedAt: Date,
): Promise<number> {
  const now = new Date();
  const result = await db
    .update(listings)
    // Archiving is one-way: a listing that comes back stays flagged as having
    // been sold once, which is what the sold-vs-listed ratio counts.
    .set({
      isActive: false,
      deactivatedAt: now,
      isArchived: true,
      archivedAt: sql`coalesce(${listings.archivedAt}, ${now})`,
    })
    .where(
      and(
        eq(listings.isActive, true),
        sql`${listings.lastSeenAt} < ${runStartedAt}`,
        sql`EXISTS (
          SELECT 1 FROM ${listingMatches}
          WHERE ${listingMatches.listingId} = ${listings.id}
            AND ${listingMatches.filterId} = ${filterId}
        )`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${listingMatches} m2
          WHERE m2.listing_id = ${listings.id}
            AND m2.filter_id <> ${filterId}
            AND m2.last_matched_at >= ${runStartedAt}
        )`,
      ),
    )
    .returning({ id: listings.id });

  return result.length;
}

export type { Listing };
