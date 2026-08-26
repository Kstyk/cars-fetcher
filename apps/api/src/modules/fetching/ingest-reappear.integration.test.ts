import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { authHeader, getApp, registerUser } from '../../../test/helpers.js';
import { db } from '../../db/client.js';
import { listings } from '../../db/schema.js';
import { deactivateStaleListings, ingestListings } from './ingest.service.js';
import type { NormalizedListing } from '../../providers/types.js';

let app: Express;

beforeAll(async () => {
  app = await getApp();
});

function fixtureItem(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    provider: 'autoplac',
    externalId: `reappear-${Date.now()}`,
    url: 'https://example.com/reappear',
    title: 'Lexus IS III 2.0 200t 245 KM',
    make: 'Lexus',
    model: 'IS',
    price: 89_900,
    currency: 'PLN',
    sellerType: 'dealer',
    raw: {},
    ...overrides,
  };
}

/**
 * Regression coverage for a real bug reported live: a listing that stopped
 * appearing gets `isArchived: true` from `deactivateStaleListings` (an
 * inference from absence, "probably sold"), but a later re-sighting of the
 * exact same (provider, externalId) never used to clear that flag back -
 * the car stayed permanently invisible to the default "for sale" view even
 * while genuinely back on the market and actively receiving price-drop
 * notifications. See the doc comment on the `onConflictDoUpdate` in
 * ingest.service.ts for the full reasoning.
 */
describe('a listing that reappears after being archived becomes visible again', () => {
  it('clears isArchived/archivedAt on re-ingest, and the live feed picks it back up', async () => {
    const user = await registerUser(app);
    const { body: group } = await request(app)
      .post('/api/filter-groups')
      .set(...authHeader(user))
      .send({ name: 'Reappear test' });
    const { body: filter } = await request(app)
      .post(`/api/filter-groups/${group.id}/filters`)
      .set(...authHeader(user))
      .send({ provider: 'autoplac', make: 'Lexus', model: 'IS' });

    const ctx = { filterId: filter.id as string, groupId: group.id as string, userId: user.userId };
    const item = fixtureItem();

    await ingestListings([item], ctx);
    const [created] = await db
      .select()
      .from(listings)
      .where(eq(listings.externalId, item.externalId));
    expect(created).toMatchObject({ isActive: true, isArchived: false });

    // A run that started well after this listing was last seen, with no page
    // of results mentioning it - exactly what deactivateStaleListings acts on.
    const runStartedAt = new Date(Date.now() + 1000);
    const archivedCount = await deactivateStaleListings(ctx.filterId, runStartedAt);
    expect(archivedCount).toBe(1);

    const [archived] = await db
      .select()
      .from(listings)
      .where(eq(listings.externalId, item.externalId));
    expect(archived).toMatchObject({ isActive: false, isArchived: true });
    expect(archived?.archivedAt).not.toBeNull();

    const liveWhileArchived = await request(app)
      .get('/api/listings')
      .set(...authHeader(user))
      .query({ groupId: group.id });
    expect(liveWhileArchived.body.total).toBe(0);

    // The car is relisted (or the earlier crawl simply missed a cycle) -
    // the exact same (provider, externalId) shows up again.
    await ingestListings([item], ctx);

    const [reappeared] = await db
      .select()
      .from(listings)
      .where(eq(listings.externalId, item.externalId));
    expect(reappeared).toMatchObject({ isActive: true, isArchived: false });
    expect(reappeared?.archivedAt).toBeNull();

    const liveAfterReappearing = await request(app)
      .get('/api/listings')
      .set(...authHeader(user))
      .query({ groupId: group.id });
    expect(liveAfterReappearing.body.total).toBe(1);
  });
});
