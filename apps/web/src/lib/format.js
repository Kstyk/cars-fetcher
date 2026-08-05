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
export function formatPrice(value, currency = 'PLN') {
    if (value === null || value === undefined)
        return 'Cena na zapytanie';
    if (currency === 'PLN')
        return priceFormatter.format(value);
    return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(value);
}
export function formatNumber(value) {
    return value === null || value === undefined ? '—' : numberFormatter.format(value);
}
export function formatMileage(value) {
    return value === null || value === undefined
        ? '—'
        : `${numberFormatter.format(value)} km`;
}
export function formatDate(value) {
    if (!value)
        return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}
export function formatDateTime(value) {
    if (!value)
        return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}
/** "3 godz. temu" - relative labels read better in a feed of fresh adverts. */
export function formatRelative(value) {
    if (!value)
        return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime()))
        return '—';
    const diffMs = date.getTime() - Date.now();
    const units = [
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
export const FUEL_LABELS = {
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
export const GEARBOX_LABELS = {
    manual: 'Manualna',
    automatic: 'Automatyczna',
    semi_automatic: 'Półautomatyczna',
    other: 'Inna',
};
export const BODY_LABELS = {
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
export const SELLER_LABELS = {
    private: 'Osoba prywatna',
    dealer: 'Dealer',
    unknown: 'Nieznany',
};
export function label(dictionary, key) {
    if (!key)
        return '—';
    return dictionary[key] ?? key;
}
