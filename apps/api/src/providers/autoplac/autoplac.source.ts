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
} from '../types.js';

/* -------------------------------------------------------------------------- */
/*                        Shape of the embedded payload                       */
/* -------------------------------------------------------------------------- */

interface AutoplacOffer {
  id?: number;
  hashedId?: string;
  brand?: string;
  model?: string;
  generation?: string;
  version?: string;
  productionYear?: number;
  mileage?: number;
  enginePowerKW?: number;
  engineCapacity?: number;
  seats?: number;
  bodyType?: string;
  bodyTypeText?: string;
  fuelType?: string;
  fuelTypeText?: string;
  driveTypeText?: string;
  transmissionTypeText?: string;
  vinAvailable?: boolean;
  title?: string;
  webUrl?: string;
  city?: string;
  voivodeshipDisplay?: string;
  locationCountryName?: string;
  insertTime?: number | string;
  firstRegistrationDate?: string;
  moduleProType?: string | null;
  priceInfo?: {
    /** Gross price when `brutto` is true; `secondary` holds the net figure. */
    primary?: { price?: number; brutto?: boolean };
    invoiceType?: string | null;
    currency?: string;
  };
  locationInfo?: {
    city?: string;
    voivodeshipName?: string;
    locationCountryName?: string;
  };
}

interface AutoplacItem {
  offer?: AutoplacOffer;
  photoList?: Array<{ miniatureUrl?: string; url?: string; webpUrl?: string }>;
}

interface AutoplacSearchBody {
  offerCount?: number;
  offerList?: AutoplacItem[];
}

/* -------------------------------------------------------------------------- */
/*                                Dictionaries                                */
/* -------------------------------------------------------------------------- */

const FUEL_MAP: Record<string, FuelType> = {
  GASOLINE: 'petrol',
  PETROL: 'petrol',
  GASOLINE_LPG: 'petrol_lpg',
  LPG: 'petrol_lpg',
  GASOLINE_CNG: 'petrol_cng',
  CNG: 'petrol_cng',
  DIESEL: 'diesel',
  HYBRID: 'hybrid',
  HYBRID_GASOLINE: 'hybrid',
  HYBRID_DIESEL: 'hybrid',
  PLUGIN_HYBRID: 'plugin_hybrid',
  PLUG_IN_HYBRID: 'plugin_hybrid',
  ELECTRIC: 'electric',
  HYDROGEN: 'hydrogen',
};

const BODY_MAP: Record<string, BodyType> = {
  SEDAN: 'sedan',
  HATCHBACK: 'hatchback',
  COMPACT: 'hatchback',
  COMBI: 'wagon',
  ESTATE: 'wagon',
  KOMBI: 'wagon',
  SUV: 'suv',
  COUPE: 'coupe',
  CABRIO: 'convertible',
  CONVERTIBLE: 'convertible',
  MINIVAN: 'minivan',
  VAN: 'van',
  PICKUP: 'pickup',
};

/** These arrive as Polish display text, not codes. */
const GEARBOX_TEXT_MAP: Record<string, Gearbox> = {
  automatyczna: 'automatic',
  manualna: 'manual',
  'polautomatyczna': 'semi_automatic',
  'półautomatyczna': 'semi_automatic',
};

const DRIVE_TEXT_MAP: Record<string, DriveType> = {
  '4x4': 'awd',
  'na-przednie-kola': 'fwd',
  'na-tylne-kola': 'rwd',
  'przedni': 'fwd',
  'tylny': 'rwd',
};

/** autoplac.pl renders 24 offers per listing page. */
const PAGE_SIZE = 24;
const BASE_URL = 'https://autoplac.pl';
const CATEGORY_PATH = '/oferty/samochody-osobowe';

/**
 * Reads autoplac.pl listing pages.
 *
 * The site is an Angular app that server-side renders and ships the whole API
 * response inside a TransferState `<script type="application/json">`. Parsing
 * that gives structured offers without touching their API host directly.
 *
 * robots.txt shapes what is possible. `Allow: /` covers `/oferty/...`, but the
 * query parameters a search would normally use are explicitly disallowed:
 *
 *     Disallow: /*offset
 *     Disallow: /*?*fullTextQuery=
 *     Disallow: /*?*brandModelIds=
 *     Disallow: /?sortOrder=   /?orderBy=
 *
 * So make and model are passed as **path segments**
 * (`/oferty/samochody-osobowe/volvo/xc-60`) and paging uses `?p=N`, neither of
 * which is disallowed. Everything else - price, year, mileage, fuel - is
 * filtered on our side after fetching.
 */
export class AutoplacSource implements ListingSource {
  readonly provider = 'autoplac' as const;

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
    const body = extractSearchBody(html);

    if (!body) {
      throw new UpstreamError(
        'Nie znaleziono danych ofert na autoplac.pl - struktura strony się zmieniła',
      );
    }

    const offers = body.offerList ?? [];
    const items = offers
      .map((item) => this.toListing(item))
      .filter((listing): listing is NormalizedListing => listing !== null)
      .filter((listing) => matchesCriteria(listing, criteria));

    logger.debug(
      {
        url: url.toString(),
        page: options.page,
        received: offers.length,
        kept: items.length,
        totalCount: body.offerCount,
      },
      'autoplac page scraped',
    );

