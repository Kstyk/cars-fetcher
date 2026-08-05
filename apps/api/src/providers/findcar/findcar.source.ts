import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { UpstreamError } from '../../lib/errors.js';
import { normalizeVoivodeship } from '../../lib/regions.js';
import { scrapingClient, type ScrapingClient } from '../scraping/http-client.js';
import { slugify } from '../scraping/next-data.js';
import type {
  BodyType,
  FuelType,
  Gearbox,
  ListingSource,
  NormalizedListing,
  SearchCriteria,
  SearchOptions,
  SearchResult,
} from '../types.js';

/* -------------------------------------------------------------------------- */
/*                        Shape of the embedded payload                       */
/* -------------------------------------------------------------------------- */

interface Named {
  text?: string;
  enumCode?: string;
  slug?: string;
}

interface FindcarListing {
  publicListingNumber?: string;
  slug?: string;
  make?: Named;
  model?: Named & { canonicalName?: string };
  version?: string;
  transmission?: Named;
  mileageKm?: number;
  productionYear?: number;
  fuelType?: Named;
  /** Display string such as "158 KM". */
  enginePowerHp?: string;
  pricing?: {
    offer?: {
      /** Price in grosze - 12 590 000 means 125 900 zł. */
      offerPricePln100?: number;
      displayAmount?: string;
    };
  };
  primaryImage?: string;
  statusBadges?: Named[];
  dealer?: { name?: string; city?: string; dealershipLocationSlug?: string };
}

interface ListingsPage {
  content?: FindcarListing[];
  totalElements?: number;
  totalPages?: number;
}

/* -------------------------------------------------------------------------- */
/*                                Dictionaries                                */
/* -------------------------------------------------------------------------- */

const FUEL_FROM: Record<string, FuelType> = {
  petrol: 'petrol',
  petrol_lpg: 'petrol_lpg',
  petrol_cng: 'petrol_cng',
  diesel: 'diesel',
  hybrid_hev: 'hybrid',
  hybrid_mhev: 'hybrid',
  hybrid: 'hybrid',
  hybrid_phev: 'plugin_hybrid',
  electric: 'electric',
  hydrogen: 'hydrogen',
};

const FUEL_TO: Record<string, string> = {
  petrol: 'petrol',
  petrol_lpg: 'petrol_lpg',
  petrol_cng: 'petrol_cng',
  diesel: 'diesel',
  hybrid: 'hybrid_hev,hybrid_mhev',
  plugin_hybrid: 'hybrid_phev',
  electric: 'electric',
  hydrogen: 'hydrogen',
};

const GEARBOX_FROM: Record<string, Gearbox> = {
  automatic: 'automatic',
  manual: 'manual',
  semi_automatic: 'semi_automatic',
};

const BODY_TO: Record<string, string> = {
  sedan: 'sedan',
  hatchback: 'hatchback',
  wagon: 'wagon',
  suv: 'suv',
  coupe: 'coupe',
  convertible: 'convertible',
  minivan: 'minivan',
  van: 'van',
  pickup: 'pickup',
};

/** FindCar renders 15 offers per page. */
const PAGE_SIZE = 15;
const BASE_URL = 'https://findcar.pl';
const SEARCH_PATH = '/znajdz-samochod';
/** Offer pages live under this prefix - see sitemap-announcements-*.xml. */
const OFFER_PATH = '/oferty-dealerow';

/**
 * Reads findcar.pl search results.
 *
 * Angular with SSR: the page dehydrates its TanStack Query cache into a
 * `<script type="application/json">` block, and the `listings` query inside it
 * holds a Spring-style page (`content`, `totalElements`, `totalPages`).
 *
 * robots.txt is permissive - `User-agent: *` with an empty `Disallow:`, so
 * every path including the filtered search is fair game.
 *
 * Note on scope: FindCar aggregates **dealer** stock, heavily weighted towards
 * new and nearly-new cars. Expect little overlap with the private-seller
 * listings that dominate OLX.
 */
export class FindcarSource implements ListingSource {
  readonly provider = 'findcar' as const;

  constructor(private readonly http: ScrapingClient = scrapingClient) {}

  isConfigured(): boolean {
    return true;
  }

