import crypto from 'node:crypto';
import type {
  BodyType,
  DriveType,
  FuelType,
  Gearbox,
  ListingSource,
  NormalizedListing,
  SearchCriteria,
  SearchOptions,
  SearchResult,
} from '../types.js';

/**
 * Deterministic stand-in for a real marketplace, used when Otomoto credentials
 * are absent. It honours make/model/year/price/mileage criteria so the whole
 * pipeline - matching, price history, notifications - is exercisable offline.
 *
 * Results are derived from a seeded hash of the criteria, so repeated runs
 * return the same cars and re-fetching behaves like a stable marketplace.
 */
export class FixtureSource implements ListingSource {
  readonly provider = 'otomoto' as const;

  isConfigured(): boolean {
    return true;
  }

  async search(
    criteria: SearchCriteria,
    options: SearchOptions,
  ): Promise<SearchResult> {
    const makes = criteria.make ? [criteria.make] : DEFAULT_MAKES;
    const total = 60;
    const start = (options.page - 1) * options.pageSize;
    const count = Math.max(0, Math.min(options.pageSize, total - start));

    const items: NormalizedListing[] = [];
    for (let i = 0; i < count; i += 1) {
      const index = start + i;
      const make = makes[index % makes.length] ?? 'Volvo';
      const listing = this.buildListing(make, criteria, index);
      if (matchesCriteria(listing, criteria)) items.push(listing);
    }

    // Simulate network latency so loading states are visible in development.
    await new Promise((resolve) => setTimeout(resolve, 120));

    return {
      items,
      page: options.page,
      pageSize: options.pageSize,
      totalCount: total,
      hasNextPage: start + options.pageSize < total,
    };
  }

  private buildListing(
    make: string,
    criteria: SearchCriteria,
    index: number,
  ): NormalizedListing {
    const seed = hashSeed(`${make}|${criteria.model ?? ''}|${index}`);
    const rand = mulberry32(seed);

    const modelPool = MODELS[make.toLowerCase()] ?? ['Model'];
    const model =
      criteria.model ?? modelPool[Math.floor(rand() * modelPool.length)] ?? 'Model';

    const year = clampRange(
      2012 + Math.floor(rand() * 13),
      criteria.yearFrom,
      criteria.yearTo,
    );
    const mileageKm = Math.round(
      clampRange(
        (2025 - year) * (8_000 + rand() * 14_000),
        criteria.mileageFrom,
        criteria.mileageTo,
      ),
    );
    const basePrice = 180_000 - (2025 - year) * 11_000 - mileageKm * 0.12;
    const price = Math.round(
      clampRange(
        Math.max(9_000, basePrice * (0.8 + rand() * 0.45)),
        criteria.priceFrom,
        criteria.priceTo,
      ) / 100,
    ) * 100;

    const fuelType = pickFrom(FUELS, rand, criteria.fuelTypes);
    const gearbox = pickFrom(GEARBOXES, rand, criteria.gearboxes);
    const bodyType = pickFrom(BODIES, rand, criteria.bodyTypes);
    const driveType = pickFrom(DRIVES, rand, criteria.driveTypes);
    const city = CITIES[Math.floor(rand() * CITIES.length)] ?? 'Warszawa';
    const enginePowerHp = 90 + Math.floor(rand() * 260);
    const engineCapacityCm3 = fuelType === 'electric' ? null : 998 + Math.floor(rand() * 2_500);
    const externalId = `fx-${seed.toString(36)}`;

    return {
      provider: 'otomoto',
      externalId,
      url: `https://www.otomoto.pl/osobowe/oferta/${slugify(
        `${make} ${model} ${year}`,
      )}-ID${externalId}.html`,
      title: [
        make,
        model,
        engineCapacityCm3 ? `${(engineCapacityCm3 / 1000).toFixed(1)}` : 'Electric',
        `${enginePowerHp} KM`,
      ].join(' '),
      make,
      model,
      generation: null,
      version: null,
      price,
      currency: 'PLN',
      priceGross: true,
      hasVatInvoice: rand() > 0.6,
      year,
      mileageKm,
      fuelType,
      gearbox,
      bodyType,
      driveType,
      engineCapacityCm3,
      enginePowerHp,
      doors: rand() > 0.3 ? 5 : 3,
      seats: 5,
      color: COLORS[Math.floor(rand() * COLORS.length)] ?? 'Czarny',
      condition: 'used',
      isDamaged: false,
      vin: null,
      firstRegistrationDate: new Date(Date.UTC(year, Math.floor(rand() * 12), 1)),
      countryOrigin: rand() > 0.5 ? 'Polska' : 'Niemcy',
      sellerType: rand() > 0.5 ? 'dealer' : 'private',
      sellerName: rand() > 0.5 ? 'Auto Centrum' : null,
      city,
      region: REGION_BY_CITY[city] ?? 'Mazowieckie',
      country: 'Polska',
      latitude: null,
      longitude: null,
      thumbnailUrl: null,
      imagesCount: 3 + Math.floor(rand() * 12),
      publishedAt: new Date(Date.now() - Math.floor(rand() * 21) * 86_400_000),
      raw: { source: 'fixture', seed, index },
    };
  }
}

