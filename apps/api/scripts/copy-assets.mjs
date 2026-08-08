import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copies non-TypeScript assets into the build output.
 *
 * `tsc` only emits .js for .ts inputs, so the scraped taxonomy dictionaries in
 * `src/data` would be missing from `dist` and every taxonomy request would 404
 * in production.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await mkdir(path.join(root, 'dist/data'), { recursive: true });
await cp(path.join(root, 'src/data'), path.join(root, 'dist/data'), {
  recursive: true,
});

console.log('Skopiowano src/data -> dist/data');
