import { env } from '../../../config/env.js';
import { VehicleHistoryContractError, type VehicleHistoryProvider, type VehicleHistoryReport } from './types.js';

/**
 * !!! NEEDS VERIFICATION BEFORE FIRST REAL USE !!!
 *
 * AutoDNA (autodna.pl / autodna.com) is not a public, stable, documented API
 * the way NHTSA vPIC is - it's a paid commercial product, and I do not have
 * confirmed, current documentation for its exact endpoint URL, auth scheme
 * or response shape. What follows is a best-effort implementation using the
 * request pattern such report APIs typically use (API key header, VIN in
 * the path, JSON report back), wired into the rest of the app so the
 * feature is otherwise complete - routes, UI, cost gating, graceful
 * degradation.
 *
 * Before this can actually return real data:
 *   1. Sign up for an AutoDNA API plan and get their real API docs.
 *   2. Fix `BASE_URL`, the auth header/param name, and the endpoint path
 *      below to match.
 *   3. Fix `mapResponse()` to read the real field names from an actual
 *      sample response (log `raw` and look).
 * Until then this either 404s/401s against a guessed URL, or throws
 * `VehicleHistoryContractError` if it gets a response shaped differently
 * than expected - both cases are surfaced to the UI as a clear error, never
 * silently wrong data.
 */
const BASE_URL = 'https://api.autodna.com/v2'; // TODO: verify against real AutoDNA API docs

interface AutoDnaRawResponse {
  reportUrl?: string;
  owners?: number;
  mileageHistory?: Array<{ date?: string; mileage?: number; source?: string }>;
  damages?: Array<{ date?: string; description?: string; severity?: string }>;
  stolen?: boolean;
  importCountry?: string;
}

function mapSeverity(raw: string | undefined): VehicleHistoryReport['damageRecords'][number]['severity'] {
  const s = raw?.toLowerCase();
  if (s === 'minor' || s === 'moderate' || s === 'severe') return s;
  return 'unknown';
}

function mapResponse(vin: string, raw: AutoDnaRawResponse): VehicleHistoryReport {
  return {
    provider: 'autodna',
    vin,
    fetchedAt: new Date().toISOString(),
    reportUrl: raw.reportUrl ?? null,
    ownersCount: typeof raw.owners === 'number' ? raw.owners : null,
    mileageRecords: (raw.mileageHistory ?? []).map((m) => ({
      date: m.date ?? null,
      mileageKm: m.mileage ?? 0,
      source: m.source ?? null,
    })),
    damageRecords: (raw.damages ?? []).map((d) => ({
      date: d.date ?? null,
      description: d.description ?? 'Brak opisu',
      severity: mapSeverity(d.severity),
    })),
    stolenStatus: raw.stolen === true ? 'reported_stolen' : raw.stolen === false ? 'clear' : 'unknown',
    importCountry: raw.importCountry ?? null,
    notes: [],
  };
}

export const autoDnaProvider: VehicleHistoryProvider = {
  name: 'autodna',

  async fetchReport(vin: string): Promise<VehicleHistoryReport> {
    const res = await fetch(`${BASE_URL}/report/${encodeURIComponent(vin)}`, {
      headers: {
        // TODO: verify - could be `Authorization: Bearer <key>`, `X-API-Key`,
        // or a query-string key instead. Guessing the common REST pattern.
        'X-API-Key': env.AUTODNA_API_KEY ?? '',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`AutoDNA API zwróciło ${res.status} - sprawdź klucz i dokumentację`);
    }

    let raw: AutoDnaRawResponse;
    try {
      raw = (await res.json()) as AutoDnaRawResponse;
    } catch {
      throw new VehicleHistoryContractError('AutoDNA', 'odpowiedź nie jest poprawnym JSON-em');
    }

    return mapResponse(vin, raw);
  },
};
