import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { authHeader, getApp, registerUser } from '../../../test/helpers.js';

let app: Express;

beforeAll(async () => {
  app = await getApp();
});

describe('filter groups CRUD', () => {
  it('creates a group with an inline filter, then reads it back', async () => {
    const user = await registerUser(app);

    const create = await request(app)
      .post('/api/filter-groups')
      .set(...authHeader(user))
      .send({
        name: 'Kompakty do 50k',
        filters: [{ provider: 'otomoto', make: 'Volkswagen', model: 'Golf', priceTo: 50_000 }],
      });
    expect(create.status).toBe(201);
    expect(create.body.name).toBe('Kompakty do 50k');
    expect(create.body.filters).toHaveLength(1);
    expect(create.body.filters[0]).toMatchObject({ make: 'Volkswagen', model: 'Golf' });

    const groupId = create.body.id as string;
    const read = await request(app)
      .get(`/api/filter-groups/${groupId}`)
      .set(...authHeader(user));
    expect(read.status).toBe(200);
    expect(read.body.id).toBe(groupId);
    expect(read.body.filters).toHaveLength(1);
  });

  it('rejects a group name that is too short', async () => {
    const user = await registerUser(app);
    const res = await request(app)
      .post('/api/filter-groups')
      .set(...authHeader(user))
      .send({ name: 'x' });
    expect(res.status).toBe(400);
  });

  it('adds, updates and deletes a filter within an existing group', async () => {
    const user = await registerUser(app);
    const { body: group } = await request(app)
      .post('/api/filter-groups')
      .set(...authHeader(user))
      .send({ name: 'Grupa testowa' });

    const added = await request(app)
      .post(`/api/filter-groups/${group.id}/filters`)
      .set(...authHeader(user))
      .send({ provider: 'olx', make: 'Toyota', model: 'Corolla' });
    expect(added.status).toBe(201);
    const filterId = added.body.id as string;

    const updated = await request(app)
      .put(`/api/filter-groups/${group.id}/filters/${filterId}`)
      .set(...authHeader(user))
      .send({ provider: 'olx', make: 'Toyota', model: 'Corolla', priceTo: 70_000 });
    expect(updated.status).toBe(200);
    expect(updated.body.priceTo).toBe(70_000);

    const deleted = await request(app)
      .delete(`/api/filter-groups/${group.id}/filters/${filterId}`)
      .set(...authHeader(user));
    expect(deleted.status).toBe(204);

    const afterDelete = await request(app)
      .get(`/api/filter-groups/${group.id}`)
      .set(...authHeader(user));
    expect(afterDelete.body.filters).toHaveLength(0);
  });

  it('rejects an out-of-order price range (priceFrom > priceTo)', async () => {
    const user = await registerUser(app);
    const { body: group } = await request(app)
      .post('/api/filter-groups')
      .set(...authHeader(user))
      .send({ name: 'Zakres cenowy' });

    const res = await request(app)
      .post(`/api/filter-groups/${group.id}/filters`)
      .set(...authHeader(user))
      .send({ provider: 'otomoto', priceFrom: 100_000, priceTo: 50_000 });
    expect(res.status).toBe(400);
  });

  it('deletes a group', async () => {
    const user = await registerUser(app);
    const { body: group } = await request(app)
      .post('/api/filter-groups')
      .set(...authHeader(user))
      .send({ name: 'Do usuniecia' });

    const del = await request(app)
      .delete(`/api/filter-groups/${group.id}`)
      .set(...authHeader(user));
    expect(del.status).toBe(204);

    const after = await request(app)
      .get(`/api/filter-groups/${group.id}`)
      .set(...authHeader(user));
    expect(after.status).toBe(404);
  });
});

describe('multi-tenant isolation', () => {
  it('never shows one user a group belonging to another', async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);

    const { body: group } = await request(app)
      .post('/api/filter-groups')
      .set(...authHeader(owner))
      .send({ name: 'Prywatna grupa' });

    const listAsStranger = await request(app)
      .get('/api/filter-groups')
      .set(...authHeader(stranger));
    expect(listAsStranger.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: group.id })]),
    );

    const readAsStranger = await request(app)
      .get(`/api/filter-groups/${group.id}`)
      .set(...authHeader(stranger));
    expect(readAsStranger.status).toBe(404);

    const deleteAsStranger = await request(app)
      .delete(`/api/filter-groups/${group.id}`)
      .set(...authHeader(stranger));
    expect(deleteAsStranger.status).toBe(404);

    // The group must have survived the stranger's delete attempt.
    const readAsOwner = await request(app)
      .get(`/api/filter-groups/${group.id}`)
      .set(...authHeader(owner));
    expect(readAsOwner.status).toBe(200);
  });
});
