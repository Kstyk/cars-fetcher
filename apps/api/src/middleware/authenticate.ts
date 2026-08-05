import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import {
  verifyAccessToken,
  type AccessTokenPayload,
} from '../modules/auth/auth.tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Brak tokenu dostępu'));
    return;
  }

  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(new UnauthorizedError('Token wygasł lub jest nieprawidłowy'));
  }
}

export function requireRole(...roles: Array<'user' | 'admin'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

/** Narrowing helper - routes behind `authenticate` always have a user. */
export function currentUserId(req: Request): string {
  if (!req.user) throw new UnauthorizedError();
  return req.user.sub;
}

/**
 * Express 5 types path params as `string | string[]`. Every route here runs a
 * zod `params` schema first, so this only narrows the type.
 */
export function pathParam(req: Request, name: string): string {
  const value = req.params[name as keyof typeof req.params];
  if (typeof value !== 'string') {
    throw new UnauthorizedError(`Brak parametru ścieżki: ${name}`);
  }
  return value;
}
