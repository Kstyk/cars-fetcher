import { chromium, type Browser, type BrowserContext } from 'playwright';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * A real, persistent headless Chromium instance - the escape hatch for hosts
 * whose WAF passes a genuine browser TLS/HTTP2 fingerprint while blocking
 * every non-browser client (Node `fetch`, curl) with an identical
 * User-Agent. OLX's CloudFront in particular: 403 on `fetch`, 200 through a
 * real page navigation, headers being otherwise byte-for-byte the same.
 *
 * One browser/context for the whole process - launching Chromium costs
 * ~1s, too slow to pay per request. Pages are opened and closed per call.
 */
let browserPromise: Promise<Browser> | null = null;
let contextPromise: Promise<BrowserContext> | null = null;

async function getContext(): Promise<BrowserContext> {
  browserPromise ??= chromium
    .launch({
      headless: true,
      // No Docker seccomp/userns setup for the sandbox here - standard
      // trade-off for containerised headless Chrome.
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    .then((browser) => {
      logger.info('Playwright: Chromium uruchomiony');
      browser.on('disconnected', () => {
        logger.warn('Playwright: Chromium zakończył działanie nieoczekiwanie');
        browserPromise = null;
        contextPromise = null;
      });
      return browser;
    });

  const browser = await browserPromise;
  contextPromise ??= browser.newContext({
    userAgent: env.SCRAPER_USER_AGENT,
    locale: 'pl-PL',
  });
  return contextPromise;
}

export interface BrowserFetchResult {
  status: number;
  text: string;
  headers: Record<string, string>;
}

export async function fetchViaBrowser(
  url: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<BrowserFetchResult> {
  options.signal?.throwIfAborted();

  const context = await getContext();
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs ?? 30_000,
    });
    if (!response) {
      throw new Error('Nawigacja nie zwróciła odpowiedzi (przerwana?)');
    }
    // JSON API responses render as plain text in Chrome's body - same as a
    // human opening the URL directly. `locator().innerText()` runs in-page
    // without an in-browser callback, so this file needs no DOM lib.
    const text = await page.locator('body').innerText();
    return { status: response.status(), text, headers: await response.headers() };
  } finally {
    await page.close().catch(() => {});
  }
}

/** Called on process shutdown so Chromium does not linger as a zombie. */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  contextPromise = null;
  await browser.close().catch(() => {});
}