  async search(
    criteria: SearchCriteria,
    options: SearchOptions,
  ): Promise<SearchResult> {
    const url = this.buildUrl(criteria, options.page);
    const html = await this.http.fetchHtml(url, { signal: options.signal });
    const page = extractListingsPage(html);

    if (!page) {
      throw new UpstreamError(
        'Nie znaleziono danych ofert na findcar.pl - struktura strony się zmieniła',
      );
    }

    const rows = page.content ?? [];
    const items = rows
      .map((row) => this.toListing(row))
      .filter((listing): listing is NormalizedListing => listing !== null)
      .filter((listing) => matchesCriteria(listing, criteria));

    logger.debug(
      {
        url: url.toString(),
        page: options.page,
        received: rows.length,
        kept: items.length,
        totalCount: page.totalElements,
      },
      'findcar page scraped',
    );

    return {
      items,
      page: options.page,
      pageSize: PAGE_SIZE,
      totalCount: page.totalElements,
      hasNextPage:
        page.totalPages !== undefined
          ? options.page < page.totalPages
          : rows.length >= PAGE_SIZE,
    };
  }

  /** Their search accepts plain query parameters - no path segments needed. */
  private buildUrl(criteria: SearchCriteria, page: number): URL {
    const url = new URL(SEARCH_PATH, BASE_URL);
    const set = (key: string, value: unknown): void => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    };

    if (criteria.make) set('makes', slugify(criteria.make));
    if (criteria.model) set('models', slugify(criteria.model));

    set('yearMin', criteria.yearFrom);
    set('yearMax', criteria.yearTo);
    set('priceMin', criteria.priceFrom);
    set('priceMax', criteria.priceTo);
    set('mileageMin', criteria.mileageFrom);
    set('mileageMax', criteria.mileageTo);
    set('powerMin', criteria.enginePowerFrom);
    set('powerMax', criteria.enginePowerTo);

    const fuels = (criteria.fuelTypes ?? [])
      .map((fuel) => FUEL_TO[fuel])
      .filter((fuel): fuel is string => Boolean(fuel));
    if (fuels.length) set('fuelTypes', fuels.join(','));

    const bodies = (criteria.bodyTypes ?? [])
      .map((body) => BODY_TO[body])
      .filter((body): body is string => Boolean(body));
    if (bodies.length) set('bodyTypes', bodies.join(','));

    if (criteria.condition === 'new') set('conditions', 'vehicle_new');
    if (criteria.condition === 'used') set('conditions', 'vehicle_used');

    // The UI pages from 1; the backing query is zero-based.
    if (page > 1) set('page', page - 1);
    return url;
  }

  private toListing(row: FindcarListing): NormalizedListing | null {
    const externalId = row.publicListingNumber;
    if (!externalId || !row.slug) return null;

    // Prices come in grosze.
    const grosze = row.pricing?.offer?.offerPricePln100;
    const price = typeof grosze === 'number' ? Math.round(grosze / 100) : null;

    const isNew = (row.statusBadges ?? []).some(
      (badge) => badge.enumCode === 'BADGE_TYPE_NEW',
    );

    // Voivodeship is not a field of its own - it sits in the slug, between the
    // body type and the dealer name, e.g. "...-suv-mazowieckie-renault-pgd-...".
    const region = extractRegionFromSlug(row.slug);

    return {
      provider: 'findcar',
      externalId,
      url: `${BASE_URL}${OFFER_PATH}/${row.slug}`,
      title: [row.make?.text, row.model?.text, row.version]
        .filter(Boolean)
        .join(' ')
        .slice(0, 500),

      make: row.make?.text ?? null,
      model: row.model?.text ?? row.model?.canonicalName ?? null,
      generation: null,
      version: row.version ?? null,

      price,
      currency: 'PLN',
      priceGross: true,
      hasVatInvoice: null,

      year: row.productionYear ?? null,
      mileageKm: row.mileageKm ?? null,
      fuelType: row.fuelType?.enumCode
        ? (FUEL_FROM[row.fuelType.enumCode] ?? null)
        : null,
      gearbox: row.transmission?.enumCode
        ? (GEARBOX_FROM[row.transmission.enumCode] ?? null)
        : null,
      bodyType: extractBodyFromSlug(row.slug),
      driveType: null,
      engineCapacityCm3: null,
      // Arrives as "158 KM".
      enginePowerHp: parseInt(row.enginePowerHp ?? '', 10) || null,
      doors: null,
      seats: null,
      color: null,

      condition: isNew ? 'new' : 'used',
      isDamaged: null,
      vin: null,
      firstRegistrationDate: null,
      countryOrigin: null,

      // Every listing here comes from a dealership.
      sellerType: 'dealer',
      sellerName: row.dealer?.name ?? null,

      city: row.dealer?.city ?? null,
      region,
      country: 'Polska',
      latitude: null,
      longitude: null,

      thumbnailUrl: row.primaryImage ?? null,
      imagesCount: null,
      publishedAt: null,

      raw: row as unknown as Record<string, unknown>,
    };
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Digs the `listings` query out of the dehydrated TanStack Query cache. The
 * query key is `["_listings_core_", "listings", filters, paging]`, so the
 * lookup keys off the second element rather than a fixed hash.
 */
function extractListingsPage(html: string): ListingsPage | null {
  const blocks = [
    ...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g),
  ];

  for (const block of blocks) {
    const body = block[1] ?? '';
    if (body.length < 5_000) continue;

    let state: Record<string, unknown>;
    try {
      state = JSON.parse(body.replace(/&q;/g, '"').replace(/&a;/g, '&'));
    } catch {
      continue;
    }

    const container = state.TANSTACK_QUERY_STATE as
      | { b?: { queries?: QueryEntry[] }; queries?: QueryEntry[] }
      | undefined;
    const queries = container?.b?.queries ?? container?.queries;
    if (!queries) continue;

    for (const query of queries) {
      if (query.queryKey?.[1] !== 'listings') continue;
      const data = query.state?.data as ListingsPage | undefined;
      if (Array.isArray(data?.content)) return data;
    }
  }
  return null;
}

