/**
 * Canonical voivodeship names.
 *
 * Providers spell them inconsistently - the same region arrives as
 * "Kujawsko pomorskie", "Kujawsko-pomorskie" and "Kujawsko-Pomorskie", which
 * would show up as three separate options in a filter. Everything is folded to
 * one spelling on the way in.
 */
export const VOIVODESHIPS = [
  'Dolnośląskie',
  'Kujawsko-pomorskie',
  'Lubelskie',
  'Lubuskie',
  'Łódzkie',
  'Małopolskie',
  'Mazowieckie',
  'Opolskie',
  'Podkarpackie',
  'Podlaskie',
  'Pomorskie',
  'Śląskie',
  'Świętokrzyskie',
  'Warmińsko-mazurskie',
  'Wielkopolskie',
  'Zachodniopomorskie',
] as const;

export type Voivodeship = (typeof VOIVODESHIPS)[number];

/** Comparison key: lowercase, no diacritics, spaces and dashes removed. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s-]+/g, '');
}

const BY_KEY = new Map<string, Voivodeship>(
  VOIVODESHIPS.map((name) => [fold(name), name]),
);

export function normalizeVoivodeship(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Unknown spellings are kept as-is rather than dropped - better a stray
  // option in the filter than a listing with no region at all.
  return BY_KEY.get(fold(trimmed)) ?? trimmed;
}
