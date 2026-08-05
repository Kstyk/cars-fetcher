import type {
  BodyType,
  DriveType,
  FuelType,
  Gearbox,
  NormalizedListing,
  SellerType,
  VehicleCondition,
} from '../types.js';

/* -------------------------------------------------------------------------- */
/*                          Dictionaries (Otomoto -> ours)                    */
/* -------------------------------------------------------------------------- */

const FUEL_MAP: Record<string, FuelType> = {
  petrol: 'petrol',
  gasoline: 'petrol',
  benzyna: 'petrol',
  'petrol-lpg': 'petrol_lpg',
  petrol_lpg: 'petrol_lpg',
  lpg: 'petrol_lpg',
  'benzyna+lpg': 'petrol_lpg',
  'petrol-cng': 'petrol_cng',
  cng: 'petrol_cng',
  diesel: 'diesel',
  hybrid: 'hybrid',
  'hybrid-petrol': 'hybrid',
  'hybrid-diesel': 'hybrid',
  hybryda: 'hybrid',
  'plugin-hybrid': 'plugin_hybrid',
  plugin_hybrid: 'plugin_hybrid',
  phev: 'plugin_hybrid',
  electric: 'electric',
  elektryczny: 'electric',
  hydrogen: 'hydrogen',
  etanol: 'other',
};

const GEARBOX_MAP: Record<string, Gearbox> = {
  manual: 'manual',
  manualna: 'manual',
  automatic: 'automatic',
  automatyczna: 'automatic',
  'automatic-stepless': 'automatic',
  'automatic-dual-clutch': 'automatic',
  cvt: 'automatic',
  'semi-automatic': 'semi_automatic',
  semi_automatic: 'semi_automatic',
  'automatic-sequential': 'semi_automatic',
};

const BODY_MAP: Record<string, BodyType> = {
  sedan: 'sedan',
  saloon: 'sedan',
  compact: 'hatchback',
  hatchback: 'hatchback',
  'city-cars': 'hatchback',
  'small-cars': 'hatchback',
  combi: 'wagon',
  wagon: 'wagon',
  estate: 'wagon',
  kombi: 'wagon',
  suv: 'suv',
  'off-road': 'suv',
  coupe: 'coupe',
  cabrio: 'convertible',
  convertible: 'convertible',
  minivan: 'minivan',
  minibus: 'minivan',
  van: 'van',
  pickup: 'pickup',
  'pick-up': 'pickup',
};

const DRIVE_MAP: Record<string, DriveType> = {
  'front-wheel': 'fwd',
  front: 'fwd',
  fwd: 'fwd',
  'rear-wheel': 'rwd',
  rear: 'rwd',
  rwd: 'rwd',
  '4x4': 'awd',
  'all-wheel': 'awd',
  awd: 'awd',
  '4x4-auto': 'awd',
  '4x4-attachable': 'awd',
  '4x4-permanent': 'awd',
};

/* -------------------------------------------------------------------------- */
/*                              Field extraction                              */
/* -------------------------------------------------------------------------- */

type Raw = Record<string, unknown>;

/**
 * OTOMOTO returns attributes either flat on the advert or nested under
 * `params`, and values are sometimes plain scalars, sometimes `{ key, value }`
 * or `{ "1": "..." }` maps. This walks all of those shapes.
 */
function pick(source: Raw, ...keys: string[]): unknown {
  const params = asRecord(source.params) ?? {};
  const attributes = asRecord(source.attributes) ?? {};

  for (const key of keys) {
    for (const bag of [source, params, attributes]) {
      const value = bag[key];
      if (value !== undefined && value !== null && value !== '') {
        return unwrap(value);
      }
    }
  }

  // Some responses ship attributes as [{ key, value }, ...].
  const list = Array.isArray(source.attributes)
    ? (source.attributes as unknown[])
    : Array.isArray(source.params)
      ? (source.params as unknown[])
      : [];

  for (const entry of list) {
    const rec = asRecord(entry);
    if (!rec) continue;
    const code = String(rec.key ?? rec.code ?? rec.name ?? '');
    if (keys.includes(code)) return unwrap(rec.value ?? rec.values);
  }

  return undefined;
}

function unwrap(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value[0];

  const rec = value as Raw;
  return rec.value ?? rec.key ?? rec.label ?? rec['1'] ?? rec.id ?? undefined;
}

