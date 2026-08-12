/**
 * World Manufacturer Identifier (WMI) - the first three characters of a VIN,
 * standardised by ISO 3780. Not a secret or licensed dataset: these
 * assignments are public, published by SAE/manufacturers, and widely
 * documented. Curated for the makes this app already knows about (see
 * `knowledge` module) plus other brands common on the Polish used-car
 * market - not exhaustive (nobody outside SAE has the *complete* registry
 * for free), but covers the overwhelming majority of what actually shows up
 * in listings.
 */
export const WMI_TABLE: Record<string, { make: string; country: string }> = {
  // Volkswagen Group - Germany
  WVW: { make: 'Volkswagen', country: 'Niemcy' },
  WV1: { make: 'Volkswagen (dostawcze)', country: 'Niemcy' },
  WV2: { make: 'Volkswagen (dostawcze)', country: 'Niemcy' },
  WVG: { make: 'Volkswagen', country: 'Niemcy' },
  WAU: { make: 'Audi', country: 'Niemcy' },
  WA1: { make: 'Audi', country: 'Niemcy' },
  TMB: { make: 'Skoda', country: 'Czechy' },
  TMK: { make: 'Skoda', country: 'Czechy' },
  VSS: { make: 'Seat', country: 'Hiszpania' },
  VSE: { make: 'Seat', country: 'Hiszpania' },
  WP0: { make: 'Porsche', country: 'Niemcy' },
  WP1: { make: 'Porsche', country: 'Niemcy' },
  // BMW Group
  WBA: { make: 'BMW', country: 'Niemcy' },
  WBS: { make: 'BMW M', country: 'Niemcy' },
  WBY: { make: 'BMW i', country: 'Niemcy' },
  WMW: { make: 'MINI', country: 'Niemcy' },
  // Mercedes-Benz / Daimler
  WDB: { make: 'Mercedes-Benz', country: 'Niemcy' },
  WDD: { make: 'Mercedes-Benz', country: 'Niemcy' },
  WDC: { make: 'Mercedes-Benz', country: 'Niemcy' },
  WDF: { make: 'Mercedes-Benz (dostawcze)', country: 'Niemcy' },
  WME: { make: 'Smart', country: 'Niemcy' },
  // Opel/Stellantis Germany
  W0L: { make: 'Opel', country: 'Niemcy' },
  W0V: { make: 'Opel', country: 'Niemcy' },
  WF0: { make: 'Ford', country: 'Niemcy' },
  // Stellantis / PSA - France
  VF1: { make: 'Renault', country: 'Francja' },
  VF3: { make: 'Peugeot', country: 'Francja' },
  VF7: { make: 'Citroen', country: 'Francja' },
  VF8: { make: 'Citroen', country: 'Francja' },
  VXK: { make: 'Renault', country: 'Francja' },
  // Fiat/Stellantis - Italy
  ZFA: { make: 'Fiat', country: 'Włochy' },
  ZAR: { make: 'Alfa Romeo', country: 'Włochy' },
  ZLA: { make: 'Lancia', country: 'Włochy' },
  ZFF: { make: 'Ferrari', country: 'Włochy' },
  ZAM: { make: 'Maserati', country: 'Włochy' },
  // UK
  SAJ: { make: 'Jaguar', country: 'Wielka Brytania' },
  SAL: { make: 'Land Rover', country: 'Wielka Brytania' },
  SB1: { make: 'Toyota', country: 'Wielka Brytania' },
  SCC: { make: 'Lotus', country: 'Wielka Brytania' },
  SCB: { make: 'Bentley', country: 'Wielka Brytania' },
  SCF: { make: 'Aston Martin', country: 'Wielka Brytania' },
  // Japan
  JT2: { make: 'Toyota', country: 'Japonia' },
  JT3: { make: 'Toyota', country: 'Japonia' },
  JT4: { make: 'Toyota', country: 'Japonia' },
  JTD: { make: 'Toyota', country: 'Japonia' },
  JTE: { make: 'Toyota', country: 'Japonia' },
  JTG: { make: 'Toyota', country: 'Japonia' },
  JTH: { make: 'Lexus', country: 'Japonia' },
  JTJ: { make: 'Lexus', country: 'Japonia' },
  JTK: { make: 'Toyota', country: 'Japonia' },
  JTL: { make: 'Toyota', country: 'Japonia' },
  JTM: { make: 'Toyota', country: 'Japonia' },
  JTN: { make: 'Toyota', country: 'Japonia' },
  JHM: { make: 'Honda', country: 'Japonia' },
  JHL: { make: 'Honda', country: 'Japonia' },
  JH4: { make: 'Acura', country: 'Japonia' },
  JN1: { make: 'Nissan', country: 'Japonia' },
  JN6: { make: 'Nissan', country: 'Japonia' },
  JN8: { make: 'Nissan', country: 'Japonia' },
  JM1: { make: 'Mazda', country: 'Japonia' },
  JM3: { make: 'Mazda', country: 'Japonia' },
  JMZ: { make: 'Mazda', country: 'Japonia' },
  JS1: { make: 'Suzuki', country: 'Japonia' },
  JS2: { make: 'Suzuki', country: 'Japonia' },
  JS3: { make: 'Suzuki', country: 'Japonia' },
  JA3: { make: 'Mitsubishi', country: 'Japonia' },
  JA4: { make: 'Mitsubishi', country: 'Japonia' },
  JMB: { make: 'Mitsubishi', country: 'Japonia' },
  JF1: { make: 'Subaru', country: 'Japonia' },
  JF2: { make: 'Subaru', country: 'Japonia' },
  // Korea
  KMH: { make: 'Hyundai', country: 'Korea Południowa' },
  KMJ: { make: 'Hyundai', country: 'Korea Południowa' },
  KNA: { make: 'Kia', country: 'Korea Południowa' },
  KND: { make: 'Kia', country: 'Korea Południowa' },
  KNM: { make: 'Renault Samsung', country: 'Korea Południowa' },
  // Sweden
  YV1: { make: 'Volvo', country: 'Szwecja' },
  YV4: { make: 'Volvo', country: 'Szwecja' },
  YS3: { make: 'Saab', country: 'Szwecja' },
  // Romania
  UU1: { make: 'Dacia', country: 'Rumunia' },
  // USA
  '1G1': { make: 'Chevrolet', country: 'USA' },
  '1G6': { make: 'Cadillac', country: 'USA' },
  '1FA': { make: 'Ford', country: 'USA' },
  '1FM': { make: 'Ford', country: 'USA' },
  '1FT': { make: 'Ford', country: 'USA' },
  '1C3': { make: 'Chrysler', country: 'USA' },
  '1C4': { make: 'Jeep', country: 'USA' },
  '1C6': { make: 'RAM', country: 'USA' },
  '1J4': { make: 'Jeep', country: 'USA' },
  '1J8': { make: 'Jeep', country: 'USA' },
  '5YJ': { make: 'Tesla', country: 'USA' },
  '5UX': { make: 'BMW (SUV, produkcja USA)', country: 'USA' },
  '4US': { make: 'BMW (produkcja USA)', country: 'USA' },
  // China
  LFV: { make: 'FAW-Volkswagen', country: 'Chiny' },
  LSV: { make: 'Skoda (produkcja Chiny)', country: 'Chiny' },
  LVS: { make: 'Ford (produkcja Chiny)', country: 'Chiny' },
  LGB: { make: 'Buick (produkcja Chiny)', country: 'Chiny' },
};

