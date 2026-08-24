import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const HANDOFF_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '.runtime-env.json',
);

/**
 * Starts one disposable Postgres container for the whole integration run,
 * migrates it, and hands the resulting connection string (plus the JWT
 * secrets `config/env.ts` requires) to every test file via a small JSON
 * file - see `test/setup-env.ts`. A real Postgres, not an in-memory
 * substitute: the schema leans on features (pgEnum, jsonb, `percentile_cont`,
 * ICU collation) nothing lighter reproduces faithfully.
 */
export async function setup(): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const databaseUrl = container.getConnectionUri();

  // Migrations need DATABASE_URL to exist before drizzle's own modules
  // import - dynamic imports here, never a top-level one in this file, keep
  // that order correct even though this module itself has no such import.
  process.env.DATABASE_URL = databaseUrl;
  const [{ drizzle }, { migrate }, { default: pg }] = await Promise.all([
    import('drizzle-orm/node-postgres'),
    import('drizzle-orm/node-postgres/migrator'),
    import('pg'),
  ]);

  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../drizzle',
  );
  const pool = new pg.Pool({ connectionString: databaseUrl });
  await migrate(drizzle(pool), { migrationsFolder });
  await pool.end();

  writeFileSync(
    HANDOFF_FILE,
    JSON.stringify({
      DATABASE_URL: databaseUrl,
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'integration-test-access-secret-at-least-32-chars-long',
      JWT_REFRESH_SECRET: 'integration-test-refresh-secret-at-least-32-chars-long',
      CORS_ORIGIN: 'http://localhost:5173',
      APP_URL: 'http://localhost:5180',
      SCHEDULER_ENABLED: 'false',
    }),
  );

  return async () => {
    rmSync(HANDOFF_FILE, { force: true });
    await container.stop();
  };
}
