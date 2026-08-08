import { sprzedajemySource } from '../providers/sprzedajemy/sprzedajemy.source.js';
import type { SearchCriteria } from '../providers/types.js';

/**
 * Manual smoke test for the sprzedajemy.pl adapter - run with:
 *   npm run sprzedajemy:test --workspace @cars-fetcher/api
 *
 * Hits the live site, so keep it to a page or two.
 */
const criteria: SearchCriteria = {
  make: 'Audi',
  model: 'A4',
  generation: null,
  version: null,
  query: null,
  yearFrom: 2015,
  yearTo: null,
  priceFrom: 20_000,
  priceTo: 150_000,
  currency: 'PLN',
  mileageFrom: null,
  mileageTo: 250_000,
  enginePowerFrom: null,
  enginePowerTo: null,
  engineCapacityFrom: null,
  engineCapacityTo: null,
  fuelTypes: null,
  gearboxes: null,
  bodyTypes: null,
  driveTypes: null,
  condition: null,
  sellerType: null,
  excludeDamaged: true,
  onlyWithPhotos: false,
  registeredInPl: null,
  firstOwner: null,
  countryOrigin: null,
  region: null,
  city: null,
  radiusKm: null,
  colors: null,
  doorCounts: null,
  seatCounts: null,
  noAccident: null,
  servicedAtAso: null,
  hasVin: null,
  vatInvoice: null,
  equipment: null,
  extraParams: null,
};

const result = await sprzedajemySource.search(criteria, { page: 1, pageSize: 30 });

console.log(
  `\ntotalCount=${result.totalCount}  po filtrach=${result.items.length}  hasNextPage=${result.hasNextPage}\n`,
);

for (const listing of result.items.slice(0, 15)) {
  console.log(
    [
      listing.title.slice(0, 38).padEnd(38),
      String(listing.year ?? '?').padStart(4),
      `${String(listing.price ?? '?').padStart(7)} ${listing.currency}`,
      `${String(listing.mileageKm ?? '?').padStart(7)} km`,
      String(listing.fuelType ?? '?').padEnd(9),
      (listing.city ?? '?').padEnd(14),
      listing.sellerType,
    ].join(' | '),
  );
}

const sample = result.items[0];
if (sample) {
  console.log('\nprzykładowy rekord:');
  console.log('  externalId :', sample.externalId);
  console.log('  url        :', sample.url);
  console.log('  thumbnail  :', sample.thumbnailUrl);
  console.log('  sprzedawca :', sample.sellerName, sample.sellerType);
  console.log('  silnik cm3 :', sample.engineCapacityCm3);
  console.log('  publishedAt:', sample.publishedAt?.toISOString());
}

process.exit(0);