function asRecord(value: unknown): Raw | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Raw)
    : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  // Handles "129 000", "129,000.50", "85 000 km".
  const cleaned = String(value).replace(/[^\d.,-]/g, '').replace(/\s/g, '');
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toInt(value: unknown): number | null {
  const n = toNumber(value);
  return n === null ? null : Math.round(n);
}

function toBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'tak', 'y'].includes(s)) return true;
  if (['0', 'false', 'no', 'nie', 'n'].includes(s)) return false;
  return null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function slug(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim().toLowerCase().replace(/\s+/g, '-');
}

function titleCase(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).replace(/[-_]+/g, ' ').trim();
  if (!text) return null;

  // Uppercase only after a real separator. `\b` is ASCII-only in JS, so it
  // treats "ś" as a boundary and turns "Krośniewice" into "KroŚNiewice".
  // Text that already carries capitals (city and seller names) is left alone.
  if (/\p{Lu}/u.test(text)) return text;

  return text.replace(
    /(^|[\s/(])(\p{L})/gu,
    (_, separator: string, letter: string) => separator + letter.toUpperCase(),
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Mapper                                   */
/* -------------------------------------------------------------------------- */

export function mapOtomotoAdvert(advert: Raw): NormalizedListing | null {
  const externalId = String(
    advert.id ?? advert.advert_id ?? advert.external_id ?? '',
  ).trim();
  if (!externalId) return null;

  const url = String(advert.url ?? advert.link ?? advert.permalink ?? '').trim();
  if (!url) return null;

  const priceRecord = asRecord(advert.price) ?? asRecord(pick(advert, 'price'));
  const price =
    toNumber(priceRecord?.['1'] ?? priceRecord?.value ?? priceRecord?.amount) ??
    toNumber(pick(advert, 'price', 'price_value'));

  const currency =
    String(
      priceRecord?.currency ?? pick(advert, 'currency', 'price_currency') ?? 'PLN',
    ).toUpperCase().slice(0, 3) || 'PLN';

  const condition = mapCondition(pick(advert, 'new_used', 'condition', 'state'));
  const damaged = toBool(pick(advert, 'damaged', 'is_damaged', 'no_accident'));

  return {
    provider: 'otomoto',
    externalId,
    url,
    title: String(advert.title ?? advert.name ?? 'Ogłoszenie').slice(0, 500),

    make: titleCase(pick(advert, 'make', 'make_id', 'brand')),
    model: titleCase(pick(advert, 'model', 'model_id')),
    generation: titleCase(pick(advert, 'generation', 'generation_id')),
    version: titleCase(pick(advert, 'version', 'version_id', 'trim')),

    price,
    currency,
    priceGross: mapGross(priceRecord?.gross_net ?? pick(advert, 'gross_net')),
    hasVatInvoice: toBool(pick(advert, 'vat_invoice', 'invoice_vat')),

    year: toInt(pick(advert, 'year', 'production_year', 'first_registration_year')),
    mileageKm: toInt(pick(advert, 'mileage', 'mileage_km', 'przebieg')),
    fuelType: lookup(FUEL_MAP, pick(advert, 'fuel_type', 'fuel')),
    gearbox: lookup(GEARBOX_MAP, pick(advert, 'gearbox', 'transmission')),
    bodyType: lookup(BODY_MAP, pick(advert, 'body_type', 'bodytype', 'body')),
    driveType: lookup(DRIVE_MAP, pick(advert, 'transmission_type', 'drive', 'wheel_drive')),
    engineCapacityCm3: toInt(pick(advert, 'engine_capacity', 'engine_size')),
    enginePowerHp: toInt(pick(advert, 'engine_power', 'engine_power_hp', 'power')),
    doors: toInt(pick(advert, 'door_count', 'doors', 'nr_seats_doors')),
    seats: toInt(pick(advert, 'nr_seats', 'seats')),
    color: titleCase(pick(advert, 'color', 'colour')),

    condition,
    isDamaged: damaged ?? (condition === 'damaged' ? true : null),
    vin: normalizeVin(pick(advert, 'vin')),
    firstRegistrationDate: toDate(
      pick(advert, 'first_registration_date', 'first_registration'),
    ),
    countryOrigin: titleCase(pick(advert, 'country_origin', 'origin')),

    sellerType: mapSellerType(advert),
    sellerName: extractSellerName(advert),

    city: titleCase(pick(advert, 'city', 'city_name', 'location_city')),
    region: titleCase(pick(advert, 'region', 'region_name', 'voivodeship')),
    country: titleCase(pick(advert, 'country', 'country_name')) ?? 'Polska',
    latitude: toNumber(pick(advert, 'lat', 'latitude')),
    longitude: toNumber(pick(advert, 'lon', 'lng', 'longitude')),

    thumbnailUrl: extractThumbnail(advert),
    imagesCount: countPhotos(advert),
    publishedAt:
      toDate(advert.created_at ?? advert.createdAt) ??
      toDate(advert.published_at ?? advert.activated_at ?? advert.last_refresh),

    raw: advert,
  };
}

function lookup<T>(map: Record<string, T>, value: unknown): T | null {
  const key = slug(value);
  if (!key) return null;
  return map[key] ?? null;
}

function mapCondition(value: unknown): VehicleCondition | null {
  const key = slug(value);
  if (!key) return null;
  if (['new', 'nowy', 'nowe'].includes(key)) return 'new';
  if (['damaged', 'uszkodzony', 'uszkodzone'].includes(key)) return 'damaged';
  if (['used', 'uzywany', 'używany', 'uzywane'].includes(key)) return 'used';
  return null;
}

function mapGross(value: unknown): boolean | null {
  const key = slug(value);
  if (!key) return null;
  if (key === 'gross' || key === 'brutto') return true;
  if (key === 'net' || key === 'netto') return false;
  return null;
}

function mapSellerType(advert: Raw): SellerType {
  const raw = slug(pick(advert, 'seller_type', 'advertiser_type', 'business'));
  if (!raw) {
    // Dealer accounts expose a `dealer` / `company` object.
    if (asRecord(advert.dealer) || asRecord(advert.company)) return 'dealer';
    return 'unknown';
  }
  if (['private', 'prywatny', 'person', 'osoba-prywatna'].includes(raw)) {
    return 'private';
  }
  if (['dealer', 'business', 'firma', 'company', 'pro'].includes(raw)) {
    return 'dealer';
  }
  return 'unknown';
}

function extractSellerName(advert: Raw): string | null {
  const contact = asRecord(advert.contact) ?? asRecord(advert.user);
  const dealer = asRecord(advert.dealer) ?? asRecord(advert.company);
  const name =
    dealer?.name ?? contact?.name ?? contact?.person ?? advert.seller_name;
  return name ? String(name).slice(0, 200) : null;
}

function extractThumbnail(advert: Raw): string | null {
  const photos = advert.photos ?? advert.images ?? advert.pictures;
  if (Array.isArray(photos) && photos.length > 0) {
    const first = photos[0];
    if (typeof first === 'string') return first;
    const rec = asRecord(first);
    const candidate =
      rec?.url ?? rec?.src ?? rec?.thumbnail ?? rec?.medium ?? rec?.large;
    if (candidate) return String(candidate);
  }
  const single = advert.thumbnail ?? advert.main_photo ?? advert.photo;
  if (typeof single === 'string') return single;
  const rec = asRecord(single);
  return rec?.url ? String(rec.url) : null;
}

function countPhotos(advert: Raw): number | null {
  const photos = advert.photos ?? advert.images ?? advert.pictures;
  return Array.isArray(photos) ? photos.length : null;
}

function normalizeVin(value: unknown): string | null {
  if (!value) return null;
  const vin = String(value).trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin) ? vin : null;
}

/** Extracts the advert array from whichever envelope the endpoint used. */
export function extractAdverts(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);

  const rec = asRecord(payload);
  if (!rec) return [];

  for (const key of ['results', 'data', 'adverts', 'items', 'ads']) {
    const value = rec[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    // Some envelopes nest one level deeper: { data: { results: [...] } }.
    const nested = asRecord(value);
    if (nested) {
      for (const inner of ['results', 'items', 'adverts']) {
        if (Array.isArray(nested[inner])) {
          return (nested[inner] as unknown[]).filter(isRecord);
        }
      }
    }
  }
  return [];
}

export function extractTotalCount(payload: unknown): number | undefined {
  const rec = asRecord(payload);
  if (!rec) return undefined;
  const value =
    rec.total_count ?? rec.totalCount ?? rec.total ?? rec.count ??
    asRecord(rec.meta)?.total_count ?? asRecord(rec.meta)?.total;
  const n = toInt(value);
  return n ?? undefined;
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
