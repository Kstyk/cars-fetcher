const priceFormatter = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('pl-PL');

const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatPrice(
  value: number | null | undefined,
  currency = 'PLN',
): string {
  if (value === null || value === undefined) return 'Cena na zapytanie';
  if (currency === 'PLN') return priceFormatter.format(value);
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : numberFormatter.format(value);
}

export function formatMileage(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : `${numberFormatter.format(value)} km`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

/** "3 godz. temu" - relative labels read better in a feed of fresh adverts. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = date.getTime() - Date.now();
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];

  const rtf = new Intl.RelativeTimeFormat('pl-PL', { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return 'przed chwilą';
}

export const FUEL_LABELS: Record<string, string> = {
  petrol: 'Benzyna',
  petrol_lpg: 'Benzyna + LPG',
  petrol_cng: 'Benzyna + CNG',
  diesel: 'Diesel',
  hybrid: 'Hybryda',
  plugin_hybrid: 'Hybryda plug-in',
  electric: 'Elektryczny',
  hydrogen: 'Wodór',
  other: 'Inne',
};

export const GEARBOX_LABELS: Record<string, string> = {
  manual: 'Manualna',
  automatic: 'Automatyczna',
  semi_automatic: 'Półautomatyczna',
  other: 'Inna',
};

export const BODY_LABELS: Record<string, string> = {
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  wagon: 'Kombi',
  suv: 'SUV',
  coupe: 'Coupe',
  convertible: 'Kabriolet',
  minivan: 'Minivan',
  pickup: 'Pickup',
  van: 'Van',
  other: 'Inne',
};

export const PROVIDER_LABELS: Record<string, string> = {
  otomoto: 'Otomoto',
  olx: 'OLX',
  autoplac: 'autoplac.pl',
  findcar: 'FindCar',
  mobile_de: 'mobile.de',
  autoscout24: 'AutoScout24',
};

/** Brand colours, so the source is recognisable at a glance on a card. */
export const PROVIDER_COLORS: Record<string, string> = {
  otomoto: '#0a5aff',
  olx: '#23e5db',
  autoplac: '#ff6b00',
  findcar: '#7c3aed',
  mobile_de: '#f59e0b',
  autoscout24: '#eab308',
};

export const SELLER_LABELS: Record<string, string> = {
  private: 'Osoba prywatna',
  dealer: 'Dealer',
  unknown: 'Nieznany',
};

export function label(
  dictionary: Record<string, string>,
  key: string | null | undefined,
): string {
  if (!key) return '—';
  return dictionary[key] ?? key;
}
