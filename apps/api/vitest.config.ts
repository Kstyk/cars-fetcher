import { defineConfig } from 'vitest/config';

/**
 * Unit tests only - pure logic, no real database. `config/env.ts` runs a
 * zod parse eagerly on import (and `process.exit(1)`s on failure), so
 * anything that transitively imports it - which is most of this codebase -
 * still needs *some* valid-looking env to import cleanly, even though these
 * tests never actually open the connection. Integration tests use a real,
 * disposable Postgres instead - see `vitest.integration.config.ts`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'node_modules/**', 'dist/**'],
    env: {
      DATABASE_URL: 'postgresql://unit:test@localhost:5432/unit_test_unused',
      JWT_ACCESS_SECRET: 'unit-test-access-secret-at-least-32-characters-long',
      JWT_REFRESH_SECRET: 'unit-test-refresh-secret-at-least-32-characters-long',
    },
  },
});
