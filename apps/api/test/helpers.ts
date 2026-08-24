import type { Express } from 'express';
import request from 'supertest';

let appInstance: Express | undefined;

/**
 * Lazily imports the real Express app. Must stay a dynamic import: this
 * module can itself be imported before `setup-env.ts` has populated
 * `process.env`, and `app.js`'s import chain reaches `config/env.ts`'s
 * eager, crash-on-failure parse.
 */
export async function getApp(): Promise<Express> {
  if (!appInstance) {
    const { createApp } = await import('../src/app.js');
    appInstance = createApp();
  }
  return appInstance;
}

export interface TestUser {
  email: string;
  password: string;
  userId: string;
  accessToken: string;
}

let counter = 0;

/** Registers a brand-new user through the real HTTP API - no direct DB writes. */
export async function registerUser(
  app: Express,
  overrides: Partial<{ email: string; password: string; firstName: string; lastName: string }> = {},
): Promise<TestUser> {
  counter += 1;
  const email = overrides.email ?? `test-user-${Date.now()}-${counter}@example.com`;
  const password = overrides.password ?? 'TestoweHaslo1';

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
    });

  if (res.status !== 201) {
    throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    email,
    password,
    userId: res.body.user.id as string,
    accessToken: res.body.accessToken as string,
  };
}

/** `Authorization` header ready to spread into a supertest `.set(...)` call. */
export function authHeader(user: TestUser): [string, string] {
  return ['Authorization', `Bearer ${user.accessToken}`];
}
