/**
 * 认证模块端到端测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/v1/auth/send-verification-code (POST)', () => {
    it('应该成功发送验证码', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber: '13800138000', type: 'login' })
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.message).toBe('验证码发送成功');
        });
    });

    it('应该失败当手机号码格式不正确', () => {
      return request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber: 'invalid-phone', type: 'login' })
        .expect(400);
    });
  });
});
