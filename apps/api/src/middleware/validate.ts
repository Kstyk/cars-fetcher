import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { BadRequestError } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Parses one request part and writes the coerced result back, so handlers see
 * numbers/booleans rather than the raw strings Express hands over.
 */
export function validate<T extends ZodTypeAny>(schema: T, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]) as z.infer<T>;
      if (source === 'query') {
        // req.query is a getter-only property in Express 5.
        Object.defineProperty(req, 'query', {
          value: parsed,
          writable: true,
          configurable: true,
        });
      } else {
        req[source] = parsed as never;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new BadRequestError(
            'Dane wejściowe są nieprawidłowe',
            err.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          ),
        );
        return;
      }
      next(err);
    }
  };
}