/**
 * First character only, as a fallback when the exact 3-letter WMI is not in
 * the table above - still tells the region/country, just not the make.
 * Approximate on purpose (several countries share ranges by design).
 */
export const WMI_REGION_FALLBACK: Record<string, string> = {
  '1': 'USA',
  '4': 'USA',
  '5': 'USA',
  '2': 'Kanada',
  '3': 'Meksyk',
  '6': 'Australia',
  '9': 'Brazylia/Ameryka Płd.',
  J: 'Japonia',
  K: 'Korea Południowa',
  L: 'Chiny',
  S: 'Wielka Brytania',
  T: 'Czechy/Szwajcaria',
  V: 'Francja/Hiszpania',
  W: 'Niemcy',
  X: 'Rosja/Kraje Beneluksu',
  Y: 'Szwecja/Finlandia/Belgia',
  Z: 'Włochy',
};

/**
 * ISO 3779 transliteration - letters map to digits for the check-digit sum.
 * I, O, Q are not valid VIN characters at all (too easily confused with
 * 1/0/0), so they are intentionally absent.
 */
export const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

/** Position weights 1-17 (position 9, the check digit itself, carries no weight). */
export const VIN_CHECK_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Position-10 model-year code cycle (ISO 3779), 30 characters long,
 * excluding I/O/Q/U/Z and 0 by convention. The cycle repeats every 30 years,
 * so a code alone is ambiguous - `decodeModelYears` returns every candidate
 * in a plausible window rather than guessing one.
 */
export const VIN_YEAR_CODES = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K',
  'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X',
  'Y', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];
