import {
  VIN_CHECK_WEIGHTS,
  VIN_TRANSLITERATION,
  VIN_YEAR_CODES,
  WMI_REGION_FALLBACK,
  WMI_TABLE,
} from './vin.data.js';

export interface VinDecodeResult {
  vin: string;
  /** 17 chars, valid charset (no I/O/Q), before any deeper check. */
  formatValid: boolean;
  formatError: string | null;
  make: string | null;
  country: string | null;
  /** `null` when the WMI wasn't in the table - only the region fallback matched. */
  makeSource: 'exact' | 'region_only' | null;
  /**
   * `null` when the VIN is not shaped like a North-American one, since the
   * check digit is only meaningful there - see `verifyCheckDigit` doc comment.
   */
  checkDigitValid: boolean | null;
  /** Every plausible year this position-10 code could mean (30-year cycle ambiguity). */
  candidateYears: number[];
}

const VALID_VIN_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/;

function validateFormat(vin: string): { valid: boolean; error: string | null } {
  if (vin.length !== 17) {
    return { valid: false, error: `VIN ma 17 znaków, podano ${vin.length}` };
  }
  if (!VALID_VIN_CHARS.test(vin)) {
    return {
      valid: false,
      error: 'VIN zawiera niedozwolone znaki (litery I, O, Q nigdy nie występują w VIN)',
    };
  }
  return { valid: true, error: null };
}

function lookupWmi(vin: string): { make: string | null; country: string | null; source: VinDecodeResult['makeSource'] } {
  const wmi3 = vin.slice(0, 3);
  const exact = WMI_TABLE[wmi3];
  if (exact) return { make: exact.make, country: exact.country, source: 'exact' };

  const region = WMI_REGION_FALLBACK[vin[0] ?? ''];
  if (region) return { make: null, country: region, source: 'region_only' };

  return { make: null, country: null, source: null };
}

/**
 * The position-9 check digit is a North-American regulatory requirement
 * (US/Canada), not a universal one - plenty of genuine European-market VINs
 * simply don't follow this scheme, so a "mismatch" there does not prove a
 * VIN is fake. Returned as `null` rather than `false` unless the VIN's WMI
 * region is North America, so the UI never wrongly flags a real EU car.
 */
function verifyCheckDigit(vin: string, region: string | null): boolean | null {
  const northAmerica = region === 'USA' || region === 'Kanada' || region === 'Meksyk';
  if (!northAmerica) return null;

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i] ?? '';
    const value = char >= '0' && char <= '9' ? Number(char) : VIN_TRANSLITERATION[char];
    if (value === undefined) return null;
    sum += value * (VIN_CHECK_WEIGHTS[i] ?? 0);
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? 'X' : String(remainder);
  return vin[8] === expected;
}

/** Every year within a sane "used car on sale today" window that this code could mean. */
function decodeModelYears(vin: string): number[] {
  const code = vin[9];
  const offset = VIN_YEAR_CODES.indexOf(code ?? '');
  if (offset === -1) return [];

  const currentYear = new Date().getFullYear();
  const candidates: number[] = [];
  // A few 30-year cycles back and one forward is generous enough to cover
  // anything realistically still for sale, without producing a huge list.
  for (let cycle = -2; cycle <= 1; cycle++) {
    const year = 1980 + offset + cycle * 30;
    if (year >= 1980 && year <= currentYear + 1) candidates.push(year);
  }
  return candidates;
}

export function decodeVin(rawVin: string): VinDecodeResult {
  const vin = rawVin.trim().toUpperCase();
  const { valid, error } = validateFormat(vin);

  if (!valid) {
    return {
      vin,
      formatValid: false,
      formatError: error,
      make: null,
      country: null,
      makeSource: null,
      checkDigitValid: null,
      candidateYears: [],
    };
  }

  const { make, country, source } = lookupWmi(vin);

  return {
    vin,
    formatValid: true,
    formatError: null,
    make,
    country,
    makeSource: source,
    checkDigitValid: verifyCheckDigit(vin, country),
    candidateYears: decodeModelYears(vin),
  };
}
