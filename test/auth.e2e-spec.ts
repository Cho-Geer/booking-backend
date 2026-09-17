/**
 * 认证模块端到端测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { EmailService } from '../src/modules/email/email.service';
import { createHash } from 'crypto';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prismaService: PrismaService;
  let cacheManager: Cache;

  const makePhoneHash = (phoneNumber: string) => createHash('sha256').update(phoneNumber).digest('hex');

  const loginPhoneNumber = '13800138000';
  const loginUserEmail = 'auth-test-user@example.com';

  // 実 SMTP に接続しないよう EmailService をスタブ化（MAIL_* 未設定でも落ちないように）
  const mockEmailService = {
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
    sendBookingUpdate: jest.fn().mockResolvedValue(undefined),
    sendVerificationCode: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(() => {
    // 设置测试环境变量
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.MAIL_HOST = 'localhost';
    process.env.MAIL_PORT = '1025';
    process.env.MAIL_USERNAME = 'test@example.com';
    process.env.MAIL_PASSWORD = 'password';
    process.env.MAIL_FROM = 'noreply@test.com';
    process.env.CSRF_ENABLED = 'false';
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prismaService = moduleFixture.get(PrismaService);
    cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);
    await prismaService.user.upsert({
      where: { phone: loginPhoneNumber },
      update: {
        status: 'ACTIVE',
        isVerified: true,
        email: loginUserEmail,
      },
      create: {
        name: 'Auth Test User',
        phone: loginPhoneNumber,
        phoneHash: makePhoneHash(loginPhoneNumber),
        email: loginUserEmail,
        userType: 'CUSTOMER',
        status: 'ACTIVE',
        isVerified: true,
      },
    });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/v1/auth/send-verification-code (POST)', () => {
    it('应该成功发送验证码（登录场景：发送到账号绑定邮箱）', async () => {
      // 前回実行のクールダウン/コードが Redis に残っていても決定的になるよう消す
      await cacheManager.del(`verification_code:cooldown:login:${loginPhoneNumber}`);
      await cacheManager.del(`verification_code:login:${loginPhoneNumber}`);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber: loginPhoneNumber, type: 'login' })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('验证码发送成功');
      expect(mockEmailService.sendVerificationCode).toHaveBeenCalledWith(
        loginUserEmail,
        expect.stringMatching(/^\d{6}$/),
        5,
      );
      // 保存値は素の6桁文字列（外部 e2e 互換）
      const storedCode = await cacheManager.get(`verification_code:login:${loginPhoneNumber}`);
      expect(String(storedCode)).toMatch(/^\d{6}$/);
    });

    it('应该失败当手机号码格式不正确', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber: 'invalid-phone', type: 'login' })
        .expect(400);
    });

    it('注册场景：缺少邮箱应该返回 400', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber: '13800138001', type: 'register' })
        .expect(400);
    });

    it('注册场景：应该向请求指定的邮箱发送验证码', async () => {
      // 実行ごとに一意な電話番号を使い、前回実行のクールダウン残存に依存しない
      const registerPhoneNumber = `139${String(Date.now()).slice(-8)}`;
      const registerEmail = 'new-register@example.com';

      const response = await request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber: registerPhoneNumber, type: 'register', email: registerEmail })
        .expect(200);

      expect(response.body.code).toBe(200);
      expect(mockEmailService.sendVerificationCode).toHaveBeenCalledWith(
        registerEmail,
        expect.stringMatching(/^\d{6}$/),
        5,
      );
      const storedCode = await cacheManager.get(`verification_code:register:${registerPhoneNumber}`);
      expect(String(storedCode)).toMatch(/^\d{6}$/);
    });
  });
});
