import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { authHeader, getApp, registerUser } from '../../../test/helpers.js';
import { db } from '../../db/client.js';
import { listingMatches, listings } from '../../db/schema.js';

let app: Express;

beforeAll(async () => {
  app = await getApp();
});

/**
 * Regression coverage for the bug fixed earlier in this project: narrowing a
 * filter's criteria and then running "Wyczyść nieaktualne" (clean-matches)
 * must shrink the *live* listing feed without ever shrinking the
 * *historical* sold-by-model count - see the `removedAt` doc comment on
 * `listingMatches` and `getStats`'s `scoped` vs `scopedEver` split in
 * listings.service.ts. This test reproduces the exact scenario that used to
 * make a genuinely-sold car quietly vanish from "Sprzedaż wg modelu".
 */
describe('stale-match cleanup preserves historical stats', () => {
  it('keeps the sold count and archived total after a filter no longer matches', async () => {
    const user = await registerUser(app);

    const { body: group } = await request(app)
      .post('/api/filter-groups')
      .set(...authHeader(user))
      .send({ name: 'Seat Leon' });

    // Broad on purpose - both fixture listings must match it *before* the
    // narrowing step below.
    const { body: filter } = await request(app)
      .post(`/api/filter-groups/${group.id}/filters`)
      .set(...authHeader(user))
      .send({ provider: 'otomoto', make: 'Seat', model: 'Leon', priceTo: 200_000 });

    const [sold, active] = await db
      .insert(listings)
      .values([
        {
          provider: 'otomoto',
          externalId: `stats-test-sold-${Date.now()}`,
          url: 'https://example.com/sold',
          title: 'Seat Leon 2018, sprzedany',
          make: 'Seat',
          model: 'Leon',
          price: 50_000,
          isActive: false,
          isArchived: true,
          archivedAt: new Date(),
        },
        {
          provider: 'otomoto',
          externalId: `stats-test-active-${Date.now()}`,
          url: 'https://example.com/active',
          title: 'Seat Leon 2019, wciaz na sprzedaz',
          make: 'Seat',
          model: 'Leon',
          price: 150_000, // above the narrowed price ceiling used below
          isActive: true,
          isArchived: false,
        },
      ])
      .returning({ id: listings.id });

    await db.insert(listingMatches).values([
      { listingId: sold!.id, filterId: filter.id, groupId: group.id },
      { listingId: active!.id, filterId: filter.id, groupId: group.id },
    ]);

    const before = await request(app)
      .get('/api/listings/stats')
      .set(...authHeader(user));
    const seatLeonBefore = before.body.soldByModel.find(
      (row: { make: string; model: string }) => row.make === 'Seat' && row.model === 'Leon',
    );
    expect(before.body.archived).toBe(1);
    expect(seatLeonBefore).toMatchObject({ total: 2, sold: 1 });

    const liveBefore = await request(app)
      .get('/api/listings')
      .set(...authHeader(user))
      .query({ groupId: group.id });
    expect(liveBefore.body.total).toBe(1); // the archived one never shows in the live feed

    // Narrow the filter so the still-active listing (150k) no longer
    // qualifies, then run the exact cleanup the "Wyczyść nieaktualne" button
    // triggers.
    await request(app)
      .put(`/api/filter-groups/${group.id}/filters/${filter.id}`)
      .set(...authHeader(user))
      .send({ provider: 'otomoto', make: 'Seat', model: 'Leon', priceTo: 100_000 });

    const cleanup = await request(app)
      .post(`/api/filter-groups/${group.id}/clean-matches`)
      .set(...authHeader(user));
    expect(cleanup.status).toBe(200);
    expect(cleanup.body.removed).toBe(1);

    const after = await request(app)
      .get('/api/listings/stats')
      .set(...authHeader(user));
    const seatLeonAfter = after.body.soldByModel.find(
      (row: { make: string; model: string }) => row.make === 'Seat' && row.model === 'Leon',
    );
    // The historical facts must be unchanged...
    expect(after.body.archived).toBe(1);
    expect(seatLeonAfter).toMatchObject({ total: 2, sold: 1 });

    // ...while the live feed genuinely lost the now-stale match.
    const liveAfter = await request(app)
      .get('/api/listings')
      .set(...authHeader(user))
      .query({ groupId: group.id });
    expect(liveAfter.body.total).toBe(0);

    // And the cleanup really did soft-delete, not hard-delete, the match row.
    const [activeMatchRow] = await db
      .select({ removedAt: listingMatches.removedAt })
      .from(listingMatches)
      .where(
        and(eq(listingMatches.listingId, active!.id), eq(listingMatches.filterId, filter.id)),
      );
    expect(activeMatchRow?.removedAt).not.toBeNull();

    const [soldMatchRow] = await db
      .select({ removedAt: listingMatches.removedAt })
      .from(listingMatches)
      .where(
        and(
          eq(listingMatches.listingId, sold!.id),
          eq(listingMatches.filterId, filter.id),
          isNull(listingMatches.removedAt),
        ),
      );
    // The sold listing still matches the narrowed filter (50k <= 100k), so
    // its match must have been left alone.
    expect(soldMatchRow).toBeDefined();
  });
});
