/**
 * 集成认证守卫
 * A3 服务间认证：校验外部系统通过 Authorization: Bearer <token> 传入的静态令牌
 * @author Booking System
 * @since 2024
 *
 * P0-3 B-1・A3 服务间认证・IF-02・REQ-029・DD-02 §2.1
 */

import { Injectable, CanActivate, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { AuthenticationException } from '../exceptions/business.exceptions';

/**
 * 集成认证守卫类
 * 校验请求携带的 Bearer Token 是否与 env INTEGRATION_TOKEN 一致（定长时间比较）
 */
@Injectable()
export class IntegrationGuard implements CanActivate {
  /**
   * 校验服务间调用认证
   * @param context 执行上下文
   * @returns 认证通过则返回 true
   * @throws AuthenticationException 令牌缺失 / 形式不正 / 不一致时（401）
   * @throws InternalServerErrorException env 未配置时（500，fail-closed）
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取请求对象
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    // 头缺失 / scheme 非 Bearer（大小写不敏感）/ token 为空 → 401
    const token = this.extractBearerToken(authorization);
    if (!token) {
      throw new AuthenticationException('无效的集成认证令牌');
    }

    // env 未设置或为空字符串 → fail-closed，显式暴露误配置（500）
    const expected = process.env.INTEGRATION_TOKEN;
    if (!expected) {
      throw new InternalServerErrorException('INTEGRATION_TOKEN 未配置');
    }

    // 定长时间比较：一致则放行，不一致则 401
    if (this.constantTimeEquals(token, expected)) {
      return true;
    }

    throw new AuthenticationException('集成认证令牌不一致');
  }

  /**
   * 从 Authorization 头提取 Bearer Token
   * @param authorization Authorization 头原始值
   * @returns Bearer Token；头缺失 / scheme 非 Bearer（大小写不敏感）/ token 为空时返回 null
   */
  private extractBearerToken(authorization?: string): string | null {
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }

  /**
   * 定长时间比较
   * 双方各做 SHA-256 摘要得到定长 32 字节，再以 crypto.timingSafeEqual 比较，
   * 规避长度不等抛异常与长度早退带来的时序侧信道
   * @param received 请求方传入的令牌
   * @param expected 期望的令牌
   * @returns 双方摘要是否一致
   */
  private constantTimeEquals(received: string, expected: string): boolean {
    const digestA = crypto.createHash('sha256').update(received).digest();
    const digestB = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(digestA, digestB);
  }
}
