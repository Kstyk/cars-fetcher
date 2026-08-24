import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { authHeader, getApp, registerUser } from '../../../test/helpers.js';

let app: Express;

beforeAll(async () => {
  app = await getApp();
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns an access token + refresh cookie', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `register-${Date.now()}@example.com`,
      password: 'TestoweHaslo1',
      firstName: 'Nowy',
      lastName: 'Uzytkownik',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ firstName: 'Nowy', lastName: 'Uzytkownik' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']?.[0]).toMatch(/cf_refresh=/);
  });

  it('rejects a second registration with the same e-mail', async () => {
    const email = `duplicate-${Date.now()}@example.com`;
    const payload = { email, password: 'TestoweHaslo1', firstName: 'Ala', lastName: 'Bela' };

    const first = await request(app).post('/api/auth/register').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/auth/register').send(payload);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('conflict');
  });

  it('rejects a password without the required character classes', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `weak-${Date.now()}@example.com`,
      password: 'alllowercase',
      firstName: 'Ala',
      lastName: 'Bela',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right password and rejects the wrong one', async () => {
    const user = await registerUser(app);

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));

    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'NotTheRightOne1' });
    expect(wrong.status).toBe(401);
  });

  it('rejects a login for an e-mail that was never registered', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody-here@example.com', password: 'TestoweHaslo1' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the caller profile with a valid access token', async () => {
    const user = await registerUser(app);
    const res = await request(app).get('/api/auth/me').set(...authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage access token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues a new access token from the refresh cookie', async () => {
    const email = `refresh-${Date.now()}@example.com`;
    const registerRes = await request(app).post('/api/auth/register').send({
      email,
      password: 'TestoweHaslo1',
      firstName: 'Ala',
      lastName: 'Bela',
    });
    const cookie = registerRes.headers['set-cookie'];
    if (!cookie) throw new Error('register did not set a refresh cookie');

    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie).send({});
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    // Refresh tokens rotate on every use - a new one-time cookie, not the same string.
    expect(refreshRes.headers['set-cookie']?.[0]).not.toBe(cookie[0]);

    // The freshly-issued access token actually works, not just "is a string".
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${refreshRes.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);
  });

  it('rejects a refresh with no cookie and no body token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(401);
  });
});
