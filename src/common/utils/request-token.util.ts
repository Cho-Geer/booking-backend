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
  // 优先从cookie读取，其次从请求体读取（与refresh接口逻辑一致）
  const cookieToken = (request as Request & { cookies?: Record<string, string> }).cookies?.refresh_token;
  if (cookieToken) {
    return cookieToken;
  }
  
  // 尝试从请求体获取（对于API/移动端客户端）
  const body = request.body as any;
  if (body && typeof body === 'object' && body.refreshToken) {
    return body.refreshToken;
  }
  
  return null;
}
