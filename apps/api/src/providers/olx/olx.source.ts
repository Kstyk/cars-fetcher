import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { UpstreamError } from '../../lib/errors.js';
import { scrapingClient, type ScrapingClient } from '../scraping/http-client.js';
import { slugify } from '../scraping/next-data.js';
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
  SellerType,
  VehicleCondition,
} from '../types.js';

/* -------------------------------------------------------------------------- */
/*                             OLX response shape                             */
/* -------------------------------------------------------------------------- */

interface OlxParamValue {
  key?: string;
  label?: string;
  value?: number | string;
  currency?: string;
  negotiable?: boolean;
}

interface OlxParam {
  key?: string;
  name?: string;
  value?: OlxParamValue;
}

interface OlxOffer {
  id?: number | string;
  url?: string;
  title?: string;
  description?: string;
  created_time?: string;
  last_refresh_time?: string;
  business?: boolean;
  params?: OlxParam[];
  photos?: Array<{ link?: string; width?: number; height?: number }>;
  location?: {
    city?: { name?: string };
    region?: { name?: string };
  };
  user?: { name?: string; business?: boolean };
  category?: { id?: number; type?: string };
}

interface OlxResponse {
  data?: OlxOffer[];
  metadata?: { total_elements?: number; visible_total_count?: number };
  error?: unknown;
}

interface OlxTaxonomy {
  allCarsCategoryId: number;
  makes: Array<{ slug: string; label: string; categoryId: number }>;
}

/* -------------------------------------------------------------------------- */
/*                                Dictionaries                                */
/* -------------------------------------------------------------------------- */

const FUEL_FROM_OLX: Record<string, FuelType> = {
  petrol: 'petrol',
  'petrol-lpg': 'petrol_lpg',
  'petrol-cng': 'petrol_cng',
  lpg: 'petrol_lpg',
  diesel: 'diesel',
  hybrid: 'hybrid',
  'plugin-hybrid': 'plugin_hybrid',
  electric: 'electric',
  hydrogen: 'hydrogen',
  etanol: 'other',
};

const FUEL_TO_OLX: Record<string, string> = {
  petrol: 'petrol',
  petrol_lpg: 'petrol-lpg',
  petrol_cng: 'petrol-cng',
  diesel: 'diesel',
  hybrid: 'hybrid',
  plugin_hybrid: 'plugin-hybrid',
  electric: 'electric',
  hydrogen: 'hydrogen',
};

const GEARBOX_FROM_OLX: Record<string, Gearbox> = {
  manual: 'manual',
  automatic: 'automatic',
  'semi-automatic': 'semi_automatic',
};

const GEARBOX_TO_OLX: Record<string, string> = {
  manual: 'manual',
  automatic: 'automatic',
  semi_automatic: 'semi-automatic',
};

const BODY_FROM_OLX: Record<string, BodyType> = {
  sedan: 'sedan',
  compact: 'hatchback',
  hatchback: 'hatchback',
  combi: 'wagon',
  kombi: 'wagon',
  suv: 'suv',
  coupe: 'coupe',
  cabrio: 'convertible',
  minivan: 'minivan',
  minibus: 'minivan',
  van: 'van',
  pickup: 'pickup',
  'small-cars': 'hatchback',
};

const BODY_TO_OLX: Record<string, string> = {
  sedan: 'sedan',
  hatchback: 'compact',
  wagon: 'combi',
  suv: 'suv',
  coupe: 'coupe',
  convertible: 'cabrio',
  minivan: 'minivan',
  van: 'van',
  pickup: 'pickup',
};

const DRIVE_FROM_OLX: Record<string, DriveType> = {
  'front-wheel': 'fwd',
  'rear-wheel': 'rwd',
  'all-wheel-permanent': 'awd',
  'all-wheel-auto': 'awd',
  'all-wheel-attached': 'awd',
  '4x4': 'awd',
};

/** OLX caps a page at 40 offers and the total at 1000. */
const PAGE_SIZE = 40;
const API_URL = 'https://www.olx.pl/api/v1/offers/';

