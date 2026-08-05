import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { UpstreamError } from '../../lib/errors.js';
import { mapOtomotoAdvert } from './otomoto.mapper.js';
import { scrapingClient, type ScrapingClient } from '../scraping/http-client.js';
import {
  extractNextData,
  findEncodedGraphqlPayload,
  slugify,
} from '../scraping/next-data.js';
import type {
  ListingSource,
  NormalizedListing,
  SearchCriteria,
  SearchOptions,
  SearchResult,
} from '../types.js';

/* -------------------------------------------------------------------------- */
/*                        Shape of the embedded payload                       */
/* -------------------------------------------------------------------------- */

interface AdvertParameter {
  key: string;
  value: string;
  displayValue?: string;
}

interface AdvertNode {
  id?: string;
  title?: string;
  url?: string;
  createdAt?: string;
  shortDescription?: string;
  parameters?: AdvertParameter[];
  price?: {
    amount?: { units?: number; value?: string; currencyCode?: string };
    isGross?: boolean;
    badges?: string[];
  };
  location?: {
    city?: { name?: string };
    region?: { name?: string };
  };
  thumbnail?: { x1?: string; x2?: string };
  seller?: { __typename?: string };
  sellerLink?: { name?: string | null };
}

interface AdvertSearch {
  totalCount?: number;
  pageInfo?: { pageSize?: number; currentOffset?: number };
  edges?: Array<{ node?: AdvertNode }>;
}

/** Otomoto serves 32 adverts per page and ignores attempts to raise it. */
const PAGE_SIZE = 32;

/**
 * Params read as display text rather than raw value: "Volvo" over "volvo",
 * "XC 60" over "xc-60", "Korea" over "kr".
 *
 * Everything else keeps the machine value. Enum dictionaries need it, and so do
 * numbers - `engine_capacity` displays as "1 995 cm3", whose unit carries a
 * digit that would be parsed into the number (19953 -> "20.0 l").
 */
const DISPLAY_VALUE_PARAM_KEYS = new Set([
  'make',
  'model',
  'generation',
  'version',
  'color',
  'country_origin',
]);
const BASE_URL = 'https://www.otomoto.pl';
const CATEGORY_PATH = '/osobowe';

/* -------------------------------------------------------------------------- */
/*                              Filter dictionaries                           */
/* -------------------------------------------------------------------------- */

const FUEL_TO_OTOMOTO: Record<string, string> = {
  petrol: 'petrol',
  petrol_lpg: 'petrol-lpg',
  petrol_cng: 'petrol-cng',
  diesel: 'diesel',
  hybrid: 'hybrid',
  plugin_hybrid: 'plugin-hybrid',
  electric: 'electric',
  hydrogen: 'hydrogen',
};

const GEARBOX_TO_OTOMOTO: Record<string, string> = {
  manual: 'manual',
  automatic: 'automatic',
  semi_automatic: 'semi-automatic',
};

const BODY_TO_OTOMOTO: Record<string, string> = {
  sedan: 'sedan',
  hatchback: 'compact',
  wagon: 'combi',
  suv: 'suv',
  coupe: 'coupe',
  convertible: 'cabrio',
  minivan: 'minivan',
  pickup: 'pickup',
  van: 'van',
};

/**
 * Reads Otomoto's public listing pages.
 *
 * The adverts are embedded in the page as JSON (`__NEXT_DATA__` → urql cache →
 * `advertSearch`), so there is no HTML parsing and no headless browser. Only
 * paths that robots.txt permits are touched: `/osobowe` is under `Allow: /`,
 * while their internal `/api/` GraphQL is `Disallow` and never requested.
 *
 * Throttling, retries and robots.txt live in the shared `ScrapingClient`, which
 * the autoplac.pl and OLX adapters will reuse.
 */
export class OtomotoScraperSource implements ListingSource {
  readonly provider = 'otomoto' as const;

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

    const nextData = extractNextData(html);
    const search = findEncodedGraphqlPayload<AdvertSearch>(nextData, 'advertSearch');

    if (!search) {
      throw new UpstreamError(
        'Nie znaleziono danych ofert na stronie Otomoto - struktura się zmieniła',
      );
    }

    const nodes = (search.edges ?? [])
      .map((edge) => edge.node)
      .filter((node): node is AdvertNode => Boolean(node));

