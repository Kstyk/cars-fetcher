import { and, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, type SQL } from 'drizzle-orm';
import { listings } from '../../db/schema.js';
import type { Filter } from '../../db/schema.js';

/**
 * Re-checks a stored listing against a filter's *current* criteria, so
 * `removeStaleMatches` can drop matches that predate an edit (the filter's
 * price ceiling got lowered, a fuel type got dropped, ...) instead of leaving
 * them stuck forever - nothing re-evaluates an existing match on its own,
 * since ingestion only ever adds/refreshes matches for what a fetch just
 * found, never revisits ones it didn't.
 *
 * Same "unknown never disqualifies" rule every provider's own `matchesCriteria`
 * already follows: a listing missing the field a criterion needs is kept, not
 * dropped - only a confirmed mismatch counts against it. A handful of
 * criteria have no column to check at all (equipment, first owner, serviced
 * at ASO, registered in PL, no-accident, a radius search) - those are simply
 * not enforced here, same gap adapters already have for attributes their
 * provider doesn't expose.
 */
export function buildFilterMatchCondition(filter: Filter): SQL {
  const clauses: SQL[] = [];

  if (filter.make) clauses.push(ilike(listings.make, filter.make));
  if (filter.model) clauses.push(ilike(listings.model, filter.model));
  if (filter.generation) clauses.push(ilike(listings.generation, filter.generation));
  if (filter.version) clauses.push(ilike(listings.version, filter.version));
  if (filter.query) {
    const pattern = `%${filter.query}%`;
    const textMatch = or(
      ilike(listings.title, pattern),
      ilike(listings.make, pattern),
      ilike(listings.model, pattern),
      ilike(listings.version, pattern),
    );
    if (textMatch) clauses.push(textMatch);
  }

  if (filter.yearFrom !== null) {
    clauses.push(or(isNull(listings.year), gte(listings.year, filter.yearFrom))!);
  }
  if (filter.yearTo !== null) {
    clauses.push(or(isNull(listings.year), lte(listings.year, filter.yearTo))!);
  }
  if (filter.priceFrom !== null) {
    clauses.push(or(isNull(listings.price), gte(listings.price, filter.priceFrom))!);
  }
  if (filter.priceTo !== null) {
    clauses.push(or(isNull(listings.price), lte(listings.price, filter.priceTo))!);
  }
  if (filter.mileageFrom !== null) {
    clauses.push(or(isNull(listings.mileageKm), gte(listings.mileageKm, filter.mileageFrom))!);
  }
  if (filter.mileageTo !== null) {
    clauses.push(or(isNull(listings.mileageKm), lte(listings.mileageKm, filter.mileageTo))!);
  }
  if (filter.enginePowerFrom !== null) {
    clauses.push(
      or(isNull(listings.enginePowerHp), gte(listings.enginePowerHp, filter.enginePowerFrom))!,
    );
  }
  if (filter.enginePowerTo !== null) {
    clauses.push(
      or(isNull(listings.enginePowerHp), lte(listings.enginePowerHp, filter.enginePowerTo))!,
    );
  }
  if (filter.engineCapacityFrom !== null) {
    clauses.push(
      or(
        isNull(listings.engineCapacityCm3),
        gte(listings.engineCapacityCm3, filter.engineCapacityFrom),
      )!,
    );
  }
  if (filter.engineCapacityTo !== null) {
    clauses.push(
      or(
        isNull(listings.engineCapacityCm3),
        lte(listings.engineCapacityCm3, filter.engineCapacityTo),
      )!,
    );
  }

  if (filter.fuelTypes?.length) {
    clauses.push(or(isNull(listings.fuelType), inArray(listings.fuelType, filter.fuelTypes))!);
  }
  if (filter.gearboxes?.length) {
    clauses.push(or(isNull(listings.gearbox), inArray(listings.gearbox, filter.gearboxes))!);
  }
  if (filter.bodyTypes?.length) {
    clauses.push(or(isNull(listings.bodyType), inArray(listings.bodyType, filter.bodyTypes))!);
  }
  if (filter.driveTypes?.length) {
    clauses.push(or(isNull(listings.driveType), inArray(listings.driveType, filter.driveTypes))!);
  }
  if (filter.colors?.length) {
    clauses.push(or(isNull(listings.color), inArray(listings.color, filter.colors))!);
  }
  if (filter.doorCounts?.length) {
    clauses.push(or(isNull(listings.doors), inArray(listings.doors, filter.doorCounts))!);
  }
  if (filter.seatCounts?.length) {
    clauses.push(or(isNull(listings.seats), inArray(listings.seats, filter.seatCounts))!);
  }

  if (filter.condition) {
    clauses.push(or(isNull(listings.condition), eq(listings.condition, filter.condition))!);
  }
  if (filter.sellerType) {
    clauses.push(
      or(eq(listings.sellerType, 'unknown'), eq(listings.sellerType, filter.sellerType))!,
    );
  }
  if (filter.countryOrigin) {
    clauses.push(
      or(isNull(listings.countryOrigin), ilike(listings.countryOrigin, filter.countryOrigin))!,
    );
  }
  // A radius search has no anchor stored on the listing to re-measure against
  // (the filter only keeps the city name, not coordinates) - skip rather than
  // wrongly reduce it to an exact-city match.
  if (filter.city && !filter.radiusKm) {
    clauses.push(or(isNull(listings.city), ilike(listings.city, filter.city))!);
  }
  if (filter.region) {
    clauses.push(or(isNull(listings.region), ilike(listings.region, filter.region))!);
  }

  if (filter.excludeDamaged) {
    clauses.push(or(isNull(listings.isDamaged), eq(listings.isDamaged, false))!);
  }
  // Presence checks, not attributes - a genuinely missing photo/VIN/VAT flag
  // is treated as a real "no", not as "unknown", unlike everything above.
  if (filter.onlyWithPhotos) clauses.push(isNotNull(listings.thumbnailUrl));
  if (filter.hasVin) clauses.push(isNotNull(listings.vin));
  if (filter.vatInvoice) {
    clauses.push(or(isNull(listings.hasVatInvoice), eq(listings.hasVatInvoice, true))!);
  }

  return clauses.length > 0 ? and(...clauses)! : eq(listings.id, listings.id);
}