/**
 * Reads OLX car adverts through their public offers API.
 *
 * `robots.txt` disallows `/api/` in general but carves out an explicit
 * `Allow: /api/v1/offers/`, so this is the sanctioned path - JSON straight from
 * the source, no HTML parsing.
 *
 * Three quirks shape the implementation:
 *   1. There is no make filter. The API rejects `filter_enum_make` with
 *      "Dynamic filters not applicable for category 84", because every make is
 *      its own category (Volvo = 208). Hence the slug -> category map.
 *   2. Offers carry richer attributes than Otomoto's search results - body
 *      type, colour and drive are all present here.
 *   3. CloudFront hands back a hard 403 to plain `fetch`/curl on this domain
 *      regardless of headers, but lets a real browser through - `useBrowser`
 *      routes this adapter's requests through headless Chromium instead
 *      (see `browser-fetch.ts`).
 */
export class OlxSource implements ListingSource {
  readonly provider = 'olx' as const;

  private taxonomy: OlxTaxonomy | null = null;

  constructor(private readonly http: ScrapingClient = scrapingClient) {}

  isConfigured(): boolean {
    return true;
  }

  async search(
    criteria: SearchCriteria,
    options: SearchOptions,
  ): Promise<SearchResult> {
    const url = await this.buildUrl(criteria, options.page);
    const body = await this.http.fetchHtml(url, {
      signal: options.signal,
      headers: { Accept: 'application/json' },
      // Plain `fetch` gets a hard 403 from OLX's CloudFront regardless of
      // headers - only a real browser TLS/HTTP2 fingerprint gets through.
      useBrowser: true,
    });

    let payload: OlxResponse;
    try {
      payload = JSON.parse(body) as OlxResponse;
    } catch {
      throw new UpstreamError('OLX zwróciło odpowiedź, która nie jest JSON-em');
    }

    if (payload.error) {
      throw new UpstreamError('OLX odrzuciło zapytanie', payload.error);
    }

    const offers = payload.data ?? [];
    const items = offers
      .map((offer) => this.toListing(offer, criteria.make ?? null))
      .filter((listing): listing is NormalizedListing => listing !== null)
      // The API has no make filter, so the make is enforced here.
      .filter((listing) => matchesCriteria(listing, criteria));

    const totalCount =
      payload.metadata?.total_elements ?? payload.metadata?.visible_total_count;

    logger.debug(
      { page: options.page, received: offers.length, kept: items.length, totalCount },
      'OLX page fetched',
    );

    return {
      items,
      page: options.page,
      pageSize: PAGE_SIZE,
      totalCount,
      hasNextPage: offers.length >= PAGE_SIZE,
    };
  }

  private async buildUrl(criteria: SearchCriteria, page: number): Promise<URL> {
    const taxonomy = await this.loadTaxonomy();
    const url = new URL(API_URL);

    const set = (key: string, value: unknown): void => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    };

    url.searchParams.set('offset', String((page - 1) * PAGE_SIZE));
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('category_id', String(this.resolveCategory(criteria, taxonomy)));

    // With no dedicated make category, fall back to a free-text query.
    const queryParts = [criteria.query];
    if (criteria.make && this.resolveCategory(criteria, taxonomy) === taxonomy.allCarsCategoryId) {
      queryParts.unshift(criteria.make);
    }
    if (criteria.model) queryParts.push(criteria.model);
    const query = queryParts.filter(Boolean).join(' ').trim();
    if (query) set('query', query);

    set('filter_float_price:from', criteria.priceFrom);
    set('filter_float_price:to', criteria.priceTo);
    set('filter_float_year:from', criteria.yearFrom);
    set('filter_float_year:to', criteria.yearTo);
    set('filter_float_milage:from', criteria.mileageFrom);
    set('filter_float_milage:to', criteria.mileageTo);
    set('filter_float_enginepower:from', criteria.enginePowerFrom);
    set('filter_float_enginepower:to', criteria.enginePowerTo);
    set('filter_float_enginesize:from', criteria.engineCapacityFrom);
    set('filter_float_enginesize:to', criteria.engineCapacityTo);

