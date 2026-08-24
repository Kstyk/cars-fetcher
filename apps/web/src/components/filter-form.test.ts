import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER_FORM, filterToFormValue, toFilterPayload } from './filter-form';
import type { Filter } from '@/lib/types';

describe('toFilterPayload', () => {
  it('produces one payload per checked provider, sharing the same criteria', () => {
    const payloads = toFilterPayload({
      ...EMPTY_FILTER_FORM,
      providers: ['otomoto', 'olx'],
      make: 'Seat',
      model: 'Leon',
      priceTo: '50000',
    });

    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toMatchObject({ provider: 'otomoto', make: 'Seat', model: 'Leon', priceTo: 50_000 });
    expect(payloads[1]).toMatchObject({ provider: 'olx', make: 'Seat', model: 'Leon', priceTo: 50_000 });
  });

  it('turns a blank numeric field into null, not 0 or NaN', () => {
    const [payload] = toFilterPayload({ ...EMPTY_FILTER_FORM, priceFrom: '', priceTo: '  ' });
    expect(payload!.priceFrom).toBeNull();
    expect(payload!.priceTo).toBeNull();
  });

  it('turns an empty multi-select into null rather than an empty array', () => {
    const [payload] = toFilterPayload({ ...EMPTY_FILTER_FORM, fuelTypes: [] });
    expect(payload!.fuelTypes).toBeNull();
  });

  it('keeps a populated multi-select as an array', () => {
    const [payload] = toFilterPayload({ ...EMPTY_FILTER_FORM, fuelTypes: ['diesel', 'hybrid'] });
    expect(payload!.fuelTypes).toEqual(['diesel', 'hybrid']);
  });

  it('builds a "make model" name when both are set, and null when neither is', () => {
    const [withName] = toFilterPayload({ ...EMPTY_FILTER_FORM, make: 'Seat', model: 'Leon' });
    expect(withName!.name).toBe('Seat Leon');

    const [withoutName] = toFilterPayload({ ...EMPTY_FILTER_FORM });
    expect(withoutName!.name).toBeNull();
  });

  it('collapses a false boolean flag to null - only "true" is worth sending', () => {
    const [payload] = toFilterPayload({ ...EMPTY_FILTER_FORM, hasVin: false, firstOwner: true });
    expect(payload!.hasVin).toBeNull();
    expect(payload!.firstOwner).toBe(true);
  });

  it('converts door/seat counts to numbers', () => {
    const [payload] = toFilterPayload({ ...EMPTY_FILTER_FORM, doorCounts: ['3', '5'] });
    expect(payload!.doorCounts).toEqual([3, 5]);
  });
});

describe('filterToFormValue', () => {
  function fixtureFilter(overrides: Partial<Filter> = {}): Filter {
    return {
      provider: 'otomoto',
      make: 'Seat',
      model: 'Leon',
      yearFrom: 2015,
      yearTo: null,
      priceFrom: null,
      priceTo: 60_000,
      mileageFrom: null,
      mileageTo: null,
      enginePowerFrom: null,
      enginePowerTo: null,
      fuelTypes: null,
      gearboxes: null,
      bodyTypes: null,
      colors: null,
      countryOrigin: null,
      region: null,
      city: null,
      radiusKm: null,
      doorCounts: null,
      seatCounts: null,
      excludeDamaged: true,
      onlyWithPhotos: false,
      registeredInPl: null,
      firstOwner: null,
      noAccident: null,
      servicedAtAso: null,
      hasVin: null,
      vatInvoice: null,
      equipment: null,
      ...overrides,
    } as Filter;
  }

  it('round-trips a saved filter\'s numeric fields back into editable text', () => {
    const form = filterToFormValue(fixtureFilter());
    expect(form.yearFrom).toBe('2015');
    expect(form.yearTo).toBe('');
    expect(form.priceTo).toBe('60000');
    expect(form.providers).toEqual(['otomoto']);
  });

  it('defaults every nullable array field to an empty array, never null', () => {
    const form = filterToFormValue(fixtureFilter());
    expect(form.fuelTypes).toEqual([]);
    expect(form.doorCounts).toEqual([]);
    expect(form.equipment).toEqual([]);
  });

  it('defaults every nullable boolean flag to false, never null', () => {
    const form = filterToFormValue(fixtureFilter());
    expect(form.firstOwner).toBe(false);
    expect(form.hasVin).toBe(false);
  });

  it('is the exact inverse of toFilterPayload for the fields both touch', () => {
    const filter = fixtureFilter({ doorCounts: [3, 5] });
    const form = filterToFormValue(filter);
    const [payload] = toFilterPayload(form);
    expect(payload!.make).toBe(filter.make);
    expect(payload!.priceTo).toBe(filter.priceTo);
    expect(payload!.doorCounts).toEqual(filter.doorCounts);
  });
});
