import pino from 'pino';
import { env, isProduction } from './env.js';

export const logger = pino({
  // Integration tests drive the real app through supertest, one request log
  // per assertion - silent keeps `vitest run` output readable while still
  // leaving `debug` for actual local dev.
  level: isProduction ? 'info' : env.NODE_ENV === 'test' ? 'silent' : 'debug',
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
  base: { env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      '*.passwordHash',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
});