    const mapped = nodes
      .map((node) => this.toListing(node))
      .filter((listing): listing is NormalizedListing => listing !== null);

    const items = mapped.filter((listing) => {
      // A wrong make/model slug makes Otomoto silently drop the filter and
      // return everything, so the criteria are enforced again here.
      if (!matchesCriteria(listing, criteria)) return false;

      if (isImplausiblePrice(listing, criteria)) {
        logger.debug(
          { externalId: listing.externalId, title: listing.title, price: listing.price },
          'Dropping advert below the plausible car price - likely a part cross-posted from OLX',
        );
        return false;
      }
      return true;
    });

    const totalCount = search.totalCount;
    const offset = search.pageInfo?.currentOffset ?? (options.page - 1) * PAGE_SIZE;
    const hasNextPage =
      totalCount !== undefined
        ? offset + PAGE_SIZE < totalCount
        : nodes.length === PAGE_SIZE;

    logger.debug(
      {
        url: url.toString(),
        page: options.page,
        received: nodes.length,
        kept: items.length,
        totalCount,
      },
      'Otomoto page scraped',
    );

    return {
      items,
      page: options.page,
      pageSize: PAGE_SIZE,
      totalCount,
      hasNextPage,
    };
  }

  /**
   * Builds a public search URL. Make and model go in as query filters rather
   * than path segments: a bad path slug is silently ignored by Otomoto, while
   * a bad filter value yields an empty result - a much safer failure mode.
   */
  private buildUrl(criteria: SearchCriteria, page: number): URL {
    const url = new URL(CATEGORY_PATH, BASE_URL);
    const set = (key: string, value: unknown): void => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(`search[${key}]`, String(value));
      }
    };

    if (criteria.make) set('filter_enum_make', slugify(criteria.make));
    if (criteria.model) set('filter_enum_model', slugify(criteria.model));
    if (criteria.generation) set('filter_enum_generation', slugify(criteria.generation));
    if (criteria.query) url.searchParams.set('search[filter_enum_damage]', '');

    set('filter_float_year:from', criteria.yearFrom);
    set('filter_float_year:to', criteria.yearTo);
    set('filter_float_price:from', criteria.priceFrom);
    set('filter_float_price:to', criteria.priceTo);
    set('filter_float_mileage:from', criteria.mileageFrom);
    set('filter_float_mileage:to', criteria.mileageTo);
    set('filter_float_engine_power:from', criteria.enginePowerFrom);
    set('filter_float_engine_power:to', criteria.enginePowerTo);
    set('filter_float_engine_capacity:from', criteria.engineCapacityFrom);
    set('filter_float_engine_capacity:to', criteria.engineCapacityTo);

    // Multi-value filters use indexed keys: search[filter_enum_x][0]=...
    setMulti(url, 'filter_enum_fuel_type', criteria.fuelTypes, FUEL_TO_OTOMOTO);
    setMulti(url, 'filter_enum_gearbox', criteria.gearboxes, GEARBOX_TO_OTOMOTO);
    setMulti(url, 'filter_enum_body_type', criteria.bodyTypes, BODY_TO_OTOMOTO);

    setMultiRaw(url, 'filter_enum_color', criteria.colors);
    setMultiRaw(url, 'filter_enum_door_count', criteria.doorCounts?.map(String));
    setMultiRaw(url, 'filter_float_nr_seats', criteria.seatCounts?.map(String));

    if (criteria.condition === 'new') set('filter_enum_new_used', 'new');
    if (criteria.condition === 'used') set('filter_enum_new_used', 'used');
    if (criteria.excludeDamaged) set('filter_enum_damaged', '0');
    if (criteria.registeredInPl) set('filter_enum_registered', '1');
    if (criteria.firstOwner) set('filter_enum_original_owner', '1');
    if (criteria.noAccident) set('filter_enum_no_accident', '1');
    if (criteria.servicedAtAso) set('filter_enum_service_record', '1');
    if (criteria.hasVin) set('filter_enum_has_vin', '1');
    if (criteria.vatInvoice) set('filter_enum_vat', '1');
    if (criteria.countryOrigin) {
      set('filter_enum_country_origin', criteria.countryOrigin.toLowerCase());
    }
    if (criteria.city) set('city_id', criteria.city);
    if (criteria.radiusKm) set('dist', criteria.radiusKm);

    // Equipment ids come straight from the scraped taxonomy, so a new option
    // added upstream works without a code change.
    for (const item of criteria.equipment ?? []) {
      if (/^filter_(enum|string)_[a-z0-9_]+$/.test(item)) set(item, '1');
    }

    // Newest first, so early pages carry the adverts worth notifying about.
    set('order', 'created_at_first:desc');

    for (const [key, value] of Object.entries(criteria.extraParams ?? {})) {
      set(key, value);
    }

    if (page > 1) url.searchParams.set('page', String(page));
    return url;
  }

  /**
   * Flattens the GraphQL node into the loose shape `mapOtomotoAdvert` already
   * understands, so both the official-API and scraper paths share one mapper
   * and one set of enum dictionaries.
   */
  private toListing(node: AdvertNode): NormalizedListing | null {
    const params: Record<string, string> = {};
    for (const parameter of node.parameters ?? []) {
      if (!parameter.key) continue;
      params[parameter.key] = DISPLAY_VALUE_PARAM_KEYS.has(parameter.key)
        ? (parameter.displayValue ?? parameter.value)
        : parameter.value;
    }

    const amount = node.price?.amount;
    const sellerType =
      node.seller?.__typename === 'ProfessionalSeller'
        ? 'dealer'
        : node.seller?.__typename === 'PrivateSeller'
          ? 'private'
          : undefined;

    return mapOtomotoAdvert({
      id: node.id,
      url: node.url,
      title: node.title,
      created_at: node.createdAt,
      price: amount?.units ?? amount?.value,
      currency: amount?.currencyCode ?? 'PLN',
      gross_net: node.price?.isGross === false ? 'net' : 'gross',
      vat_invoice: node.price?.badges?.includes('INVOICE_ISSUED') ?? null,
      city: node.location?.city?.name,
      region: node.location?.region?.name,
      seller_type: sellerType,
      seller_name: node.sellerLink?.name ?? null,
      photos: node.thumbnail?.x2 ?? node.thumbnail?.x1
        ? [node.thumbnail?.x2 ?? node.thumbnail?.x1]
        : [],
      ...params,
    });
  }
}

