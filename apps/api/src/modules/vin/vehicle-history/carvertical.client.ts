import { env } from '../../../config/env.js';
import { VehicleHistoryContractError, type VehicleHistoryProvider, type VehicleHistoryReport } from './types.js';

/**
 * !!! NEEDS VERIFICATION BEFORE FIRST REAL USE !!!
 * Same situation as `autodna.client.ts` - see that file's doc comment for
 * why. carVertical's partner/API program is a paid product I do not have
 * confirmed current documentation for. This is a best-effort skeleton on
 * the same assumed REST shape (API key header, VIN in the path, JSON
 * report back), wired into the rest of the app so the feature is otherwise
 * complete. Before this returns real data:
 *   1. Get carVertical's real API docs (their partner/business program).
 *   2. Fix `BASE_URL`, the auth header, and the endpoint path below.
 *   3. Fix `mapResponse()` against an actual sample response.
 */
const BASE_URL = 'https://api.carvertical.com/v1'; // TODO: verify against real carVertical API docs

interface CarVerticalRawResponse {
  report_url?: string;
  owners_count?: number;
  mileage_records?: Array<{ date?: string; mileage_km?: number; source?: string }>;
  damage_records?: Array<{ date?: string; description?: string; severity?: string }>;
  theft_status?: string;
  import_country?: string;
}

function mapSeverity(raw: string | undefined): VehicleHistoryReport['damageRecords'][number]['severity'] {
  const s = raw?.toLowerCase();
  if (s === 'minor' || s === 'moderate' || s === 'severe') return s;
  return 'unknown';
}

function mapResponse(vin: string, raw: CarVerticalRawResponse): VehicleHistoryReport {
  return {
    provider: 'carvertical',
    vin,
    fetchedAt: new Date().toISOString(),
    reportUrl: raw.report_url ?? null,
    ownersCount: typeof raw.owners_count === 'number' ? raw.owners_count : null,
    mileageRecords: (raw.mileage_records ?? []).map((m) => ({
      date: m.date ?? null,
      mileageKm: m.mileage_km ?? 0,
      source: m.source ?? null,
    })),
    damageRecords: (raw.damage_records ?? []).map((d) => ({
      date: d.date ?? null,
      description: d.description ?? 'Brak opisu',
      severity: mapSeverity(d.severity),
    })),
    stolenStatus:
      raw.theft_status === 'reported' ? 'reported_stolen' : raw.theft_status === 'clear' ? 'clear' : 'unknown',
    importCountry: raw.import_country ?? null,
    notes: [],
  };
}

export const carVerticalProvider: VehicleHistoryProvider = {
  name: 'carvertical',

  async fetchReport(vin: string): Promise<VehicleHistoryReport> {
    const res = await fetch(`${BASE_URL}/vin/${encodeURIComponent(vin)}/report`, {
      headers: {
        // TODO: verify - could be `Authorization: Bearer <key>` instead.
        'X-Api-Key': env.CARVERTICAL_API_KEY ?? '',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`carVertical API zwróciło ${res.status} - sprawdź klucz i dokumentację`);
    }

    let raw: CarVerticalRawResponse;
    try {
      raw = (await res.json()) as CarVerticalRawResponse;
    } catch {
      throw new VehicleHistoryContractError('carVertical', 'odpowiedź nie jest poprawnym JSON-em');
    }

    return mapResponse(vin, raw);
  },
};
