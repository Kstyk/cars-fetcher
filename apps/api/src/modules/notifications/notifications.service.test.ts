import { describe, expect, it } from 'vitest';
import {
  isGoodDealWorthNotifying,
  isPriceDropWorthNotifying,
} from './notifications.service.js';
import type { NotificationPreferences } from '../../db/schema.js';

/** Only the fields these two pure functions actually read. */
function prefs(overrides: Partial<NotificationPreferences>): NotificationPreferences {
  return {
    priceDropThresholdPct: 1,
    goodDealThresholdPct: 15,
    ...overrides,
  } as NotificationPreferences;
}

describe('isPriceDropWorthNotifying', () => {
  it('fires at exactly the threshold', () => {
    expect(isPriceDropWorthNotifying(prefs({ priceDropThresholdPct: 5 }), -5)).toBe(true);
  });

  it('does not fire below the threshold', () => {
    expect(isPriceDropWorthNotifying(prefs({ priceDropThresholdPct: 5 }), -4.9)).toBe(false);
  });

  it('treats a price rise (positive delta) the same as a drop - magnitude only', () => {
    expect(isPriceDropWorthNotifying(prefs({ priceDropThresholdPct: 5 }), 6)).toBe(true);
  });
});

describe('isGoodDealWorthNotifying', () => {
  it('fires when the listing is at least the threshold below market', () => {
    // priceVsMarketPct is negative for "below median" - see listings.service.ts.
    expect(isGoodDealWorthNotifying(prefs({ goodDealThresholdPct: 15 }), -15)).toBe(true);
    expect(isGoodDealWorthNotifying(prefs({ goodDealThresholdPct: 15 }), -20)).toBe(true);
  });

  it('does not fire when the listing is above market or only slightly below', () => {
    expect(isGoodDealWorthNotifying(prefs({ goodDealThresholdPct: 15 }), -10)).toBe(false);
    expect(isGoodDealWorthNotifying(prefs({ goodDealThresholdPct: 15 }), 5)).toBe(false);
  });

  it('never fires when there is no market comparison at all', () => {
    // priceVsMarketPct is null when the cohort is too small to trust - see
    // MIN_MARKET_SAMPLE_SIZE in listings.service.ts.
    expect(isGoodDealWorthNotifying(prefs({ goodDealThresholdPct: 15 }), null)).toBe(false);
  });
});
