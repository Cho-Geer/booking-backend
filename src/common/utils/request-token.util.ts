import { Request } from 'express';

export function extractBearerToken(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const [type, token] = authorization.split(' ');
  if (type !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

export function extractAccessToken(request: Request): string | null {
  const cookieToken = (request as Request & { cookies?: Record<string, string> }).cookies?.access_token;
  if (cookieToken) {
    return cookieToken;
  }

  return extractBearerToken(request.headers.authorization);
}

export function extractRefreshToken(request: Request): string | null {
  return (request as Request & { cookies?: Record<string, string> }).cookies?.refresh_token ?? null;
}
