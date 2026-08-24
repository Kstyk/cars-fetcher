import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeGroupRun,
  formatDate,
  formatMileage,
  formatNumber,
  formatPrice,
  formatRelative,
  label,
} from './format';
import type { GroupRunResult } from './types';

// `Intl.NumberFormat('pl-PL')` groups thousands with a narrow no-break space
// (U+202F), not a plain U+0020 - matching on that literal codepoint would
// make these tests fail depending on the ICU data available, for a reason
// that has nothing to do with `format.ts` itself. `\s` matches either.
describe('formatPrice', () => {
  it('formats a PLN amount with no decimals', () => {
    expect(formatPrice(83_549)).toMatch(/^83\s549\szł$/);
  });

  it('falls back to a placeholder for a missing price', () => {
    expect(formatPrice(null)).toBe('Cena na zapytanie');
    expect(formatPrice(undefined)).toBe('Cena na zapytanie');
  });

  it('formats a non-PLN currency using its own symbol', () => {
    expect(formatPrice(10_000, 'EUR')).toMatch(/10\s?000/);
    expect(formatPrice(10_000, 'EUR')).not.toBe(formatPrice(10_000, 'PLN'));
  });
});

describe('formatNumber / formatMileage', () => {
  it('groups thousands and appends a unit for mileage', () => {
    expect(formatNumber(103_565)).toMatch(/^103\s565$/);
    expect(formatMileage(103_565)).toMatch(/^103\s565\skm$/);
  });

  it('renders a dash for a missing value, not "0" or "NaN"', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatMileage(undefined)).toBe('—');
  });
});

describe('formatDate', () => {
  it('renders a dash for a missing or unparsable date', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('formats a real date without throwing', () => {
    expect(formatDate('2026-01-15T00:00:00Z')).not.toBe('—');
  });
});

describe('formatRelative', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses anything under a minute to "przed chwilą"', () => {
    expect(formatRelative(new Date('2026-06-15T11:59:31Z'))).toBe('przed chwilą');
  });

  it('picks the largest unit that applies - hours, not minutes, at 3h', () => {
    expect(formatRelative(new Date('2026-06-15T09:00:00Z'))).toMatch(/godz/);
  });

  it('handles a future date the same way (e.g. a scheduled next fetch)', () => {
    expect(formatRelative(new Date('2026-06-15T15:00:00Z'))).toMatch(/za/);
  });

  it('renders a dash for a missing date', () => {
    expect(formatRelative(null)).toBe('—');
  });
});

describe('label', () => {
  const dict = { petrol: 'Benzyna' };

  it('looks up a known key', () => {
    expect(label(dict, 'petrol')).toBe('Benzyna');
  });

  it('falls back to the raw key for an unmapped value - never silently blank', () => {
    expect(label(dict, 'some_new_enum_value')).toBe('some_new_enum_value');
  });

  it('renders a dash for a missing key', () => {
    expect(label(dict, null)).toBe('—');
    expect(label(dict, undefined)).toBe('—');
  });
});

describe('describeGroupRun', () => {
  function result(overrides: Partial<GroupRunResult>): GroupRunResult {
    return {
      groupId: 'g1',
      groupName: 'Kompakty',
      totalNew: 0,
      totalSeen: 10,
      durationMs: 100,
      filters: [],
      ...overrides,
    };
  }

  it('reports success with a pluralised count of new listings', () => {
    expect(describeGroupRun(result({ totalNew: 3 }))).toEqual({
      kind: 'success',
      message: 'Kompakty: 3 nowych ofert',
    });
  });

  it('uses the singular form for exactly one new listing', () => {
    expect(describeGroupRun(result({ totalNew: 1 }))).toEqual({
      kind: 'success',
      message: 'Kompakty: 1 nowa oferta',
    });
  });

  it('reports "no new listings" when nothing new showed up', () => {
    expect(describeGroupRun(result({ totalNew: 0 }))).toEqual({
      kind: 'info',
      message: 'Kompakty: brak nowych ofert',
    });
  });

  it('reports an error when any filter failed, even if others found new listings', () => {
    const run = result({
      totalNew: 5,
      filters: [
        { filterId: 'f1', filterName: 'Golf', status: 'success', itemsSeen: 5, itemsNew: 5 },
        { filterId: 'f2', filterName: 'Polo', status: 'failed', itemsSeen: 0, itemsNew: 0 },
      ],
    });
    expect(describeGroupRun(run)).toEqual({
      kind: 'error',
      message: 'Kompakty: 1 z 2 filtrów nie powiodło się',
    });
  });
});