function setMulti(
  url: URL,
  key: string,
  values: readonly string[] | null | undefined,
  dictionary: Record<string, string>,
): void {
  const mapped = (values ?? [])
    .map((value) => dictionary[value])
    .filter((value): value is string => Boolean(value));
  setMultiRaw(url, key, mapped);
}

/** For values that already use the provider's own vocabulary (taxonomy ids). */
function setMultiRaw(
  url: URL,
  key: string,
  values: readonly string[] | null | undefined,
): void {
  if (!values?.length) return;
  values.forEach((value, index) => {
    url.searchParams.set(`search[${key}][${index}]`, value);
  });
}

/**
 * OLX cross-posts leak car parts into the passenger-car category with
 * car-shaped attributes - a taillight listed as "Volvo XC 60", 2022, 55 000 km,
 * for 1050 PLN. Category id and parameters are identical to a real car, so the
 * price floor is the workable signal. An explicit `priceFrom` below the floor
 * means the user really does want the cheap end, so their choice wins.
 */
function isImplausiblePrice(
  listing: NormalizedListing,
  criteria: SearchCriteria,
): boolean {
  const floor = env.SCRAPER_MIN_PRICE_PLN;
  if (floor <= 0 || listing.price === null || listing.price === undefined) {
    return false;
  }
  if (criteria.priceFrom !== null && criteria.priceFrom !== undefined) {
    return listing.price < criteria.priceFrom;
  }
  return listing.price < floor;
}

/** Second line of defence against filters the site quietly dropped. */
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

  return (
    withinRange(listing.year, criteria.yearFrom, criteria.yearTo) &&
    withinRange(listing.price, criteria.priceFrom, criteria.priceTo) &&
    withinRange(listing.mileageKm, criteria.mileageFrom, criteria.mileageTo) &&
    withinRange(
      listing.enginePowerHp,
      criteria.enginePowerFrom,
      criteria.enginePowerTo,
    )
  );
}

export const otomotoScraperSource = new OtomotoScraperSource();
