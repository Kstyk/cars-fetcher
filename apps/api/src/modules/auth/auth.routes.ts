import { Router } from 'express';
import { env, isProduction } from '../../config/env.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { authenticate, currentUserId } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { parseDuration } from './auth.tokens.js';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updateProfileSchema,
} from './auth.schemas.js';
import * as authService from './auth.service.js';

const REFRESH_COOKIE = 'cf_refresh';

export const authRouter = Router();

function setRefreshCookie(res: import('express').Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: parseDuration(env.JWT_REFRESH_TTL),
  });
}

authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    setRefreshCookie(res, result.refreshToken);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    setRefreshCookie(res, result.refreshToken);
    res.json(result);
  }),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    // Cookie first, body as a fallback for non-browser clients.
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (!token) throw new UnauthorizedError('Brak tokenu odświeżania');

    const result = await authService.refresh(token, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });
    setRefreshCookie(res, result.refreshToken);
    res.json(result);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (token) await authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(204).send();
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await authService.getUserById(currentUserId(req)));
  }),
);

authRouter.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    res.json(await authService.updateProfile(currentUserId(req), req.body));
  }),
);

authRouter.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await authService.changePassword(
      currentUserId(req),
      req.body.currentPassword,
      req.body.newPassword,
    );
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(204).send();
  }),
);

authRouter.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await authService.logoutAll(currentUserId(req));
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(204).send();
  }),
);
