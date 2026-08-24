import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HANDOFF_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '.runtime-env.json',
);

/**
 * Vitest's `setupFiles` run before the test file that needs them - unlike
 * `globalSetup`, which runs once in a separate process and cannot mutate
 * this worker's `process.env` directly. `config/env.ts` (imported by
 * virtually everything, transitively including `app.js`) parses
 * `process.env` eagerly the moment it is first imported and calls
 * `process.exit(1)` if that parse fails, so these values have to land
 * *before* a test file's own `import`s resolve, not merely before its first
 * `it()` runs. Listing this file under `setupFiles` is what guarantees that
 * ordering.
 */
const runtimeEnv = JSON.parse(readFileSync(HANDOFF_FILE, 'utf8')) as Record<string, string>;

for (const [key, value] of Object.entries(runtimeEnv)) {
  process.env[key] = value;
}
