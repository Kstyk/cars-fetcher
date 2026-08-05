import bcrypt from 'bcryptjs';
import { and, eq, isNull, sql } from 'drizzle-orm';
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
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from './auth.tokens.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const BCRYPT_ROUNDS = 12;

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

  // Compare against a dummy hash when the user is missing so the response time
  // does not reveal whether the address is registered.
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
  const tokenHash = hashRefreshToken(token);

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

  const rotated = generateRefreshToken();
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
        eq(refreshTokens.tokenHash, hashRefreshToken(token)),
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

async function issueSession(user: User, ctx: SessionContext): Promise<AuthResult> {
  const { token, tokenHash } = generateRefreshToken();

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