interface QueryEntry {
  queryKey?: unknown[];
  state?: { data?: unknown };
}

const REGION_SLUGS = new Map(
  [
    'dolnoslaskie',
    'kujawsko-pomorskie',
    'lubelskie',
    'lubuskie',
    'lodzkie',
    'malopolskie',
    'mazowieckie',
    'opolskie',
    'podkarpackie',
    'podlaskie',
    'pomorskie',
    'slaskie',
    'swietokrzyskie',
    'warminsko-mazurskie',
    'wielkopolskie',
    'zachodniopomorskie',
  ].map((slug) => [slug, slug]),
);

function extractRegionFromSlug(slug: string): string | null {
  for (const candidate of REGION_SLUGS.keys()) {
    if (slug.includes(`-${candidate}-`)) return normalizeVoivodeship(candidate);
  }
  return null;
}

const BODY_SLUGS: Record<string, BodyType> = {
  suv: 'suv',
  sedan: 'sedan',
  kombi: 'wagon',
  hatchback: 'hatchback',
  coupe: 'coupe',
  kabriolet: 'convertible',
  minivan: 'minivan',
  van: 'van',
  pickup: 'pickup',
};

function extractBodyFromSlug(slug: string): BodyType | null {
  for (const [needle, body] of Object.entries(BODY_SLUGS)) {
    if (slug.includes(`-${needle}-`)) return body;
  }
  return null;
}

/** Criteria the search page cannot express are enforced here. */
function matchesCriteria(
  listing: NormalizedListing,
  criteria: SearchCriteria,
): boolean {
  const sameText = (a: string | null | undefined, b: string | null | undefined) =>
    !b || (a ? slugify(a) === slugify(b) : false);

  if (!sameText(listing.make, criteria.make)) return false;
  if (!sameText(listing.model, criteria.model)) return false;

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

  if (!withinRange(listing.year, criteria.yearFrom, criteria.yearTo)) return false;
  if (!withinRange(listing.price, criteria.priceFrom, criteria.priceTo)) return false;
  if (!withinRange(listing.mileageKm, criteria.mileageFrom, criteria.mileageTo)) {
    return false;
  }
  if (
    !withinRange(listing.enginePowerHp, criteria.enginePowerFrom, criteria.enginePowerTo)
  ) {
    return false;
  }

  if (criteria.fuelTypes?.length && listing.fuelType) {
    if (!criteria.fuelTypes.includes(listing.fuelType)) return false;
  }
  if (criteria.gearboxes?.length && listing.gearbox) {
    if (!criteria.gearboxes.includes(listing.gearbox)) return false;
  }

  const floor = env.SCRAPER_MIN_PRICE_PLN;
  if (floor > 0 && listing.price !== null && listing.price !== undefined) {
    const minimum = criteria.priceFrom ?? floor;
    if (listing.price < minimum) return false;
  }

  return true;
}

export const findcarSource = new FindcarSource();
