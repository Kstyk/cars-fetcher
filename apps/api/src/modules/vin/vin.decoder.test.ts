import { describe, expect, it } from 'vitest';
import { decodeVin } from './vin.decoder.js';

/**
 * "5YJSA1E40F0001234" is not a real advertised Tesla VIN - it's hand-built
 * so every field is independently verifiable against `vin.data.ts` without
 * trusting an external "this VIN is real" claim:
 *  - WMI "5YJ" -> Tesla / USA (exact WMI_TABLE hit, North America).
 *  - position-9 check digit '0' is the correct ISO 3779 digit for this
 *    string (worked by hand against VIN_TRANSLITERATION/VIN_CHECK_WEIGHTS -
 *    weighted sum 253, 253 % 11 == 0 -> '0').
 *  - position-10 year code 'F' -> offset 5 in VIN_YEAR_CODES -> candidate
 *    years 1985 and 2015 (the only two multiples-of-30 landing in
 *    [1980, currentYear + 1]).
 */
const VALID_NA_VIN = '5YJSA1E40F0001234';

describe('decodeVin - format validation', () => {
  it('rejects a VIN that is not 17 characters', () => {
    const result = decodeVin('5YJSA1E40F00012');
    expect(result.formatValid).toBe(false);
    expect(result.formatError).toMatch(/17 znaków/);
    expect(result.make).toBeNull();
    expect(result.candidateYears).toEqual([]);
  });

  it('rejects a VIN containing I, O or Q', () => {
    const result = decodeVin('5YJSA1E4OF0001234'); // 'O' at position 9
    expect(result.formatValid).toBe(false);
    expect(result.formatError).toMatch(/I, O, Q/);
  });

  it('trims whitespace and upper-cases before validating', () => {
    const result = decodeVin(`  ${VALID_NA_VIN.toLowerCase()}  `);
    expect(result.formatValid).toBe(true);
    expect(result.vin).toBe(VALID_NA_VIN);
  });
});

describe('decodeVin - WMI lookup', () => {
  it('resolves an exact WMI to make + country', () => {
    const result = decodeVin(VALID_NA_VIN);
    expect(result.formatValid).toBe(true);
    expect(result.make).toBe('Tesla');
    expect(result.country).toBe('USA');
    expect(result.makeSource).toBe('exact');
  });

  it('falls back to region-only when the 3-letter WMI is unknown but the first character is', () => {
    // "XXX" is not in WMI_TABLE; 'X' alone maps to a region in WMI_REGION_FALLBACK.
    const result = decodeVin('XXXAAAAAAAAAAAAAA');
    expect(result.formatValid).toBe(true);
    expect(result.make).toBeNull();
    expect(result.makeSource).toBe('region_only');
    expect(result.country).toBe('Rosja/Kraje Beneluksu');
  });

  it('returns nothing when neither the WMI nor the first character is known', () => {
    // Neither "AAA" nor a bare 'A' appear in either table.
    const result = decodeVin('AAAAAAAAAAAAAAAAA');
    expect(result.formatValid).toBe(true);
    expect(result.make).toBeNull();
    expect(result.country).toBeNull();
    expect(result.makeSource).toBeNull();
  });
});

describe('decodeVin - check digit', () => {
  it('validates a correct check digit for a North-American VIN', () => {
    const result = decodeVin(VALID_NA_VIN);
    expect(result.checkDigitValid).toBe(true);
  });

  it('flags an incorrect check digit for a North-American VIN', () => {
    const corrupted = VALID_NA_VIN.slice(0, 8) + '1' + VALID_NA_VIN.slice(9);
    const result = decodeVin(corrupted);
    expect(result.formatValid).toBe(true);
    expect(result.checkDigitValid).toBe(false);
  });

  it('does not apply the check digit to a non-North-American VIN', () => {
    // WVW -> Volkswagen / Niemcy - a real market where the digit isn't used.
    const result = decodeVin('WVWZZZ1JZXW000001');
    expect(result.formatValid).toBe(true);
    expect(result.country).toBe('Niemcy');
    expect(result.checkDigitValid).toBeNull();
  });
});

describe('decodeVin - model year', () => {
  it('lists every plausible 30-year-cycle candidate for the position-10 code', () => {
    const result = decodeVin(VALID_NA_VIN);
    expect(result.candidateYears).toEqual([1985, 2015]);
  });
});
