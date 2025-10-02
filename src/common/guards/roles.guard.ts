/**
 * 角色守卫
 * 检查用户是否具有指定角色
 * @author Booking System
 * @since 2024
 */

import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * 角色守卫类
 * 检查用户是否具有指定角色权限
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  /**
   * 检查用户是否具有访问权限
   * @param context 执行上下文
   * @returns 是否允许访问
   */
  canActivate(context: ExecutionContext): boolean {
    // 获取角色要求
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    
    // 如果没有角色要求，允许访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 获取当前用户信息
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;

    // 检查用户是否已登录
    if (!user) {
      this.logger.warn(`Access denied: User not authenticated`);
      return false;
    }

    // 检查用户角色
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      this.logger.warn(
        `Access denied: User ${user.id} lacks required roles ${requiredRoles.join(', ')}`
      );
    }

    return hasRole;
  }
}

/**
 * 权限守卫类
 * 检查用户是否具有指定权限
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * 检查用户是否具有访问权限
   * @param context 执行上下文
   * @returns 是否允许访问
   */
  canActivate(context: ExecutionContext): boolean {
    // 获取权限要求
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler()
    );
    
    // 如果没有权限要求，允许访问
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 获取当前用户信息
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;

    // 检查用户是否已登录
    if (!user) {
      return false;
    }

    // 检查用户权限
    const userPermissions = user.permissions || [];
    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    return hasPermission;
  }
}