import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: 'cars-fetcher',
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: 'cars-fetcher',
  }) as AccessTokenPayload;
}

/**
 * Refresh tokens are opaque random strings - only their SHA-256 digest reaches
 * the database, so a dump of `refresh_tokens` cannot be replayed.
 */
export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Turns "30d" / "15m" / "3600" into a concrete expiry timestamp. */
export function refreshTokenExpiry(now = new Date()): Date {
  return new Date(now.getTime() + parseDuration(env.JWT_REFRESH_TTL));
}

export function parseDuration(input: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d|w)?$/i.exec(input.trim());
  if (!match) throw new Error(`Nieprawidłowy format czasu: ${input}`);
  const value = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  return value * (multipliers[unit] ?? 1_000);
}
