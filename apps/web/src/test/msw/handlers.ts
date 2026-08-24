import type { RequestHandler } from 'msw';

/**
 * Empty by default - every test that talks to the network registers its own
 * handlers via `server.use(...)`, scoped to just that test (see
 * `afterEach(() => server.resetHandlers())` in `test/setup.ts`). Keeps a
 * passing test's fixtures from leaking into an unrelated one.
 */
export const handlers: RequestHandler[] = [];
