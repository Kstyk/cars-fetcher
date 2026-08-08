import bcrypt from 'bcryptjs';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { logger } from '../../config/logger.js';
import { db } from '../../db/client.js';
import {
  notificationPreferences,
  refreshTokens,
  users,
  type User,
} from '../../db/schema.js';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../lib/errors.js';
import { sendVerificationEmail } from '../notifications/email.service.js';
import type { GoogleProfile } from './google.auth.js';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  parseDuration,
  refreshTokenExpiry,
  signAccessToken,
} from './auth.tokens.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL = '24h';
/** A resend before this much time has passed is a no-op, not a new e-mail. */
const RESEND_COOLDOWN_MS = 60_000;

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  emailVerifiedAt: Date | null;
  /** Lets the UI hide password-change for Google-only accounts. */
  hasPassword: boolean;
  createdAt: Date;
}

export interface SessionContext {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    hasPassword: user.passwordHash !== null,
    createdAt: user.createdAt,
  };
}

export async function register(
  input: RegisterInput,
  ctx: SessionContext = {},
): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existing) {
    throw new ConflictError('Konto z tym adresem e-mail już istnieje');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
      })
      .returning();

    if (!created) throw new Error('Nie udało się utworzyć użytkownika');

    // Every account starts with a usable notification profile.
    await tx.insert(notificationPreferences).values({ userId: created.id });
    return created;
  });

  // Best-effort: a dead SMTP server must not fail registration. The user can
  // always hit "resend" once mail delivery is sorted out.
  await sendVerificationLink(user).catch((err) => {
    logger.warn({ err, userId: user.id }, 'Nie udało się wysłać e-maila weryfikacyjnego');
  });

  return issueSession(user, ctx);
}

export async function login(
  input: LoginInput,
  ctx: SessionContext = {},
): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  // Compare against a dummy hash when the user is missing, or has none (a
  // Google-only account), so the response time reveals neither.
  const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const passwordMatches = await bcrypt.compare(input.password, hash);

  if (!user || !passwordMatches) {
    throw new UnauthorizedError('Nieprawidłowy e-mail lub hasło');
  }
  if (!user.isActive) {
    throw new UnauthorizedError('Konto zostało zablokowane');
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return issueSession(user, ctx);
}

/**
 * Rotates a refresh token: the presented one is revoked and linked to its
 * replacement, so reusing a rotated token is detectable.
 */
export async function refresh(
  token: string,
  ctx: SessionContext = {},
): Promise<AuthResult> {
  const tokenHash = hashOpaqueToken(token);

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
    .limit(1);

  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Sesja wygasła, zaloguj się ponownie');
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, stored.userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Konto jest niedostępne');
  }

  const rotated = generateOpaqueToken();
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(refreshTokens)
      .values({
        userId: user.id,
        tokenHash: rotated.tokenHash,
        expiresAt: refreshTokenExpiry(),
        userAgent: ctx.userAgent ?? null,
        ipAddress: ctx.ipAddress ?? null,
      })
      .returning({ id: refreshTokens.id });

    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedByTokenId: inserted?.id ?? null })
      .where(eq(refreshTokens.id, stored.id));
  });

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    }),
    refreshToken: rotated.token,
  };
}

export async function logout(token: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.tokenHash, hashOpaqueToken(token)),
        isNull(refreshTokens.revokedAt),
      ),
    );
}

export async function logoutAll(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

export async function getUserById(userId: string): Promise<PublicUser> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError('Użytkownik nie istnieje');
  return toPublicUser(user);
}

export async function updateProfile(
  userId: string,
  patch: { firstName?: string; lastName?: string },
): Promise<PublicUser> {
  const [updated] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) throw new NotFoundError('Użytkownik nie istnieje');
  return toPublicUser(updated);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError('Użytkownik nie istnieje');

  if (!user.passwordHash) {
    throw new UnauthorizedError(
      'To konto zostało założone przez logowanie Google i nie ma hasła',
    );
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new UnauthorizedError('Obecne hasło jest nieprawidłowe');
  }

  await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // A password change invalidates every other device.
  await logoutAll(userId);
}

/**
 * Finds or creates a user for a verified Google identity.
 *
 * Three cases:
 *  - `googleId` already on file -> that account, unchanged.
 *  - No `googleId` match, but the e-mail exists (a password account) -> the
 *    Google identity is linked to it. Google already verified the address,
 *    so `emailVerifiedAt` is stamped if it was not already.
 *  - Neither matches -> a brand new account, password-less, pre-verified.
 */
export async function loginWithGoogle(
  profile: GoogleProfile,
  ctx: SessionContext = {},
): Promise<AuthResult> {
  const [byGoogleId] = await db
    .select()
    .from(users)
    .where(eq(users.googleId, profile.id))
    .limit(1);

  if (byGoogleId) {
    if (!byGoogleId.isActive) throw new UnauthorizedError('Konto zostało zablokowane');
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, byGoogleId.id));
    return issueSession(byGoogleId, ctx);
  }

  const [byEmail] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${profile.email}`)
    .limit(1);

  if (byEmail) {
    if (!byEmail.isActive) throw new UnauthorizedError('Konto zostało zablokowane');

    const [linked] = await db
      .update(users)
      .set({
        googleId: profile.id,
        emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, byEmail.id))
      .returning();

    return issueSession(linked ?? byEmail, ctx);
  }

  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: profile.email,
        passwordHash: null,
        firstName: profile.firstName,
        lastName: profile.lastName,
        googleId: profile.id,
        // Google already confirmed the address; no reason to ask again.
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      })
      .returning();

    if (!user) throw new Error('Nie udało się utworzyć użytkownika');
    await tx.insert(notificationPreferences).values({ userId: user.id });
    return user;
  });

  return issueSession(created, ctx);
}

/* ----------------------------- e-mail verification ----------------------------- */

async function sendVerificationLink(user: User): Promise<void> {
  const { token, tokenHash } = generateOpaqueToken();

  await db
    .update(users)
    .set({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: new Date(Date.now() + parseDuration(EMAIL_VERIFICATION_TTL)),
      emailVerificationSentAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await sendVerificationEmail(user.email, token);
}

export async function verifyEmail(token: string): Promise<PublicUser> {
  const tokenHash = hashOpaqueToken(token);

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.emailVerificationTokenHash, tokenHash),
        gt(users.emailVerificationExpiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!user) {
    throw new UnauthorizedError('Link weryfikacyjny jest nieprawidłowy lub wygasł');
  }

  const [updated] = await db
    .update(users)
    .set({
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    })
    .where(eq(users.id, user.id))
    .returning();

  return toPublicUser(updated ?? user);
}

export async function resendVerification(userId: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError('Użytkownik nie istnieje');
  if (user.emailVerifiedAt) return; // Already verified - nothing to resend.

  if (
    user.emailVerificationSentAt &&
    Date.now() - user.emailVerificationSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new ConflictError('Odczekaj chwilę przed ponownym wysłaniem');
  }

  await sendVerificationLink(user);
}

async function issueSession(user: User, ctx: SessionContext): Promise<AuthResult> {
  const { token, tokenHash } = generateOpaqueToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: refreshTokenExpiry(),
    userAgent: ctx.userAgent ?? null,
    ipAddress: ctx.ipAddress ?? null,
  });

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    }),
    refreshToken: token,
  };
}
