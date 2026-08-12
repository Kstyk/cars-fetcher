import { logger } from '../../config/logger.js';

const NHTSA_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues';

export interface NhtsaEnrichment {
  make: string | null;
  model: string | null;
  modelYear: string | null;
  series: string | null;
  trim: string | null;
  bodyClass: string | null;
  vehicleType: string | null;
  doors: string | null;
  engineCylinders: string | null;
  engineHp: string | null;
  displacementL: string | null;
  fuelTypePrimary: string | null;
  driveType: string | null;
  transmissionStyle: string | null;
  transmissionSpeeds: string | null;
  plantCountry: string | null;
  plantCity: string | null;
  /**
   * Safety equipment - the only kind of "equipment" a free VIN decode can
   * actually answer for. NHTSA collects these because US regulation requires
   * manufacturers to report them; there is no free (or, realistically, legal
   * without a paid commercial data licence) source for comfort/luxury
   * options like leather seats or a sunroof - those live in each
   * manufacturer's own build-data systems, not in any public VIN registry.
   */
  airbagFront: string | null;
  airbagSide: string | null;
  airbagCurtain: string | null;
  airbagKnee: string | null;
  seatBelts: string | null;
  /** NHTSA's own decode-quality note - worth surfacing verbatim when present. */
  errorText: string | null;
}

// Raw shape is ~150 mostly-empty-string fields; only the ones actually used
// are declared here.
interface NhtsaResult {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Series?: string;
  Trim?: string;
  BodyClass?: string;
  VehicleType?: string;
  Doors?: string;
  EngineCylinders?: string;
  EngineHP?: string;
  DisplacementL?: string;
  FuelTypePrimary?: string;
  DriveType?: string;
  TransmissionStyle?: string;
  TransmissionSpeeds?: string;
  PlantCountry?: string;
  PlantCity?: string;
  AirBagLocFront?: string;
  AirBagLocSide?: string;
  AirBagLocCurtain?: string;
  AirBagLocKnee?: string;
  SeatBeltsAll?: string;
  ErrorText?: string;
}

// A VIN's decode never changes, so a lookup is cached for the life of the
// process - no reason to ask NHTSA the same question twice. Capped so a
// stream of one-off garbage input can't grow this unbounded.
const cache = new Map<string, NhtsaEnrichment | null>();
const MAX_CACHE_SIZE = 1000;

const blank = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

/**
 * Best-effort enrichment via NHTSA's free, no-key vPIC API. Tuned for the
 * US market - a VIN for a car only ever sold in Europe will often come back
 * mostly empty, which is expected and shown as such, not treated as failure.
 */
export async function fetchNhtsaDecode(vin: string): Promise<NhtsaEnrichment | null> {
  if (cache.has(vin)) return cache.get(vin) ?? null;

  let result: NhtsaEnrichment | null = null;
  try {
    const res = await fetch(`${NHTSA_URL}/${encodeURIComponent(vin)}?format=json`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const body = (await res.json()) as { Results?: NhtsaResult[] };
      const row = body.Results?.[0];
      if (row) {
        result = {
          make: blank(row.Make),
          model: blank(row.Model),
          modelYear: blank(row.ModelYear),
          series: blank(row.Series),
          trim: blank(row.Trim),
          bodyClass: blank(row.BodyClass),
          vehicleType: blank(row.VehicleType),
          doors: blank(row.Doors),
          engineCylinders: blank(row.EngineCylinders),
          engineHp: blank(row.EngineHP),
          displacementL: blank(row.DisplacementL),
          fuelTypePrimary: blank(row.FuelTypePrimary),
          driveType: blank(row.DriveType),
          transmissionStyle: blank(row.TransmissionStyle),
          transmissionSpeeds: blank(row.TransmissionSpeeds),
          plantCountry: blank(row.PlantCountry),
          plantCity: blank(row.PlantCity),
          airbagFront: blank(row.AirBagLocFront),
          airbagSide: blank(row.AirBagLocSide),
          airbagCurtain: blank(row.AirBagLocCurtain),
          airbagKnee: blank(row.AirBagLocKnee),
          seatBelts: blank(row.SeatBeltsAll),
          errorText: blank(row.ErrorText),
        };
      }
    }
  } catch (err) {
    // Network hiccup or NHTSA down - the local decode still stands on its
    // own, so this degrades to "no enrichment" rather than failing the call.
    logger.debug({ err, vin }, 'NHTSA vPIC lookup failed, continuing without enrichment');
  }

  if (cache.size >= MAX_CACHE_SIZE) cache.clear();
  cache.set(vin, result);
  return result;
}
