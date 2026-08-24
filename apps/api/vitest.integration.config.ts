import { defineConfig } from 'vitest/config';

/**
 * Integration tests - a real Express app on a real, disposable PostgreSQL
 * container (via testcontainers), driven through supertest exactly like a
 * real HTTP client would. `globalSetup` starts the container once per run
 * and applies every Drizzle migration to it; `setupFiles` feeds the
 * resulting connection string (and JWT secrets) into `process.env` for each
 * test file, *before* that file's own imports resolve - see the doc comment
 * in `test/setup-env.ts` for why the ordering matters.
 *
 * Sequential on purpose: every test file shares the one container, and
 * running them in parallel workers would let one file's fixtures leak into
 * another's assertions.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
