import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import { logger } from '../config/logger.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

try {
  logger.info({ migrationsFolder }, 'Running migrations');
  await migrate(db, { migrationsFolder });
  logger.info('Migrations applied');
  await pool.end();
  process.exit(0);
} catch (err) {
  logger.error({ err }, 'Migration failed');
  await pool.end();
  process.exit(1);
}
