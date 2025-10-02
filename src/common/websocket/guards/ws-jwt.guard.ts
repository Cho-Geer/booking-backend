/**
 * WebSocket JWT守卫
 * 验证WebSocket连接的JWT令牌
 * @author Booking System
 * @since 2024
 */

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();

    try {
      // 从客户端获取令牌
      const token = this.extractTokenFromClient(client);
      
      if (!token) {
        throw new UnauthorizedException('未提供认证令牌');
      }

      // 验证令牌
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // 将用户信息添加到客户端对象
      client.userId = payload.userId;
      client.userRole = payload.role;

      return true;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('令牌已过期');
      } else if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('无效的令牌');
      } else {
        throw new UnauthorizedException('认证失败');
      }
    }
  }

  /**
   * 从客户端提取令牌
   */
  private extractTokenFromClient(client: any): string | null {
    // 从握手数据中获取令牌
    if (client.handshake?.auth?.token) {
      return client.handshake.auth.token;
    }

    // 从查询参数中获取令牌
    if (client.handshake?.query?.token) {
      return client.handshake.query.token;
    }

    // 从headers中获取令牌
    if (client.handshake?.headers?.authorization) {
      const authHeader = client.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
    }

    return null;
  }
}