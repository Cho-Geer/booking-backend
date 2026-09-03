/**
 * 集成认证守卫单元测试
 * 覆盖 TC-17（正常）/ TC-18（异常）以及 fail-closed 与定长时间比较
 * @author Booking System
 * @since 2024
 */

import { HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { IntegrationGuard } from './integration.guard';
import { AuthenticationException } from '../exceptions/business.exceptions';

describe('IntegrationGuard', () => {
  let guard: IntegrationGuard;

  // 测试用令牌
  const TEST_TOKEN = 'test-integration-token-2026';

  // 保存 env 原值，afterEach 时还原，避免污染其他测试
  let originalIntegrationToken: string | undefined;

  // 构造 mock ExecutionContext，返回携带指定 authorization 头的请求
  function createMockContext(authorization?: string): any {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization },
        }),
      }),
    };
  }

  // 断言 Promise 以指定异常类拒绝，且 HTTP 状态码符合预期
  async function expectRejectedWith(
    promise: Promise<boolean>,
    errorClass: new (...args: any[]) => any,
    status: HttpStatus
  ): Promise<void> {
    let caught: any;
    try {
      await promise;
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(errorClass);
    expect(caught.getStatus()).toBe(status);
  }

  beforeEach(() => {
    guard = new IntegrationGuard();
    // 保存 env 原值
    originalIntegrationToken = process.env.INTEGRATION_TOKEN;
  });

  afterEach(() => {
    // 还原 env 原值
    if (originalIntegrationToken === undefined) {
      delete process.env.INTEGRATION_TOKEN;
    } else {
      process.env.INTEGRATION_TOKEN = originalIntegrationToken;
    }
  });

  describe('TC-17 正常（A3 认证通过）', () => {
    it('应该在校验令牌与 env 一致时返回 true', async () => {
      process.env.INTEGRATION_TOKEN = TEST_TOKEN;
      const context = createMockContext(`Bearer ${TEST_TOKEN}`);

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('应该接受 scheme 大小写不敏感的 Bearer 头', async () => {
      process.env.INTEGRATION_TOKEN = TEST_TOKEN;
      const context = createMockContext(`bearer ${TEST_TOKEN}`);

      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });

  describe('TC-18 异常（认证 NG・401）', () => {
    it('应该在校验令牌与 env 不一致时抛出 401 认证异常', async () => {
      process.env.INTEGRATION_TOKEN = TEST_TOKEN;
      const context = createMockContext('Bearer wrong-token');

      await expectRejectedWith(guard.canActivate(context), AuthenticationException, HttpStatus.UNAUTHORIZED);
    });

    it('应该在 Authorization 头缺失时抛出 401 认证异常', async () => {
      process.env.INTEGRATION_TOKEN = TEST_TOKEN;
      const context = createMockContext(undefined);

      await expectRejectedWith(guard.canActivate(context), AuthenticationException, HttpStatus.UNAUTHORIZED);
    });

    it('应该在 scheme 非 Bearer（如 Basic）时抛出 401 认证异常', async () => {
      process.env.INTEGRATION_TOKEN = TEST_TOKEN;
      const context = createMockContext('Basic abc');

      await expectRejectedWith(guard.canActivate(context), AuthenticationException, HttpStatus.UNAUTHORIZED);
    });

    it('应该在 Bearer 后无 token 时抛出 401 认证异常', async () => {
      process.env.INTEGRATION_TOKEN = TEST_TOKEN;
      const context = createMockContext('Bearer');

      await expectRejectedWith(guard.canActivate(context), AuthenticationException, HttpStatus.UNAUTHORIZED);
    });
  });

  describe('fail-closed（env 未配置）', () => {
    it('应该在 INTEGRATION_TOKEN 未设置时抛出 500 服务器配置异常', async () => {
      delete process.env.INTEGRATION_TOKEN;
      const context = createMockContext(`Bearer ${TEST_TOKEN}`);

      await expectRejectedWith(guard.canActivate(context), InternalServerErrorException, HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('应该在 INTEGRATION_TOKEN 为空字符串时抛出 500 服务器配置异常', async () => {
      process.env.INTEGRATION_TOKEN = '';
      const context = createMockContext(`Bearer ${TEST_TOKEN}`);

      await expectRejectedWith(guard.canActivate(context), InternalServerErrorException, HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('应该在 env 未设置且请求头形式不正时先验头形式抛出 401（而非 500）', async () => {
      // 顺序钉板：先验头形式（scheme 非 Bearer → 401），后验 env（未配置 → 500）
      delete process.env.INTEGRATION_TOKEN;
      const context = createMockContext('Basic abc');

      await expectRejectedWith(guard.canActivate(context), AuthenticationException, HttpStatus.UNAUTHORIZED);
    });
  });

  describe('constantTimeEquals（定长时间比较）', () => {
    it('应该在等值输入时返回 true', () => {
      expect((guard as any).constantTimeEquals('abc', 'abc')).toBe(true);
    });

    it('应该在同长度不同值时返回 false', () => {
      expect((guard as any).constantTimeEquals('abc', 'abd')).toBe(false);
    });

    it('应该在异长度输入时返回 false 而非抛异常', () => {
      expect((guard as any).constantTimeEquals('abc', 'abcdef')).toBe(false);
    });

    it('应该在空 token 时返回 false', () => {
      expect((guard as any).constantTimeEquals('', 'abc')).toBe(false);
    });
  });
});
