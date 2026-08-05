import { otomotoScraperSource } from '../providers/otomoto/otomoto-scraper.source.js';
import type { SearchCriteria } from '../providers/types.js';

/**
 * Manual smoke test for the Otomoto scraper - run with:
 *   npm run scrape:test --workspace @cars-fetcher/api
 *
 * Hits the live site, so keep it to a couple of pages.
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
  priceTo: 180_000,
  currency: 'PLN',
  mileageFrom: null,
  mileageTo: 200_000,
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

const result = await otomotoScraperSource.search(criteria, {
  page: 1,
  pageSize: 32,
});

console.log(
  `\ntotalCount=${result.totalCount}  zwrócono=${result.items.length}  hasNextPage=${result.hasNextPage}\n`,
);

for (const listing of result.items.slice(0, 8)) {
  console.log(
    [
      listing.title.padEnd(42).slice(0, 42),
      String(listing.year ?? '?').padStart(4),
      `${String(listing.price ?? '?').padStart(7)} ${listing.currency}`,
      `${String(listing.mileageKm ?? '?').padStart(7)} km`,
      String(listing.fuelType ?? '?').padEnd(13),
      String(listing.gearbox ?? '?').padEnd(10),
      `${listing.enginePowerHp ?? '?'} KM`.padStart(7),
      (listing.city ?? '?').padEnd(12),
      listing.sellerType.padEnd(8),
    ].join(' | '),
  );
}

const sample = result.items[0];
if (sample) {
  console.log('\nprzykładowy rekord:');
  console.log('  externalId :', sample.externalId);
  console.log('  url        :', sample.url);
  console.log('  thumbnail  :', sample.thumbnailUrl);
  console.log('  publishedAt:', sample.publishedAt?.toISOString());
  console.log('  sellerName :', sample.sellerName);
  console.log('  country    :', sample.countryOrigin);
  console.log('  vatInvoice :', sample.hasVatInvoice);
}

process.exit(0);
