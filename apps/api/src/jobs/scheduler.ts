import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { runDueGroups } from '../modules/fetching/fetcher.service.js';

let task: ScheduledTask | null = null;
let running = false;

/**
 * Periodically refreshes every filter group whose interval has elapsed.
 * Overlapping ticks are skipped rather than queued - a slow run must not pile
 * up behind the next cron fire.
 */
export function startScheduler(): void {
  if (!env.SCHEDULER_ENABLED) {
    logger.info('Scheduler disabled (SCHEDULER_ENABLED=false)');
    return;
  }

  if (!cron.validate(env.SCHEDULER_CRON)) {
    logger.error({ cron: env.SCHEDULER_CRON }, 'Invalid SCHEDULER_CRON, scheduler not started');
    return;
  }

  task = cron.schedule(
    env.SCHEDULER_CRON,
    async () => {
      if (running) {
        logger.warn('Previous scheduler tick still running, skipping this one');
        return;
      }
      running = true;
      const startedAt = Date.now();
      try {
        const results = await runDueGroups();
        logger.info(
          {
            groups: results.length,
            newListings: results.reduce((sum, r) => sum + r.totalNew, 0),
            durationMs: Date.now() - startedAt,
          },
          'Scheduler tick finished',
        );
      } catch (err) {
        logger.error({ err }, 'Scheduler tick failed');
      } finally {
        running = false;
      }
    },
    { timezone: 'Europe/Warsaw' },
  );

  logger.info({ cron: env.SCHEDULER_CRON }, 'Scheduler started');
}

export function stopScheduler(): void {
  void task?.stop();
  task = null;
}
