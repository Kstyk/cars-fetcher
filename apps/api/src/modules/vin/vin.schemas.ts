import { z } from 'zod';

/**
 * Deliberately loose - a malformed VIN is not a client error, it is exactly
 * the thing being asked about ("is this VIN even valid?"). Only reject
 * input that could not possibly be a VIN typo (empty, absurdly long).
 */
export const vinParam = z.object({
  vin: z.string().trim().min(1).max(32),
});
