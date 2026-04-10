import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * 管理员权限守卫
 * 验证当前用户是否为管理员
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * 验证用户是否有管理员权限
   * @param context 执行上下文
   * @returns 是否有权限
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('未授权访问');
    }

    const userType = (user?.userType || '').toString().toUpperCase();
    const role = (user?.role || '').toString().toUpperCase();

    const isAdmin = userType === 'ADMIN' || role === 'ADMIN' || role === 'SUPER_ADMIN';

    if (!isAdmin) {
      throw new ForbiddenException('仅管理员可操作');
    }

    return true;
  }
}