    setEnumList(url, 'filter_enum_petrol', criteria.fuelTypes, FUEL_TO_OLX);
    setEnumList(url, 'filter_enum_transmission', criteria.gearboxes, GEARBOX_TO_OLX);
    setEnumList(url, 'filter_enum_car_body', criteria.bodyTypes, BODY_TO_OLX);

    if (criteria.countryOrigin) {
      url.searchParams.set(
        'filter_enum_country_origin[0]',
        criteria.countryOrigin.toLowerCase(),
      );
    }
    if (criteria.excludeDamaged) {
      url.searchParams.set('filter_enum_condition[0]', 'notdamaged');
    }
    (criteria.colors ?? []).forEach((color, index) => {
      url.searchParams.set(`filter_enum_color[${index}]`, slugify(color));
    });

    set('sort_by', 'created_at:desc');
    return url;
  }

  private resolveCategory(criteria: SearchCriteria, taxonomy: OlxTaxonomy): number {
    if (!criteria.make) return taxonomy.allCarsCategoryId;

    const wanted = slugify(criteria.make);
    const make = taxonomy.makes.find(
      (entry) => entry.slug === wanted || slugify(entry.label) === wanted,
    );

    if (!make) {
      logger.warn(
        { make: criteria.make },
        'Brak kategorii OLX dla marki - szukam w kategorii ogólnej',
      );
      return taxonomy.allCarsCategoryId;
    }
    return make.categoryId;
  }

  private async loadTaxonomy(): Promise<OlxTaxonomy> {
    if (this.taxonomy) return this.taxonomy;

    const file = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../data/olx-taxonomy.json',
    );

    try {
      this.taxonomy = JSON.parse(await readFile(file, 'utf8')) as OlxTaxonomy;
      logger.info({ makes: this.taxonomy.makes.length }, 'OLX taxonomy loaded');
    } catch {
      // Without the map every search still works, just without a make category.
      logger.warn(
        'Brak olx-taxonomy.json - uruchom npm run taxonomy:olx. Szukanie po marce będzie mniej dokładne.',
      );
      this.taxonomy = { allCarsCategoryId: 84, makes: [] };
    }
    return this.taxonomy;
  }

  private toListing(
    offer: OlxOffer,
    /** The searched make - OLX encodes it in the category, not in the offer. */
    searchedMake: string | null,
  ): NormalizedListing | null {
    const externalId = String(offer.id ?? '').trim();
    const url = offer.url?.trim();
    if (!externalId || !url) return null;

    const params = new Map<string, OlxParamValue>();
    for (const param of offer.params ?? []) {
      if (param.key && param.value) params.set(param.key, param.value);
    }

    const price = params.get('price');
    const priceValue = typeof price?.value === 'number' ? price.value : null;

    // OLX photo links are templates: ".../image;s={width}x{height}".
    const photo = offer.photos?.[0]?.link;
    const thumbnailUrl = photo
      ? photo.replace('{width}', '640').replace('{height}', '480')
      : null;

    const isBusiness = offer.business ?? offer.user?.business ?? false;
    const condition = params.get('condition')?.key;

    return {
      provider: 'olx',
      externalId,
      url,
      title: (offer.title ?? 'Ogłoszenie').slice(0, 500),

      // Offers carry no make field - the category implies it. When the search
      // was not scoped to one make, fall back to the first word of the title,
      // which is how these adverts are written ("Volvo XC 60 ...").
      make: searchedMake ?? firstWordAsMake(offer.title),
      model: params.get('model')?.label?.trim() ?? null,
      generation: null,
      version: null,

      price: priceValue,
      currency: price?.currency ?? 'PLN',
      priceGross: null,
      hasVatInvoice: null,

      year: toInt(params.get('year')?.key),
      mileageKm: toInt(params.get('milage')?.key),
      fuelType: lookup(FUEL_FROM_OLX, params.get('petrol')?.key),
      gearbox: lookup(GEARBOX_FROM_OLX, params.get('transmission')?.key),
      bodyType: lookup(BODY_FROM_OLX, params.get('car_body')?.key),
      driveType: lookup(DRIVE_FROM_OLX, params.get('drive')?.key),
      engineCapacityCm3: toInt(params.get('enginesize')?.key),
      enginePowerHp: toInt(params.get('enginepower')?.key),
      doors: toInt(params.get('door_count')?.key),
      seats: toInt(params.get('seats')?.key),
      color: params.get('color')?.label?.trim() ?? null,

      condition: mapCondition(condition),
      isDamaged: condition === undefined ? null : condition !== 'notdamaged',
      vin: normalizeVin(params.get('vin')?.key),
      firstRegistrationDate: null,
      countryOrigin: params.get('country_origin')?.label?.trim() ?? null,

      sellerType: (isBusiness ? 'dealer' : 'private') satisfies SellerType,
      sellerName: offer.user?.name?.slice(0, 200) ?? null,

      city: offer.location?.city?.name ?? null,
      region: offer.location?.region?.name ?? null,
      country: 'Polska',
      latitude: null,
      longitude: null,

      thumbnailUrl,
      imagesCount: offer.photos?.length ?? null,
      publishedAt: toDate(offer.created_time),

      raw: offer as unknown as Record<string, unknown>,
    };
  }
}

