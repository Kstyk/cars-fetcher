import * as cheerio from 'cheerio';
import { logger } from '../../config/logger.js';
import { scrapingClient, type ScrapingClient } from '../scraping/http-client.js';
import { slugify } from '../scraping/next-data.js';
import type {
  FuelType,
  ListingSource,
  NormalizedListing,
  SearchCriteria,
  SearchOptions,
  SearchResult,
  SellerType,
} from '../types.js';

const BASE_URL = 'https://sprzedajemy.pl';
const CATEGORY_PATH = '/motoryzacja/samochody-osobowe';
/** The site's own default; `items_per_page` in the URL does not raise it reliably. */
const PAGE_SIZE = 30;

const FUEL_FROM_TEXT: Array<[RegExp, FuelType]> = [
  [/lpg/i, 'petrol_lpg'],
  [/cng/i, 'petrol_cng'],
  [/hybryd/i, 'hybrid'],
  [/elektry/i, 'electric'],
  [/wod[oó]r/i, 'hydrogen'],
  [/etanol/i, 'other'],
  [/diesel/i, 'diesel'],
  [/benzyn/i, 'petrol'],
];

/**
 * Reads sprzedajemy.pl's car listings (`motoryzacja/samochody-osobowe`).
 *
 * A general classifieds site, not a car-specialised one: search results are
 * classic server-rendered HTML (no embedded JSON, no headless browser
 * needed), parsed with cheerio. Make and model are URL path segments
 * (`/motoryzacja/samochody-osobowe/audi/a4`) that line up with `slugify()`
 * closely enough that no taxonomy file is needed.
 *
 * Every *other* filter (price, year, fuel, ...) lives behind the site's
 * "Pokaż wszystkie filtry" panel as an `inp_*` query parameter - and
 * `robots.txt` has `Disallow: *inp_*`, almost certainly to keep crawlers out
 * of its unbounded filter-combination space. That is respected here: this
 * adapter only ever requests `{path}?offset=N`, nothing else, and enforces
 * every other criterion itself in `matchesCriteria` against what a search-
 * result card actually shows (price, year, mileage, fuel, gearbox, seller
 * type). Sorting is `inp_srt_*` too, so pages come back in the site's own
 * default order rather than newest-first - a real limitation, not a bug.
 */
export class SprzedajemySource implements ListingSource {
  readonly provider = 'sprzedajemy' as const;

  constructor(private readonly http: ScrapingClient = scrapingClient) {}

  isConfigured(): boolean {
    return true;
  }

  async search(
    criteria: SearchCriteria,
    options: SearchOptions,
  ): Promise<SearchResult> {
    const path = this.buildPath(criteria);
    const url = this.buildUrl(path, options.page);

    let html: string;
    try {
      html = await this.http.fetchHtml(url, { signal: options.signal });
    } catch (err) {
      // An unrecognised make/model slug 404s; retry once against the plain
      // category and let matchesCriteria's title match do the narrowing -
      // free-text search (`inp_text`) is robots.txt-disallowed like every
      // other `inp_*` parameter, so this is the only fallback available.
      if (path !== CATEGORY_PATH) {
        logger.debug(
          { path, err },
          'sprzedajemy.pl: slug not recognised, retrying against the general category',
        );
        html = await this.http.fetchHtml(this.buildUrl(CATEGORY_PATH, options.page), {
          signal: options.signal,
        });
      } else {
        throw err;
      }
    }

    const items = this.parseListings(html, criteria.make ?? null, criteria.model ?? null);
    const kept = items.filter((listing) => matchesCriteria(listing, criteria));

    logger.debug(
      { url: url.toString(), page: options.page, received: items.length, kept: kept.length },
      'sprzedajemy.pl page scraped',
    );

    return {
      items: kept,
      page: options.page,
      pageSize: PAGE_SIZE,
      // The results count is rendered client-side, not present in the HTML this
      // adapter fetches - `hasNextPage` falls back to "did this page fill up".
      totalCount: undefined,
      hasNextPage: items.length >= PAGE_SIZE,
    };
  }

  /** `/motoryzacja/samochody-osobowe[/make[/model]]` - no taxonomy lookup needed. */
  private buildPath(criteria: SearchCriteria): string {
    if (!criteria.make) return CATEGORY_PATH;
    const parts = [CATEGORY_PATH, slugify(criteria.make)];
    if (criteria.model) parts.push(slugify(criteria.model));
    return parts.join('/');
  }

  /** Only `offset` - every `inp_*` filter/sort param is robots.txt-disallowed. */
  private buildUrl(path: string, page: number): URL {
    const url = new URL(path, BASE_URL);
    url.searchParams.set('offset', String((page - 1) * PAGE_SIZE));
    return url;
  }

  private parseListings(
    html: string,
    searchedMake: string | null,
    searchedModel: string | null,
  ): NormalizedListing[] {
    const $ = cheerio.load(html);
    const items: NormalizedListing[] = [];

    $('li[id^="offer-"]').each((_, el) => {
      const listing = this.toListing($, $(el), searchedMake, searchedModel);
      if (listing) items.push(listing);
    });

    return items;
  }

