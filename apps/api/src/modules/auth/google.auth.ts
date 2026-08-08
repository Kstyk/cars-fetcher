import { env } from '../../config/env.js';
import { UpstreamError } from '../../lib/errors.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleProfile {
  /** Google's stable per-account id ("sub" claim) - what we key `users.googleId` on. */
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}

/**
 * The URI Google redirects back to after consent. Must match, character for
 * character, an "Authorised redirect URI" configured in the Google Cloud
 * Console - hence computed once from APP_URL rather than left to drift.
 */
export function googleRedirectUri(): string {
  return `${env.APP_URL}/api/auth/google/callback`;
}

/** Where the browser is sent to start the consent flow. */
export function buildGoogleAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID ?? '');
  url.searchParams.set('redirect_uri', googleRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  // No refresh token needed - we only ever use this for a one-off identity
  // check at login, not for calling Google APIs later.
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/**
 * Exchanges the authorization code for tokens, then calls the userinfo
 * endpoint to get profile fields. Two round-trips instead of verifying the
 * id_token's JWT signature locally - simpler, and no JWKS-fetching/caching
 * code to maintain for a login flow that runs once per session.
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!tokenResponse.ok) {
    throw new UpstreamError(
      `Google OAuth2 odrzuciło kod (${tokenResponse.status})`,
      await safeJson(tokenResponse),
    );
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) {
    throw new UpstreamError('Odpowiedź Google nie zawiera access_token');
  }

  const userResponse = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!userResponse.ok) {
    throw new UpstreamError(`Google userinfo zwróciło ${userResponse.status}`);
  }

  const profile = (await userResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    name?: string;
  };

  if (!profile.sub || !profile.email) {
    throw new UpstreamError('Odpowiedź Google nie zawiera wymaganych pól profilu');
  }

  const [nameFirst, ...nameRest] = (profile.name ?? profile.email.split('@')[0] ?? 'Użytkownik')
    .trim()
    .split(/\s+/);

  return {
    id: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: profile.email_verified ?? false,
    firstName: profile.given_name?.trim() || nameFirst || 'Użytkownik',
    lastName: profile.family_name?.trim() || nameRest.join(' ') || '-',
  };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
