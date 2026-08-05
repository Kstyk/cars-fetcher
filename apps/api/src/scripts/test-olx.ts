import { olxSource } from '../providers/olx/olx.source.js';
import type { SearchCriteria } from '../providers/types.js';

/**
 * Manual smoke test for the OLX adapter - run with:
 *   npm run olx:test --workspace @cars-fetcher/api
 *
 * Hits the live API, so keep it to a page or two.
 */
const criteria: SearchCriteria = {
  make: 'Volvo',
  model: 'XC 60',
  generation: null,
  version: null,
  query: null,
  yearFrom: 2018,
  yearTo: null,
  priceFrom: null,
  priceTo: 200_000,
  currency: 'PLN',
  mileageFrom: null,
  mileageTo: 250_000,
  enginePowerFrom: null,
  enginePowerTo: null,
  engineCapacityFrom: null,
  engineCapacityTo: null,
  fuelTypes: ['diesel', 'hybrid', 'plugin_hybrid'],
  gearboxes: ['automatic'],
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

const result = await olxSource.search(criteria, { page: 1, pageSize: 40 });

console.log(
  `\ntotalCount=${result.totalCount}  po filtrach=${result.items.length}  hasNextPage=${result.hasNextPage}\n`,
);

for (const listing of result.items.slice(0, 10)) {
  console.log(
    [
      listing.title.slice(0, 38).padEnd(38),
      String(listing.year ?? '?').padStart(4),
      `${String(listing.price ?? '?').padStart(7)} ${listing.currency}`,
      `${String(listing.mileageKm ?? '?').padStart(7)} km`,
      String(listing.fuelType ?? '?').padEnd(13),
      String(listing.bodyType ?? '?').padEnd(9),
      String(listing.color ?? '?').padEnd(10),
      (listing.city ?? '?').padEnd(12),
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
  console.log('  model      :', sample.model);
  console.log('  napęd      :', sample.driveType);
  console.log('  kraj       :', sample.countryOrigin);
  console.log('  VIN        :', sample.vin);
  console.log('  publishedAt:', sample.publishedAt?.toISOString());
}

process.exit(0);
