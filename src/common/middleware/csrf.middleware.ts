import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const csrfBypassPaths = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/send-verification-code',
  '/auth/refresh',
]);

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const csrfProtectionMiddleware = (request: Request, response: Response, next: NextFunction): void => {
  if (!unsafeMethods.has(request.method)) {
    next();
    return;
  }

  if (csrfBypassPaths.has(request.path)) {
    next();
    return;
  }

  const cookieToken = request.cookies?.csrf_token as string | undefined;
  const headerTokenRaw = request.headers['x-csrf-token'];
  const headerToken = Array.isArray(headerTokenRaw) ? headerTokenRaw[0] : headerTokenRaw;

  if (!cookieToken || !headerToken || !safeCompare(cookieToken, headerToken)) {
    response.status(403).json({
      code: 403,
      message: 'CSRF token 验证失败',
      data: null,
    });
    return;
  }

  next();
};
