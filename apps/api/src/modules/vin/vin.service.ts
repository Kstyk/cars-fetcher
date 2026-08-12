import { fetchNhtsaDecode, type NhtsaEnrichment } from './nhtsa.client.js';
import { decodeVin as decodeVinLocal, type VinDecodeResult } from './vin.decoder.js';

export interface VinLookupResult extends VinDecodeResult {
  /** `null` when the VIN's format is invalid (never worth asking NHTSA) or the lookup failed/came back empty. */
  nhtsa: NhtsaEnrichment | null;
}

/**
 * The local structural decode (offline, instant, always available) plus a
 * best-effort NHTSA enrichment pass. The two are independent - a malformed
 * VIN never reaches NHTSA, and NHTSA coming back empty (common for
 * Europe-only cars) never hides the local decode.
 */
export async function lookupVin(rawVin: string): Promise<VinLookupResult> {
  const local = decodeVinLocal(rawVin);
  if (!local.formatValid) return { ...local, nhtsa: null };

  const nhtsa = await fetchNhtsaDecode(local.vin);
  return { ...local, nhtsa };
}
