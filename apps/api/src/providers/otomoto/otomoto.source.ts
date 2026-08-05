import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { UpstreamError } from '../../lib/errors.js';
import { otomotoAuth, type OtomotoAuthClient } from './otomoto.auth.js';
import {
  extractAdverts,
  extractTotalCount,
  mapOtomotoAdvert,
} from './otomoto.mapper.js';
import type {
  ListingSource,
  NormalizedListing,
  SearchCriteria,
  SearchOptions,
  SearchResult,
} from '../types.js';

/** Reverse dictionaries: our normalised enums -> the codes Otomoto expects. */
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
 * Adapter for the OTOMOTO Open API (https://www.otomoto.pl/api/doc/).
 *
 * Note on scope: the public Open API is a partner/dealer API. `/account/adverts`
 * returns the adverts of the authenticated account; marketplace-wide search
 * requires a partner scope from OTOMOTO. The endpoint path is therefore
 * configurable, and everything downstream works off `ListingSource`, so
 * swapping in another search endpoint touches only this file.
 */
export class OtomotoSource implements ListingSource {
  readonly provider = 'otomoto' as const;

  constructor(
    private readonly auth: OtomotoAuthClient = otomotoAuth,
    private readonly baseUrl: string = env.OTOMOTO_BASE_URL,
    private readonly searchPath = '/account/adverts',
  ) {}

  isConfigured(): boolean {
    return env.OTOMOTO_ENABLED && this.auth.isConfigured();
  }

  async search(
    criteria: SearchCriteria,
    options: SearchOptions,
  ): Promise<SearchResult> {
    const params = this.buildQuery(criteria, options);
    const payload = await this.request(this.searchPath, params, options.signal);

    const items = extractAdverts(payload)
      .map(mapOtomotoAdvert)
      .filter((x): x is NormalizedListing => x !== null);

    const totalCount = extractTotalCount(payload);
    const hasNextPage =
      totalCount !== undefined
        ? options.page * options.pageSize < totalCount
        : items.length === options.pageSize;

    logger.debug(
      { page: options.page, received: items.length, totalCount },
      'Otomoto search page fetched',
    );

    return {
      items,
      page: options.page,
      pageSize: options.pageSize,
      totalCount,
      hasNextPage,
    };
  }

  async listMakes(): Promise<string[]> {
    const payload = await this.request('/car/makes', {});
    return extractDictionary(payload);
  }

  async listModels(make: string): Promise<string[]> {
    const payload = await this.request(
      `/car/makes/${encodeURIComponent(make.toLowerCase())}/models`,
      {},
    );
    return extractDictionary(payload);
  }

  /** Translates a stored filter into OTOMOTO's query-string vocabulary. */
  private buildQuery(
    criteria: SearchCriteria,
    options: SearchOptions,
  ): Record<string, string> {
    const params: Record<string, string> = {
      page: String(options.page),
      limit: String(options.pageSize),
    };

    const set = (key: string, value: unknown): void => {
      if (value !== null && value !== undefined && value !== '') {
        params[key] = String(value);
      }
    };

    set('filter_enum_make', criteria.make?.toLowerCase());
    set('filter_enum_model', criteria.model?.toLowerCase());
    set('filter_enum_generation', criteria.generation?.toLowerCase());
    set('filter_enum_version', criteria.version?.toLowerCase());
    set('q', criteria.query);

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

    mapEnumList(params, 'filter_enum_fuel_type', criteria.fuelTypes, FUEL_TO_OTOMOTO);
    mapEnumList(params, 'filter_enum_gearbox', criteria.gearboxes, GEARBOX_TO_OTOMOTO);
    mapEnumList(params, 'filter_enum_body_type', criteria.bodyTypes, BODY_TO_OTOMOTO);

    if (criteria.condition) {
      set('filter_enum_new_used', criteria.condition === 'new' ? 'new' : 'used');
    }
    if (criteria.excludeDamaged) set('filter_enum_damaged', '0');
    if (criteria.onlyWithPhotos) set('filter_enum_photos', '1');
    if (criteria.registeredInPl !== null) {
      set('filter_enum_country_origin_pl', criteria.registeredInPl ? '1' : '0');
    }
    if (criteria.firstOwner) set('filter_enum_original_owner', '1');
    if (criteria.sellerType && criteria.sellerType !== 'unknown') {
      set('filter_enum_seller_type', criteria.sellerType);
    }

    set('filter_enum_country_origin', criteria.countryOrigin?.toLowerCase());
    set('city', criteria.city);
    set('region', criteria.region);
    set('dist', criteria.radiusKm);

    // Provider-specific escape hatch, applied last so it can override.
    for (const [key, value] of Object.entries(criteria.extraParams ?? {})) {
      set(key, value);
    }

    return params;
  }

  private async request(
    path: string,
    params: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const token = await this.auth.getAccessToken();
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        // The Open API selects its response format from this version header.
        Accept: 'application/json; version=1.0',
      },
      signal: signal ?? AbortSignal.timeout(30_000),
    });

    if (response.status === 401) {
      // Token rejected despite being cached - force a fresh grant next call.
      await this.auth.invalidate();
      throw new UpstreamError('Otomoto odrzuciło token dostępu (401)');
    }

    if (response.status === 429) {
      throw new UpstreamError('Przekroczono limit zapytań do Otomoto (429)');
    }

    if (!response.ok) {
      const body = await response.text();
      throw new UpstreamError(`Otomoto zwróciło ${response.status}`, {
        path,
        body: body.slice(0, 500),
      });
    }

    return response.json();
  }
}

function mapEnumList(
  params: Record<string, string>,
  key: string,
  values: readonly string[] | null | undefined,
  dictionary: Record<string, string>,
): void {
  if (!values?.length) return;
  const mapped = values
    .map((v) => dictionary[v])
    .filter((v): v is string => Boolean(v));
  if (mapped.length > 0) params[key] = mapped.join(',');
}

function extractDictionary(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) =>
        typeof entry === 'string'
          ? entry
          : String(
              (entry as Record<string, unknown>)?.name ??
                (entry as Record<string, unknown>)?.value ??
                (entry as Record<string, unknown>)?.key ??
                '',
            ),
      )
      .filter(Boolean);
  }
  if (typeof payload === 'object' && payload !== null) {
    return Object.values(payload as Record<string, unknown>).map(String);
  }
  return [];
}

export const otomotoSource = new OtomotoSource();
