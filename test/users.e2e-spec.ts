/**
 * 用户模块端到端测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { EmailService } from '../src/modules/email/email.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let adminToken: string;
  let prismaService: PrismaService;
  let cacheManager: Cache;
  let moduleFixture: TestingModule;

  const adminPhoneNumber = '13900139003';
  const userPhoneNumber = '13900139004';
  let phoneSeq = 1000;
  const nextPhone = () => `1350013${String(phoneSeq++).padStart(4, '0')}`;

  const makePhoneHash = (phoneNumber: string) => createHash('sha256').update(phoneNumber).digest('hex');
  const makeEmail = (phoneNumber: string) => `user-${phoneNumber}@example.com`;

  // 実 SMTP に接続しないよう EmailService をスタブ化（MAIL_* 未設定でも落ちないように）
  const mockEmailService = {
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
    sendBookingUpdate: jest.fn().mockResolvedValue(undefined),
    sendVerificationCode: jest.fn().mockResolvedValue(undefined),
  };

  const ensureUser = async (phoneNumber: string, userType: 'ADMIN' | 'CUSTOMER') => {
    const email = makeEmail(phoneNumber);
    await prismaService.user.upsert({
      where: { phone: phoneNumber },
      update: {
        userType,
        status: 'ACTIVE',
        isVerified: true,
        email,
      },
      create: {
        name: userType === 'ADMIN' ? 'Admin User' : 'Normal User',
        phone: phoneNumber,
        phoneHash: makePhoneHash(phoneNumber),
        email,
        userType,
        status: 'ACTIVE',
        isVerified: true,
      },
    });
  };

  const loginAndGetToken = async (phoneNumber: string) => {
    // 発码エンドポイントは IP 単位レート制限（5回/60秒）と宛先別クールダウン（60秒）の対象になるため、
    // 同一 IP から繰り返しログインする本ファイルでは送信 API を叩かず、
    // type スコープ化されたキーへ直接コードを投入してログインする。
    const verificationCode = '123456';
    await cacheManager.set(
      `verification_code:login:${phoneNumber}`,
      verificationCode,
      300 * 1000,
    );

    const loginResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ phoneNumber, verificationCode })
      .expect(200);

    const token = loginResponse.body?.data?.accessToken as string | undefined;
    if (!token) {
      throw new Error(`Missing access token for ${phoneNumber}`);
    }
    return token;
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key-for-e2e-tests';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
    process.env.CSRF_ENABLED = 'false';
    process.env.API_PREFIX = '/v1';

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();

    prismaService = moduleFixture.get(PrismaService);
    cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);
  });

  beforeEach(async () => {
    await ensureUser(adminPhoneNumber, 'ADMIN');
    await ensureUser(userPhoneNumber, 'CUSTOMER');
    adminToken = await loginAndGetToken(adminPhoneNumber);
    authToken = await loginAndGetToken(userPhoneNumber);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/users (POST)', () => {
    it('应该成功创建用户', () => {
      const createUserDto = {
        name: '新用户',
        phone: '13700137001',
        userType: 'CUSTOMER',
        status: 'ACTIVE',
        remarks: '测试创建用户',
      };

      return request(app.getHttpServer())
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.message).toBe('用户创建成功');
          expect(res.body.data?.id).toBeDefined();
          expect(res.body.data?.name).toBe('新用户');
        });
    });

    it('应该失败当手机号已存在', async () => {
      const createUserDto = {
        name: '重复用户',
        phone: userPhoneNumber,
        userType: 'CUSTOMER',
        status: 'ACTIVE',
        remarks: '测试重复手机号',
      };

      return request(app.getHttpServer())
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect(409)
        .expect((res) => {
          expect(res.body.code).toBe(409);
        });
    });

    it('应该失败当没有权限', () => {
      const createUserDto = {
        name: '无权限用户',
        phone: '13600136001',
        userType: 'CUSTOMER',
        status: 'ACTIVE',
        remarks: '测试无权限',
      };

      return request(app.getHttpServer())
        .post('/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createUserDto)
        .expect(403);
    });
  });

  describe('/users (GET)', () => {
    it('应该成功获取用户列表', () => {
      return request(app.getHttpServer())
        .get('/v1/users')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.message).toBe('获取用户列表成功');
          expect(Array.isArray(res.body.data?.items)).toBe(true);
          expect(res.body.data?.page).toBe(1);
          expect(res.body.data?.limit).toBe(10);
        });
    });

    it('应该根据查询条件过滤用户', () => {
      return request(app.getHttpServer())
        .get('/v1/users')
        .query({ name: '测试', userType: 'CUSTOMER', page: 1, limit: 10 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(200);
        });
    });

    it('应该失败当普通用户访问用户列表', () => {
      return request(app.getHttpServer())
        .get('/v1/users')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('/users/:id (GET)', () => {
    let userId: string;

    beforeEach(async () => {
      const phone = nextPhone();
      // 先创建一个用户用于测试
      const createResponse = await request(app.getHttpServer())
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '详情测试用户',
          phone,
          userType: 'CUSTOMER',
          status: 'ACTIVE',
          remarks: '测试详情',
        });

      userId = createResponse.body.data.id;
    });

    it('应该成功获取用户详情', () => {
      return request(app.getHttpServer())
        .get(`/v1/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.message).toBe('获取用户详情成功');
          expect(res.body.data?.id).toBe(userId);
          expect(res.body.data?.name).toBe('详情测试用户');
        });
    });

    it('应该失败当用户不存在', () => {
      return request(app.getHttpServer())
        .get('/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.code).toBe(404);
        });
    });
  });

  describe('/users/:id (PUT)', () => {
    let userId: string;

    beforeEach(async () => {
      const phone = nextPhone();
      // 先创建一个用户用于测试
      const createResponse = await request(app.getHttpServer())
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '更新测试用户',
          phone,
          userType: 'CUSTOMER',
          status: 'ACTIVE',
          remarks: '测试更新',
        });

      userId = createResponse.body.data.id;
    });

    it('应该成功更新用户信息', () => {
      const updateUserDto = {
        name: '更新后的用户',
        userType: 'ADMIN',
        status: 'INACTIVE',
        remarks: '已更新',
      };

      return request(app.getHttpServer())
        .put(`/v1/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateUserDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.message).toBe('用户更新成功');
          expect(res.body.data?.name).toBe('更新后的用户');
          expect(res.body.data?.userType).toBe('ADMIN');
          expect(res.body.data?.status).toBe('INACTIVE');
        });
    });

    it('应该失败当没有权限', () => {
      const updateUserDto = {
        name: '无权限更新',
        userType: 'ADMIN',
        status: 'INACTIVE',
        remarks: '无权限',
      };

      return request(app.getHttpServer())
        .put(`/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateUserDto)
        .expect(403);
    });
  });

  describe('/users/:id (DELETE)', () => {
    let userId: string;

    beforeEach(async () => {
      const phone = nextPhone();
      // 先创建一个用户用于测试
      const createResponse = await request(app.getHttpServer())
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '删除测试用户',
          phone,
          userType: 'CUSTOMER',
          status: 'ACTIVE',
          remarks: '测试删除',
        });

      userId = createResponse.body.data.id;
    });

    it('应该成功删除用户', () => {
      return request(app.getHttpServer())
        .delete(`/v1/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.message).toBe('用户删除成功');
        });
    });

    it('应该失败当没有权限', () => {
      return request(app.getHttpServer())
        .delete(`/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('/users/profile/me (GET)', () => {
    it('应该成功获取当前用户信息', () => {
      return request(app.getHttpServer())
        .get('/v1/users/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.message).toBe('获取当前用户信息成功');
          expect(res.body.data?.id).toBeDefined();
        });
    });

    it('应该失败当未认证', () => {
      return request(app.getHttpServer())
        .get('/v1/users/profile/me')
        .expect(401);
    });
  });

  describe('/users/statistics (GET)', () => {
    it('应该成功获取用户统计信息', () => {
      return request(app.getHttpServer())
        .get('/v1/users/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe(200);
          expect(res.body.message).toBe('获取统计信息成功');
          expect(res.body.data).toBeDefined();
        });
    });

    it('应该失败当没有权限', () => {
      return request(app.getHttpServer())
        .get('/v1/users/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});