  /**
   * The card carries no make/model fields of its own - the search path
   * already scoped to them, so whatever was searched for is what this is.
   */
  private toListing(
    $: cheerio.CheerioAPI,
    el: cheerio.Cheerio<import('domhandler').Element>,
    searchedMake: string | null,
    searchedModel: string | null,
  ): NormalizedListing | null {
    const externalId = (el.attr('id') ?? '').replace('offer-', '').trim();
    const link = el.find('h2.title a.offerLink').first();
    const href = link.attr('href')?.trim();
    const title = link.text().trim();
    if (!externalId || !href || !title) return null;

    const priceText = el.find('.price').first().text();
    const price = toInt(priceText);

    const attributes = new Map<string, string>();
    el.find('.attribute').each((_, attrEl) => {
      const node = $(attrEl);
      const labelSpan = node.find('span').first().text();
      // Labels render as "Przebieg: " / "Rok. prod.: " - strip the trailing
      // punctuation+space run so "Rok. prod." and "Przebieg" compare equal.
      const label = labelSpan.trim().replace(/[\s.:]+$/, '');
      const value = node.text().replace(labelSpan, '').trim();
      if (label) attributes.set(label, value);
    });

    const year = toInt(attributes.get('Rok. prod'));
    const mileageKm = toInt(attributes.get('Przebieg'));
    const engineText = attributes.get('Silnik') ?? '';
    const fuelType = matchFuel(engineText);
    const engineCapacityCm3 = matchEngineCapacity(engineText);

    const sellerInfoClass = el.find('[class*="seller-type-info--"]').first().attr('class') ?? '';
    const sellerType: SellerType = /seller-type-info--(company|verified)/.test(sellerInfoClass)
      ? 'dealer'
      : /seller-type-info--private/.test(sellerInfoClass)
        ? 'private'
        : 'unknown';
    const sellerName = el.find('.company-and-city').first().text().trim() || null;

    const city = el.find('.address .city, strong.city').first().text().trim() || null;
    const datetime = el.find('time.time').first().attr('datetime');
    const thumbnailUrl = el.find('.picture img').first().attr('src')?.trim() || null;

    return {
      provider: 'sprzedajemy',
      externalId,
      url: new URL(href, BASE_URL).toString(),
      title: title.slice(0, 500),

      make: searchedMake,
      model: searchedModel,
      generation: null,
      version: null,

      price,
      currency: 'PLN',
      priceGross: null,
      hasVatInvoice: null,

      year,
      mileageKm,
      fuelType,
      // Not on the card - only the offer's own detail page carries it.
      gearbox: null,
      bodyType: null,
      driveType: null,
      engineCapacityCm3,
      enginePowerHp: null,
      doors: null,
      seats: null,
      color: null,

      condition: null,
      isDamaged: null,
      vin: null,
      firstRegistrationDate: null,
      countryOrigin: null,

      sellerType,
      sellerName,

      city,
      region: null,
      country: 'Polska',
      latitude: null,
      longitude: null,

      thumbnailUrl,
      imagesCount: null,
      publishedAt: toDate(datetime),

      raw: { title, priceText, attributes: Object.fromEntries(attributes) },
    };
  }
}

/* -------------------------------------------------------------------------- */

function toInt(value: string | undefined | null): number | null {
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchFuel(text: string): FuelType | null {
  for (const [pattern, fuel] of FUEL_FROM_TEXT) {
    if (pattern.test(text)) return fuel;
  }
  return null;
}

/** "2.0 Diesel" -> 2000 cm³. Free text, so only a plausible-looking match counts. */
function matchEngineCapacity(text: string): number | null {
  const match = /(\d)[.,](\d)\s*(?:l|dm3)?\b/i.exec(text);
  if (!match) return null;
  const cm3 = Number(match[1]) * 1000 + Number(match[2]) * 100;
  return cm3 >= 500 && cm3 <= 9000 ? cm3 : null;
}

/**
 * The only filter this adapter gets to apply, since `robots.txt` disallows
 * every `inp_*` query parameter the site's own filter panel would otherwise
 * use (see the class doc comment). Whatever a search-result card shows -
 * price, year, mileage, fuel, gearbox, seller type - is enforced here;
 * whatever it does not show (body type, colour, doors, accident history,
 * VAT, equipment...) simply cannot be filtered for this provider and is left
 * alone, the same graceful-degradation every adapter falls back to for a
 * criterion it cannot express.
 */
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

  /** Unknown data never disqualifies a listing - only a confirmed mismatch does. */
  const includes = <T>(value: T | null | undefined, allowed: readonly T[] | null | undefined) =>
    value === null || value === undefined || !allowed?.length || allowed.includes(value);

  if (criteria.make) {
    const wanted = slugify(criteria.make);
    const haystack = slugify(`${listing.title} ${listing.make ?? ''}`);
    if (!haystack.includes(wanted)) return false;
  }
  if (criteria.model) {
    const wanted = slugify(criteria.model);
    const haystack = slugify(`${listing.title} ${listing.model ?? ''}`);
    if (!haystack.includes(wanted) && !haystack.includes(wanted.replace(/-/g, ''))) {
      return false;
    }
  }

  return (
    withinRange(listing.year, criteria.yearFrom, criteria.yearTo) &&
    withinRange(listing.price, criteria.priceFrom, criteria.priceTo) &&
    withinRange(listing.mileageKm, criteria.mileageFrom, criteria.mileageTo) &&
    includes(listing.fuelType, criteria.fuelTypes) &&
    (!criteria.sellerType || listing.sellerType === 'unknown' || listing.sellerType === criteria.sellerType)
  );
}

export const sprzedajemySource = new SprzedajemySource();
