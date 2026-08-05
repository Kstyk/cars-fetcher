import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';
import { AppError, NotFoundError } from '../lib/errors.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new NotFoundError(`Nie znaleziono trasy ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Dane wejściowe są nieprawidłowe',
        details: err.issues,
      },
    });
    return;
  }

  // Postgres unique violation that slipped past an explicit check.
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const pgCode = (err as { code?: string }).code;
    if (pgCode === '23505') {
      res.status(409).json({
        error: { code: 'conflict', message: 'Zasób już istnieje' },
      });
      return;
    }
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Wystąpił nieoczekiwany błąd serwera',
      ...(isProduction ? {} : { details: String(err) }),
    },
  });
}
