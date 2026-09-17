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
import { createHash, randomInt } from 'crypto';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

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
      // 発码宛先が正規化して保存される（登録時の一致確認に使用）
      const issuedEmail = await cacheManager.get(
        `verification_code_email:register:${registerPhoneNumber}`,
      );
      expect(String(issuedEmail)).toBe(registerEmail);
    });
  });

  describe('/v1/auth/register (POST)', () => {
    // 実行ごと・テストごとに一意な 11 桁（138 + 乱数 7 桁 + 連番 1 桁）を使い、
    // 前回実行や他テストの宛先クールダウン残存に依存しない
    let registerSeq = 0;
    const makeRegisterPhoneNumber = () =>
      `138${String(randomInt(0, 10000000)).padStart(7, '0')}${registerSeq++}`;

    it('应该成功注册当邮箱与发码宛先一致', async () => {
      const phoneNumber = makeRegisterPhoneNumber();
      const email = 'register-flow@example.com';

      await request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber, type: 'register', email })
        .expect(200);

      const code = await cacheManager.get(`verification_code:register:${phoneNumber}`);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ name: 'Register Flow User', phoneNumber, email, verificationCode: String(code) })
        .expect(201);

      expect(response.body.data?.accessToken).toBeDefined();
      // 消費後はコードが削除される
      expect(await cacheManager.get(`verification_code:register:${phoneNumber}`)).toBeFalsy();
    });

    it('邮箱与发码宛先不一致时返回 400 且不消费验证码', async () => {
      const phoneNumber = makeRegisterPhoneNumber();
      const email = 'issued-to@example.com';

      await request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber, type: 'register', email })
        .expect(200);

      const code = await cacheManager.get(`verification_code:register:${phoneNumber}`);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          name: 'Mismatch User',
          phoneNumber,
          email: 'someone-else@example.com',
          verificationCode: String(code),
        })
        .expect(400);

      expect(response.body.message).toBe('验证码与邮箱不匹配，请重新获取');
      // 不一致時はコード・试行カウンタを消費しない
      expect(String(await cacheManager.get(`verification_code:register:${phoneNumber}`))).toBe(
        String(code),
      );
      expect(
        await cacheManager.get(`verification_code:attempts:register:${phoneNumber}`),
      ).toBeFalsy();
    });

    it('正規化（大文字・小文字）しても同一邮箱なら注册成功', async () => {
      const phoneNumber = makeRegisterPhoneNumber();
      const email = 'normalized@example.com';

      await request(app.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber, type: 'register', email })
        .expect(200);

      const code = await cacheManager.get(`verification_code:register:${phoneNumber}`);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({
          name: 'Normalized User',
          phoneNumber,
          email: 'Normalized@Example.COM',
          verificationCode: String(code),
        })
        .expect(201);

      expect(response.body.data?.accessToken).toBeDefined();
    });
  });

  /**
   * 実 SMTP（MailHog コンテナ）でメール配送自体を観測する検証。
   * 上の describe は EmailService をスタブ化しているため「未呼出」しか見えないが、
   * ここでは実配送をポジティブコントロールとして確認したうえで、
   * 重複邮箱のときに対象宛先へ新規メッセージが増えないことを MailHog 側で確認する。
   */
  describe('REGISTER 邮箱重複 + MailHog（実 SMTP）', () => {
    jest.setTimeout(120000);

    let mailhogContainer: StartedTestContainer;
    let messagesUrl: string;
    let mailApp: INestApplication;
    let mailAppModule: TestingModule;

    const messageCount = async (): Promise<number> => {
      const response = await fetch(messagesUrl);
      const body = (await response.json()) as { total: number };
      return body.total;
    };

    beforeAll(async () => {
      mailhogContainer = await new GenericContainer('mailhog/mailhog')
        .withExposedPorts(1025, 8025)
        .withWaitStrategy(Wait.forLogMessage('Serving under http://0.0.0.0:8025/'))
        .start();

      process.env.MAIL_HOST = mailhogContainer.getHost();
      process.env.MAIL_PORT = mailhogContainer.getMappedPort(1025).toString();
      // テンプレート描画を有効化して実メールを生成する（email.e2e-spec と同じ前提）
      delete process.env.MAIL_DISABLE_TEMPLATES;
      delete process.env.MAIL_USER;
      delete process.env.MAIL_SECURE;

      messagesUrl = `http://${mailhogContainer.getHost()}:${mailhogContainer.getMappedPort(8025)}/api/v2/messages`;

      // EmailService をスタブ化せず、実 SMTP 経由でメールを送るアプリ
      mailAppModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      mailApp = mailAppModule.createNestApplication();
      mailApp.setGlobalPrefix('v1');
      mailApp.useGlobalPipes(new ValidationPipe());
      await mailApp.init();
    });

    afterAll(async () => {
      if (mailApp) {
        await mailApp.close();
      }
      if (mailhogContainer) {
        await mailhogContainer.stop();
      }
      // 後続テストに影響しないよう環境変数を戻す
      process.env.MAIL_HOST = 'localhost';
      process.env.MAIL_PORT = '1025';
      process.env.MAIL_DISABLE_TEMPLATES = 'true';
    });

    it('重複邮箱では 409 EMAIL_EXISTS を返し、MailHog に新規メッセージが増えない', async () => {
      const registerEmail = `mailhog-${Date.now()}@example.com`;
      const phoneNumber = `139${String(Date.now()).slice(-8)}`;
      const duplicatePhoneNumber = `139${String(Date.now() + 1).slice(-8)}`;

      // ポジティブコントロール：通常の発码は実 SMTP で配送され、MailHog のメッセージが増える
      const before = await messageCount();

      await request(mailApp.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber, type: 'register', email: registerEmail })
        .expect(200);

      let afterSend = before;
      for (let i = 0; i < 20 && afterSend <= before; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        afterSend = await messageCount();
      }
      expect(afterSend).toBeGreaterThan(before);

      // 本題：既存ユーザーの邮箱（beforeEach で作成済み）での REGISTER 発码 → 送信前チェックで 409
      const response = await request(mailApp.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber: duplicatePhoneNumber, type: 'register', email: loginUserEmail })
        .expect(409);

      expect(response.body.error.code).toBe('EMAIL_EXISTS');
      expect(response.body.message).toBe(`邮箱 ${loginUserEmail} 已存在`);

      // MailHog に新規メッセージは増えていない
      expect(await messageCount()).toBe(afterSend);

      // 発码前チェックのため Redis にも何も書かれていない（code / cooldown / email_binding）
      expect(
        await cacheManager.get(`verification_code:register:${duplicatePhoneNumber}`),
      ).toBeFalsy();
      expect(
        await cacheManager.get(`verification_code:cooldown:register:${duplicatePhoneNumber}`),
      ).toBeFalsy();
      expect(
        await cacheManager.get(`verification_code_email:register:${duplicatePhoneNumber}`),
      ).toBeFalsy();
    });

    it('保存済み邮箱が混合大小文字でも、小文字入力の REGISTER 発码は 409 で拒否する', async () => {
      const mixedCaseEmail = `Mixed-Case-${Date.now()}@Example.COM`;
      const lowercaseEmail = mixedCaseEmail.toLowerCase();
      const fixturePhone = `137${String(Date.now()).slice(-8)}`;
      const requestPhone = `137${String(Date.now() + 3).slice(-8)}`;

      // fixture: DB に raw（大小文字混在）のまま保存された既存ユーザー
      await prismaService.user.create({
        data: {
          name: 'Mixed Case Fixture',
          phone: fixturePhone,
          phoneHash: makePhoneHash(fixturePhone),
          email: mixedCaseEmail,
          userType: 'CUSTOMER',
          status: 'ACTIVE',
          isVerified: true,
        },
      });

      const before = await messageCount();

      // 事前チェックが大小文字を区別しないため、小文字バリアントでも重複として拒否される
      const response = await request(mailApp.getHttpServer())
        .post('/v1/auth/send-verification-code')
        .send({ phoneNumber: requestPhone, type: 'register', email: lowercaseEmail })
        .expect(409);

      expect(response.body.error.code).toBe('EMAIL_EXISTS');
      // 表示メッセージは入力どおりの email
      expect(response.body.message).toBe(`邮箱 ${lowercaseEmail} 已存在`);

      // MailHog に新規メッセージは増えていない
      expect(await messageCount()).toBe(before);

      // 発码前チェックのため Redis にも何も書かれていない（code / cooldown / email_binding）
      expect(
        await cacheManager.get(`verification_code:register:${requestPhone}`),
      ).toBeFalsy();
      expect(
        await cacheManager.get(`verification_code:cooldown:register:${requestPhone}`),
      ).toBeFalsy();
      expect(
        await cacheManager.get(`verification_code_email:register:${requestPhone}`),
      ).toBeFalsy();
    });
  });
});
