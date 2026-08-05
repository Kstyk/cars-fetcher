import { UpstreamError } from '../../lib/errors.js';

/**
 * Helpers for sites built on Next.js - Otomoto, OLX and autoplac.pl all embed
 * their listing payload in the page, so no headless browser is needed.
 *
 * Two shapes show up in practice:
 *   1. `__NEXT_DATA__` - the classic pages-router blob.
 *   2. `self.__next_f.push([...])` - the app-router streaming format.
 */

const NEXT_DATA_RE =
  /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

export function extractNextData(html: string): unknown {
  const match = NEXT_DATA_RE.exec(html);
  if (!match?.[1]) {
    throw new UpstreamError(
      'Nie znaleziono __NEXT_DATA__ - struktura strony prawdopodobnie się zmieniła',
    );
  }

  try {
    return JSON.parse(match[1]);
  } catch (err) {
    throw new UpstreamError('__NEXT_DATA__ nie jest poprawnym JSON-em', {
      cause: String(err),
    });
  }
}

/**
 * Walks an arbitrary object tree and returns the first value for which
 * `predicate` holds. GraphQL caches (urql/Apollo) bury the payload under
 * generated numeric keys, so a structural search beats a hard-coded path -
 * it survives cache-key changes between deploys.
 */
export function deepFind<T>(
  root: unknown,
  predicate: (value: unknown) => value is T,
  maxDepth = 12,
): T | null {
  const seen = new Set<unknown>();

  function walk(node: unknown, depth: number): T | null {
    if (depth > maxDepth || node === null || typeof node !== 'object') return null;
    if (seen.has(node)) return null;
    seen.add(node);

    if (predicate(node)) return node;

    for (const value of Object.values(node as Record<string, unknown>)) {
      const found = walk(value, depth + 1);
      if (found) return found;
    }
    return null;
  }

  return walk(root, 0);
}

/**
 * Finds a GraphQL result nested inside a cache entry whose `data` field is a
 * JSON *string* rather than an object - the shape urql uses.
 */
export function findEncodedGraphqlPayload<T>(
  root: unknown,
  rootField: string,
): T | null {
  let result: T | null = null;
  const seen = new Set<unknown>();

  function walk(node: unknown, depth: number): void {
    if (result || depth > 12 || node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);

    const record = node as Record<string, unknown>;
    if (typeof record.data === 'string' && record.data.includes(`"${rootField}"`)) {
      try {
        const parsed = JSON.parse(record.data) as Record<string, unknown>;
        if (parsed[rootField]) {
          result = parsed[rootField] as T;
          return;
        }
      } catch {
        // Not the entry we are after; keep walking.
      }
    }

    for (const value of Object.values(record)) walk(value, depth + 1);
  }

  walk(root, 0);
  return result;
}

/** Lowercase, de-accented, dash-joined - the slug form these sites expect. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
