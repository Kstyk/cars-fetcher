import { describe, expect, it } from 'vitest';
import { findDuplicateOf } from './duplicates.service.js';
import type { Database } from '../../db/client.js';

interface Row {
  id: string;
  price: number | null;
  mileageKm: number | null;
  city: string | null;
  sellerName: string | null;
  vin: string | null;
}

const BASE_ROW: Row = {
  id: 'row-1',
  price: 50_000,
  mileageKm: 100_000,
  city: 'Warszawa',
  sellerName: 'Jan Kowalski',
  vin: null,
};

const BASE_CANDIDATE = {
  provider: 'olx',
  make: 'Volkswagen',
  model: 'Golf',
  year: 2018,
  price: 50_000,
  mileageKm: 100_000,
  city: 'Warszawa',
  sellerName: 'Jan Kowalski',
  vin: null as string | null,
};

/** Drizzle's `select().from().where().limit()` chain, faked down to what `findDuplicateOf` awaits. */
function fakeTx(rows: Row[]): Pick<Database, 'select'> {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  } as unknown as Pick<Database, 'select'>;
}

/** Throws if `findDuplicateOf` ever queries at all - proves the make/model/year early-exit. */
function unqueryableTx(): Pick<Database, 'select'> {
  return {
    select: () => {
      throw new Error('should not have queried the database');
    },
  } as unknown as Pick<Database, 'select'>;
}

describe('findDuplicateOf', () => {
  it('never queries when the candidate is missing make, model or year', async () => {
    await expect(
      findDuplicateOf(unqueryableTx(), { ...BASE_CANDIDATE, make: null }),
    ).resolves.toBeNull();
    await expect(
      findDuplicateOf(unqueryableTx(), { ...BASE_CANDIDATE, model: null }),
    ).resolves.toBeNull();
    await expect(
      findDuplicateOf(unqueryableTx(), { ...BASE_CANDIDATE, year: null }),
    ).resolves.toBeNull();
  });

  it('matches on price + mileage within tolerance, same city', async () => {
    const tx = fakeTx([BASE_ROW]);
    await expect(findDuplicateOf(tx, BASE_CANDIDATE)).resolves.toBe('row-1');
  });

  it('rejects a field match when the price drifts past the 3% tolerance', async () => {
    const tx = fakeTx([{ ...BASE_ROW, price: 60_000 }]);
    await expect(findDuplicateOf(tx, BASE_CANDIDATE)).resolves.toBeNull();
  });

  it('rejects a field match when cities disagree', async () => {
    // No seller-name overlap either, so this isolates the field-match path -
    // a differing seller alone would otherwise still be rejected there too,
    // masking whether the city check did anything.
    const tx = fakeTx([{ ...BASE_ROW, city: 'Krakow', sellerName: 'Inny Sprzedawca' }]);
    await expect(findDuplicateOf(tx, BASE_CANDIDATE)).resolves.toBeNull();
  });

  it('still matches on a blank city on either side - only a disagreement counts', async () => {
    const tx = fakeTx([{ ...BASE_ROW, city: null }]);
    await expect(findDuplicateOf(tx, { ...BASE_CANDIDATE, city: null })).resolves.toBe('row-1');
  });

  it('falls back to a seller match with a wider tolerance when the field match fails', async () => {
    // 8% price drift fails the 3% field-match tolerance but passes the 10% seller one.
    const tx = fakeTx([{ ...BASE_ROW, price: 54_000, city: 'Krakow' }]);
    await expect(
      findDuplicateOf(tx, { ...BASE_CANDIDATE, sellerName: 'JAN   KOWALSKI' }),
    ).resolves.toBe('row-1');
  });

  it('a VIN mismatch vetoes the match even when the fields line up perfectly', async () => {
    const tx = fakeTx([{ ...BASE_ROW, vin: 'WVWZZZ1JZXW000001' }]);
    await expect(
      findDuplicateOf(tx, { ...BASE_CANDIDATE, vin: 'WVWZZZ1JZXW999999' }),
    ).resolves.toBeNull();
  });

  it('a matching VIN does not itself force a match if the fields disagree', async () => {
    const tx = fakeTx([{ ...BASE_ROW, price: 90_000, mileageKm: 5_000, vin: 'SAME-VIN' }]);
    await expect(
      findDuplicateOf(tx, { ...BASE_CANDIDATE, vin: 'SAME-VIN' }),
    ).resolves.toBeNull();
  });

  it('returns null when nothing in the candidate pool matches', async () => {
    const tx = fakeTx([{ ...BASE_ROW, price: 200_000, mileageKm: 5_000, city: 'Gdansk', sellerName: 'Ktos Inny' }]);
    await expect(findDuplicateOf(tx, BASE_CANDIDATE)).resolves.toBeNull();
  });
});
