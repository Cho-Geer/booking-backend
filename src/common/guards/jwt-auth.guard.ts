/**
 * JWT认证守卫
 * 处理JWT令牌验证和用户信息注入
 * @author Booking System
 * @since 2024
 */

import { Injectable, CanActivate, ExecutionContext, Logger, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticationException } from '../exceptions/business.exceptions';
import * as crypto from 'crypto';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private reflector: Reflector,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否需要跳过认证
    const skipAuth = this.reflector.get<boolean>('skipJwtAuth', context.getHandler());
    if (skipAuth) {
      return true;
    }
  
    const request = context.switchToHttp().getRequest<Request>();
      
    try {
      // 从请求头中提取 token
      const token = this.extractToken(request);
        
      if (!token) {
        // 如果没有访问令牌，但有刷新令牌，允许请求通过
        // 让前端的 axios 拦截器自动处理刷新逻辑
        // const hasRefreshToken = this.hasRefreshToken(request);
        // if (hasRefreshToken) {
        //   this.logger.log('检测到刷新令牌但无访问令牌，允许请求通过（将由拦截器处理刷新）');
        //   return true;
        // }
          
        throw new AuthenticationException('未提供访问令牌');
      }
  
      // 验证 token
      const payload = await this.verifyToken(token);
        
      // 获取用户信息
      const user = await this.getUserFromPayload(payload);
        
      if (!user) {
        throw new AuthenticationException('用户不存在');
      }
  
      // 检查用户状态
      if (user.status !== 'ACTIVE') {
        throw new AuthenticationException('用户账户已被禁用');
      }
  
      // 将用户信息添加到请求对象
      request.user = user;
        
      return true;
    } catch (error) {
      if (error instanceof AuthenticationException) {
        // // 如果是访问令牌过期且有刷新令牌，允许请求通过
        // if (error.message.includes('已过期') && this.hasRefreshToken(request)) {
        //   this.logger.log('访问令牌已过期但存在刷新令牌，允许请求通过（将由拦截器处理刷新）');
        //   return true;
        // }
        throw error;
      }
        
      this.logger.error(`JWT 认证失败：${error.message}`, error.stack);
      throw new AuthenticationException('令牌验证失败');
    }
  }

  /**
   * 从请求头中提取 JWT 令牌
   */
  private extractToken(request: Request): string | null {
    const cookieToken = (request as Request & { cookies?: Record<string, string> }).cookies?.access_token;
    if (cookieToken) {
      return cookieToken;
    }
  
    const authHeader = request.headers.authorization;
      
    if (!authHeader) {
      return null;
    }
  
    const [type, token] = authHeader.split(' ');
      
    if (type !== 'Bearer' || !token) {
      return null;
    }
  
    return token;
  }
  
  /**
   * 检查请求中是否存在刷新令牌
   */
  // private hasRefreshToken(request: Request): boolean {
  //   const refreshToken = (request as Request & { cookies?: Record<string, string> }).cookies?.refresh_token;
  //   return !!refreshToken;
  // }

  /**
   * 验证JWT令牌
   */
  private async verifyToken(token: string): Promise<any> {
    try {
      // 检查令牌是否在黑名单中
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const isBlacklisted = await this.cacheManager.get(`blacklist:${tokenHash}`);
      
      if (isBlacklisted) {
        throw new AuthenticationException('访问令牌已被吊销');
      }
      
      return await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationException('访问令牌已过期');
      } else if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationException('访问令牌无效');
      } else if (error instanceof AuthenticationException) {
        throw error;
      } else {
        throw new AuthenticationException('令牌验证失败');
      }
    }
  }

  /**
   * 从JWT载荷中获取用户信息，并检测角色是否已发生变更
   * 若 JWT 中记录的角色与数据库当前角色不一致，则抛出专用异常让前端处理跳转
   * @param payload JWT载荷
   * @returns 用户信息
   */
  private async getUserFromPayload(payload: any): Promise<any> {
    const { sub: userId, phoneHash, userType, role } = payload;

    // 根据用户ID或手机号哈希查找用户
    const where = userId 
      ? { id: userId }
      : { phoneHash };

    const user = await this.prisma.user.findUnique({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        phoneHash: true,
        userType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 添加角色信息（始终使用数据库中的最新角色，不受 JWT 载荷中旧角色的影响）
    if (user) {
      // JWT 中存储的旧角色（generateTokens 中以 role 字段存储，userType 字段在 payload 中不存在）
      const jwtRole = (role || userType || '').toString().toUpperCase();
      // 数据库中的最新角色
      const dbRole = (user.userType || '').toString().toUpperCase();

      // 检测角色是否已发生变更
      if (jwtRole && dbRole && jwtRole !== dbRole) {
        if (jwtRole === 'ADMIN' && dbRole !== 'ADMIN') {
          // ADMIN → 普通用户：降权，需要强制前端重新登录
          this.logger.warn(`角色降权检测: 用户 ${userId} JWT角色=${jwtRole} 数据库角色=${dbRole}，拒绝访问`);
          throw new AuthenticationException('用户角色已降级，请重新登录');
        } else if (jwtRole !== 'ADMIN' && dbRole === 'ADMIN') {
          // 普通用户 → ADMIN：升权，需要引导前端跳转到管理页面
          this.logger.warn(`角色升权检测: 用户 ${userId} JWT角色=${jwtRole} 数据库角色=${dbRole}，引导跳转管理页`);
          throw new AuthenticationException('用户角色已升级，请重新登录');
        }
      }

      // 以数据库角色为准设置 role / userType 字段
      (user as any).roles = [user.userType];
      (user as any).role = user.userType;
      (user as any).userType = user.userType;
      this.logger.log(`用户信息: ${JSON.stringify(user)}`);
    }

    return user;
  }
}
