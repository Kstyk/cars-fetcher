import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool } from './db/client.js';
import { startScheduler, stopScheduler } from './jobs/scheduler.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
  startScheduler();
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down');
  stopScheduler();

  server.close(async () => {
    await pool.end();
    process.exit(0);
  });

  // Do not hang forever on lingering keep-alive connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