    return {
      items,
      page: options.page,
      pageSize: PAGE_SIZE,
      totalCount: body.offerCount,
      hasNextPage:
        body.offerCount !== undefined
          ? options.page * PAGE_SIZE < body.offerCount
          : offers.length >= PAGE_SIZE,
    };
  }

  /** Make and model go in the path; only paging may be a query parameter. */
  private buildUrl(criteria: SearchCriteria, page: number): URL {
    const segments = [CATEGORY_PATH];
    if (criteria.make) segments.push(slugify(criteria.make));
    // A model without a make would land on the wrong category path.
    if (criteria.make && criteria.model) segments.push(slugify(criteria.model));

    const url = new URL(segments.join('/'), BASE_URL);
    if (page > 1) url.searchParams.set('p', String(page));
    return url;
  }

  private toListing(item: AutoplacItem): NormalizedListing | null {
    const offer = item.offer;
    const externalId = offer?.id ?? offer?.hashedId;
    if (!offer || externalId === undefined) return null;

    const url = offer.webUrl?.startsWith('http')
      ? offer.webUrl
      : offer.webUrl
        ? `${BASE_URL}${offer.webUrl}`
        : null;
    if (!url) return null;

    const price = offer.priceInfo?.primary?.price ?? null;

    // Power is reported in kilowatts; the rest of the app works in horsepower.
    const enginePowerHp = offer.enginePowerKW
      ? Math.round(offer.enginePowerKW * 1.35962)
      : null;

    const photo = item.photoList?.[0];

    return {
      provider: 'autoplac',
      externalId: String(externalId),
      url,
      title:
        offer.title?.slice(0, 500) ??
        ([offer.brand, offer.model, offer.version].filter(Boolean).join(' ') ||
          'Ogłoszenie'),

      make: offer.brand ?? null,
      model: offer.model ?? null,
      generation: offer.generation ?? null,
      version: offer.version === 'Inny' ? null : (offer.version ?? null),

      price,
      currency: offer.priceInfo?.currency ?? 'PLN',
      priceGross: offer.priceInfo?.primary?.brutto ?? null,
      // invoiceType is "FV23" / "FV_MARZA" / null.
      hasVatInvoice: offer.priceInfo?.invoiceType
        ? offer.priceInfo.invoiceType.startsWith('FV')
        : null,

      year: offer.productionYear ?? null,
      mileageKm: offer.mileage ?? null,
      fuelType: offer.fuelType ? (FUEL_MAP[offer.fuelType] ?? null) : null,
      gearbox: lookupText(GEARBOX_TEXT_MAP, offer.transmissionTypeText),
      bodyType: offer.bodyType ? (BODY_MAP[offer.bodyType] ?? null) : null,
      driveType: lookupText(DRIVE_TEXT_MAP, offer.driveTypeText),
      engineCapacityCm3: offer.engineCapacity ?? null,
      enginePowerHp,
      doors: null,
      seats: offer.seats ?? null,
      color: null,

      condition: null,
      isDamaged: null,
      vin: null,
      firstRegistrationDate: toDate(offer.firstRegistrationDate),
      countryOrigin: offer.locationCountryName ?? null,

      // The listing payload carries no private/dealer flag; `moduleProType`
      // describes the advert package, not the seller.
      sellerType: 'unknown',
      sellerName: null,

      city: offer.locationInfo?.city ?? offer.city ?? null,
      region: offer.locationInfo?.voivodeshipName ?? offer.voivodeshipDisplay ?? null,
      country: offer.locationInfo?.locationCountryName ?? 'Polska',
      latitude: null,
      longitude: null,

      thumbnailUrl: photo?.miniatureUrl ?? photo?.webpUrl ?? photo?.url ?? null,
      imagesCount: item.photoList?.length ?? null,
      publishedAt: toDate(offer.insertTime),

      raw: item as unknown as Record<string, unknown>,
    };
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Pulls the Angular TransferState blob and finds the offers-search response
 * inside it. The state is keyed by full API URL, so the lookup is structural
 * rather than by a fixed key.
 */
function extractSearchBody(html: string): AutoplacSearchBody | null {
  const match = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/.exec(
    html,
  );
  if (!match?.[1]) return null;

  let state: Record<string, { body?: AutoplacSearchBody }>;
  try {
    // Angular escapes quotes and ampersands when embedding the state.
    state = JSON.parse(match[1].replace(/&q;/g, '"').replace(/&a;/g, '&'));
  } catch {
    return null;
  }

  for (const entry of Object.values(state)) {
    if (Array.isArray(entry?.body?.offerList)) return entry.body;
  }
  return null;
}

function lookupText<T>(
  dictionary: Record<string, T>,
  value: string | null | undefined,
): T | null {
  if (!value) return null;
  return dictionary[slugify(value)] ?? dictionary[value.toLowerCase()] ?? null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  // `insertTime` is epoch milliseconds; `firstRegistrationDate` is "YYYY-MM-DD".
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * autoplac only filters make and model for us - price, year, mileage and the
 * rest of the criteria are applied here.
 */
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
  if (
    !withinRange(
      listing.engineCapacityCm3,
      criteria.engineCapacityFrom,
      criteria.engineCapacityTo,
    )
  ) {
    return false;
  }

  if (criteria.fuelTypes?.length && listing.fuelType) {
    if (!criteria.fuelTypes.includes(listing.fuelType)) return false;
  }
  if (criteria.gearboxes?.length && listing.gearbox) {
    if (!criteria.gearboxes.includes(listing.gearbox)) return false;
  }
  if (criteria.bodyTypes?.length && listing.bodyType) {
    if (!criteria.bodyTypes.includes(listing.bodyType)) return false;
  }

  const floor = env.SCRAPER_MIN_PRICE_PLN;
  if (floor > 0 && listing.price !== null && listing.price !== undefined) {
    const minimum = criteria.priceFrom ?? floor;
    if (listing.price < minimum) return false;
  }

  return true;
}

export const autoplacSource = new AutoplacSource();
