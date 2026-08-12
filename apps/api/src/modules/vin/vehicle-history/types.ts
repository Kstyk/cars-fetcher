/**
 * The normalized shape every paid vehicle-history provider maps into -
 * mirrors how `providers/types.ts#NormalizedListing` lets every marketplace
 * scraper feed the same downstream code despite wildly different raw
 * payloads. Add a new provider by writing one function that fills this
 * shape in, nothing downstream needs to change.
 */
export interface VehicleHistoryReport {
  provider: 'autodna' | 'carvertical';
  vin: string;
  fetchedAt: string;
  /** Link to the full report on the provider's own site, when they give one. */
  reportUrl: string | null;
  ownersCount: number | null;
  mileageRecords: Array<{
    date: string | null;
    mileageKm: number;
    source: string | null;
  }>;
  damageRecords: Array<{
    date: string | null;
    description: string;
    severity: 'minor' | 'moderate' | 'severe' | 'unknown';
  }>;
  stolenStatus: 'clear' | 'reported_stolen' | 'unknown';
  importCountry: string | null;
  /** Anything the provider returns that doesn't fit a field above. */
  notes: string[];
}

export interface VehicleHistoryProvider {
  readonly name: VehicleHistoryReport['provider'];
  fetchReport(vin: string): Promise<VehicleHistoryReport>;
}

/**
 * Thrown by a provider client when the call reached the API but the
 * response didn't look like what the integration expects - almost always
 * means the vendor's contract has changed (or was never fully confirmed;
 * see the doc comment at the top of each client file) and the
 * request/response mapping needs a look, not a retry.
 */
export class VehicleHistoryContractError extends Error {
  constructor(provider: string, detail: string) {
    super(`${provider}: odpowiedź API nie pasuje do oczekiwanego kształtu (${detail})`);
    this.name = 'VehicleHistoryContractError';
  }
}