/* -------------------------------------------------------------------------- */

const DEFAULT_MAKES = ['Volvo', 'Toyota', 'Mazda', 'Kia', 'BMW', 'Audi', 'Skoda'];

const MODELS: Record<string, string[]> = {
  volvo: ['XC60', 'XC90', 'V60', 'V90', 'S60', 'XC40'],
  toyota: ['RAV4', 'Corolla', 'C-HR', 'Camry', 'Yaris', 'Auris'],
  mazda: ['CX-5', 'Mazda 6', 'Mazda 3', 'CX-30', 'CX-60'],
  kia: ['Sportage', 'Ceed', 'Sorento', 'Niro', 'XCeed'],
  bmw: ['Seria 3', 'Seria 5', 'X3', 'X5'],
  audi: ['A4', 'A6', 'Q5', 'Q3'],
  skoda: ['Octavia', 'Superb', 'Kodiaq', 'Karoq'],
};

const FUELS: FuelType[] = ['petrol', 'diesel', 'hybrid', 'plugin_hybrid', 'electric'];
const GEARBOXES: Gearbox[] = ['manual', 'automatic'];
const BODIES: BodyType[] = ['suv', 'wagon', 'sedan', 'hatchback'];
const DRIVES: DriveType[] = ['fwd', 'awd'];
const COLORS = ['Czarny', 'Biały', 'Srebrny', 'Granatowy', 'Szary', 'Czerwony'];
const CITIES = [
  'Warszawa',
  'Kraków',
  'Poznań',
  'Wrocław',
  'Gdańsk',
  'Katowice',
  'Łódź',
];
const REGION_BY_CITY: Record<string, string> = {
  Warszawa: 'Mazowieckie',
  Kraków: 'Małopolskie',
  Poznań: 'Wielkopolskie',
  Wrocław: 'Dolnośląskie',
  Gdańsk: 'Pomorskie',
  Katowice: 'Śląskie',
  Łódź: 'Łódzkie',
};

function hashSeed(input: string): number {
  return crypto.createHash('sha1').update(input).digest().readUInt32BE(0);
}

/** Small deterministic PRNG - same seed, same car, every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampRange(
  value: number,
  min: number | null | undefined,
  max: number | null | undefined,
): number {
  let result = value;
  if (min !== null && min !== undefined) result = Math.max(result, min);
  if (max !== null && max !== undefined) result = Math.min(result, max);
  return result;
}

function pickFrom<T extends string>(
  pool: readonly T[],
  rand: () => number,
  constrainedTo: readonly T[] | null | undefined,
): T {
  const source = constrainedTo?.length ? constrainedTo : pool;
  return source[Math.floor(rand() * source.length)] ?? (pool[0] as T);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Guards against the generator drifting outside the requested ranges. */
function matchesCriteria(
  listing: NormalizedListing,
  criteria: SearchCriteria,
): boolean {
  const withinRange = (
    value: number | null | undefined,
    from: number | null | undefined,
    to: number | null | undefined,
  ): boolean => {
    if (value === null || value === undefined) return true;
    if (from !== null && from !== undefined && value < from) return false;
    if (to !== null && to !== undefined && value > to) return false;
    return true;
  };

  return (
    withinRange(listing.year, criteria.yearFrom, criteria.yearTo) &&
    withinRange(listing.price, criteria.priceFrom, criteria.priceTo) &&
    withinRange(listing.mileageKm, criteria.mileageFrom, criteria.mileageTo) &&
    withinRange(
      listing.enginePowerHp,
      criteria.enginePowerFrom,
      criteria.enginePowerTo,
    ) &&
    (!criteria.excludeDamaged || listing.isDamaged !== true)
  );
}

export const fixtureSource = new FixtureSource();