/* -------------------------------------------------------------------------- */

function setEnumList(
  url: URL,
  key: string,
  values: readonly string[] | null | undefined,
  dictionary: Record<string, string>,
): void {
  const mapped = (values ?? [])
    .map((value) => dictionary[value])
    .filter((value): value is string => Boolean(value));

  mapped.forEach((value, index) => {
    url.searchParams.set(`${key}[${index}]`, value);
  });
}

function lookup<T>(dictionary: Record<string, T>, key: unknown): T | null {
  if (typeof key !== 'string' || !key) return null;
  return dictionary[key] ?? null;
}

/** Multi-word makes have to be recognised before the single-word fallback. */
const TWO_WORD_MAKES = [
  'alfa romeo',
  'aston martin',
  'land rover',
  'mercedes benz',
  'great wall',
];

function firstWordAsMake(title: string | undefined): string | null {
  if (!title) return null;
  const cleaned = title.trim().toLowerCase();

  for (const make of TWO_WORD_MAKES) {
    if (cleaned.startsWith(make)) {
      return make.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase());
    }
  }

  const [first] = title.trim().split(/\s+/);
  if (!first || first.length < 2) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapCondition(key: string | undefined): VehicleCondition | null {
  if (!key) return null;
  if (key === 'notdamaged') return 'used';
  if (key === 'damaged') return 'damaged';
  if (key === 'new') return 'new';
  return null;
}

function normalizeVin(value: unknown): string | null {
  if (!value) return null;
  const vin = String(value).trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) return null;
  // OLX masks the VIN on most adverts ("YV1XXXXXXXXXXXXXX") - storing that
  // would look like real data while carrying none.
  if (/X{5,}/.test(vin)) return null;
  return vin;
}

/**
 * Guards the criteria the API cannot express. The make in particular is only
 * implied by the category, so a title match is the available signal.
 */
function matchesCriteria(
  listing: NormalizedListing,
  criteria: SearchCriteria,
): boolean {
  if (criteria.make) {
    const wanted = slugify(criteria.make);
    const haystack = slugify(`${listing.title} ${listing.make ?? ''}`);
    if (!haystack.includes(wanted)) return false;
  }

  if (criteria.model) {
    const wanted = slugify(criteria.model);
    const haystack = slugify(`${listing.title} ${listing.model ?? ''}`);
    // "XC 60" slugifies to "xc-60"; titles often write "XC60".
    if (!haystack.includes(wanted) && !haystack.includes(wanted.replace(/-/g, ''))) {
      return false;
    }
  }

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
  if (criteria.excludeDamaged && listing.isDamaged === true) return false;

  // Same parts-and-scrap guard the Otomoto adapter uses.
  const floor = env.SCRAPER_MIN_PRICE_PLN;
  if (floor > 0 && listing.price !== null && listing.price !== undefined) {
    const minimum =
      criteria.priceFrom !== null && criteria.priceFrom !== undefined
        ? criteria.priceFrom
        : floor;
    if (listing.price < minimum) return false;
  }

  return true;
}

export const olxSource = new OlxSource();
