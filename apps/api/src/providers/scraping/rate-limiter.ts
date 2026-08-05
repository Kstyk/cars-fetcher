/**
 * Serialises requests per host and keeps a minimum gap between them.
 *
 * Politeness is the whole point: a scraper that fires in parallel gets the IP
 * blocked and takes the feature down with it. Every adapter shares this, so
 * adding autoplac.pl or OLX cannot accidentally bypass the throttle.
 */
export class HostRateLimiter {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly lastRequestAt = new Map<string, number>();

  constructor(private readonly minDelayMs: number) {}

  /** Runs `task` after the host's cooldown elapses; calls never overlap. */
  async schedule<T>(host: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(host) ?? Promise.resolve();

    const run = previous.then(async () => {
      const last = this.lastRequestAt.get(host) ?? 0;
      const waitMs = this.minDelayMs - (Date.now() - last);
      if (waitMs > 0) await sleep(waitMs);

      try {
        return await task();
      } finally {
        this.lastRequestAt.set(host, Date.now());
      }
    });

    // Keep the chain alive even when a task rejects, or the host would deadlock.
    this.queues.set(
      host,
      run.catch(() => undefined),
    );

    return run;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
