import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { db } from '../../db/client.js';
import { providerTokens } from '../../db/schema.js';
import { UpstreamError } from '../../lib/errors.js';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

/** Renew this many ms before the real expiry so in-flight calls do not 401. */
const EXPIRY_SKEW_MS = 60_000;

/**
 * OAuth2 client for the OTOMOTO Open API.
 *
 * Documented flow (https://www.otomoto.pl/api/doc/#api-Oauth2-PostToken):
 *   POST {base}/oauth/token
 *   Authorization: Basic base64(client_id:client_secret)
 *   grant_type=password&username=...&password=...
 * and grant_type=refresh_token to renew.
 *
 * Tokens are cached in `provider_tokens` so a restart does not re-authenticate,
 * and concurrent callers share a single in-flight request.
 */
export class OtomotoAuthClient {
  private inFlight: Promise<string> | null = null;

  constructor(
    private readonly baseUrl: string = env.OTOMOTO_BASE_URL,
    private readonly clientId = env.OTOMOTO_CLIENT_ID,
    private readonly clientSecret = env.OTOMOTO_CLIENT_SECRET,
    private readonly username = env.OTOMOTO_USERNAME,
    private readonly password = env.OTOMOTO_PASSWORD,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.clientId && this.clientSecret && this.username && this.password,
    );
  }

  async getAccessToken(): Promise<string> {
    this.inFlight ??= this.resolveToken().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async resolveToken(): Promise<string> {
    const [cached] = await db
      .select()
      .from(providerTokens)
      .where(eq(providerTokens.provider, 'otomoto'))
      .limit(1);

    if (cached && cached.expiresAt.getTime() - EXPIRY_SKEW_MS > Date.now()) {
      return cached.accessToken;
    }

    if (cached?.refreshToken) {
      try {
        return await this.exchange({
          grant_type: 'refresh_token',
          refresh_token: cached.refreshToken,
        });
      } catch (err) {
        logger.warn({ err }, 'Otomoto refresh_token grant failed, falling back to password grant');
      }
    }

    return this.exchange({
      grant_type: 'password',
      username: this.username ?? '',
      password: this.password ?? '',
    });
  }

  private async exchange(params: Record<string, string>): Promise<string> {
    if (!this.isConfigured()) {
      throw new UpstreamError('Brak konfiguracji poświadczeń Otomoto');
    }

    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.clientId ?? '',
        client_secret: this.clientSecret ?? '',
        ...params,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new UpstreamError(
        `Otomoto OAuth2 zwróciło ${response.status}`,
        safeJson(text),
      );
    }

    const payload = safeJson(text) as TokenResponse | undefined;
    if (!payload?.access_token) {
      throw new UpstreamError('Odpowiedź OAuth2 Otomoto nie zawiera access_token');
    }

    const expiresAt = new Date(
      Date.now() + (payload.expires_in ?? 3600) * 1000,
    );

    await db
      .insert(providerTokens)
      .values({
        provider: 'otomoto',
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token ?? null,
        tokenType: payload.token_type ?? 'Bearer',
        scope: payload.scope ?? null,
        expiresAt,
        obtainedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: providerTokens.provider,
        set: {
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token ?? null,
          tokenType: payload.token_type ?? 'Bearer',
          scope: payload.scope ?? null,
          expiresAt,
          obtainedAt: new Date(),
        },
      });

    logger.info({ expiresAt }, 'Otomoto access token refreshed');
    return payload.access_token;
  }

  /** Drops the cached token so the next call re-authenticates from scratch. */
  async invalidate(): Promise<void> {
    await db.delete(providerTokens).where(eq(providerTokens.provider, 'otomoto'));
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export const otomotoAuth = new OtomotoAuthClient();
