import { env, vehicleHistoryConfigured } from '../../../config/env.js';
import { ConflictError } from '../../../lib/errors.js';
import { autoDnaProvider } from './autodna.client.js';
import { carVerticalProvider } from './carvertical.client.js';
import type { VehicleHistoryProvider, VehicleHistoryReport } from './types.js';

function activeProvider(): VehicleHistoryProvider | null {
  if (env.VEHICLE_HISTORY_PROVIDER === 'autodna') return autoDnaProvider;
  if (env.VEHICLE_HISTORY_PROVIDER === 'carvertical') return carVerticalProvider;
  return null;
}

export function getVehicleHistoryStatus(): { available: boolean; provider: string | null } {
  return {
    available: vehicleHistoryConfigured,
    provider: env.VEHICLE_HISTORY_PROVIDER === 'none' ? null : env.VEHICLE_HISTORY_PROVIDER,
  };
}

/**
 * A paid, per-call lookup - unlike the free VIN decode this never runs
 * automatically, only on an explicit user action (see the admin-gated
 * route), and fails loudly rather than silently if the provider isn't
 * configured or its contract doesn't match (see the client files' doc
 * comments on why that is a real possibility right now).
 */
export async function fetchVehicleHistory(vin: string): Promise<VehicleHistoryReport> {
  if (!vehicleHistoryConfigured) {
    throw new ConflictError(
      'Raport historii pojazdu wymaga skonfigurowanego dostawcy (AUTODNA_API_KEY lub CARVERTICAL_API_KEY oraz VEHICLE_HISTORY_PROVIDER) w konfiguracji serwera',
    );
  }
  const provider = activeProvider();
  if (!provider) {
    throw new ConflictError('Brak skonfigurowanego dostawcy historii pojazdu');
  }
  return provider.fetchReport(vin);
}
