/**
 * 集成命令端到端测试（P0-3 B-2/B-3・IF-02・DD-02 §2.3）
 * Salesforce 侧 CANCEL_BOOKING 命令受理 + キャンセル通知メール（MailHog 実送信検証）
 * - TC-E2E-1 正常系：200 受理 → 正本 CANCELLED/version+1/syncStatus=PENDING（投影 no-op）+ 命令行作成 + メール送信
 * - TC-E2E-2 誤 Bearer トークン → 401・メール送信なし
 * - TC-E2E-3 expectedVersion 不一致 → 409・正本不変・メール送信なし
 * - TC-E2E-4 べき等リプレイ → 同一 canonicalVersion・メールは 1 通のみ
 * 注：メール送信は fire-and-forget（200 応答後に到着する可能性がある）ため MailHog API をポーリングする
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { UserType, UserStatus, AppointmentStatus } from '@prisma/client';

interface MailHogMessage {
  Content: {
    Headers: {
      To: string[];
      Subject: string[];
    };
    Body: string;
  };
}

interface MailHogResponse {
  items: MailHogMessage[];
}

const INTEGRATION_BEARER = 'e2e-integration-token';
const SF_OPERATOR_ID = 'sf-op-e2e-001';
const HAPPY_EMAIL = 'e2e-cancel@example.com';
const WRONG_TOKEN_EMAIL = 'e2e-wrongtoken@example.com';
const VERSION_MISMATCH_EMAIL = 'e2e-version@example.com';
const CANCELLED_SUBJECT = 'Booking Cancelled';

describe('IntegrationCommandsController (e2e) - CANCEL_BOOKING + cancellation email', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let mailhogContainer: StartedTestContainer;
  let apiPort: number;

  // Increase timeout for container startup + app boot + email polling
  jest.setTimeout(60000);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function fetchMailhogMessages(): Promise<MailHogResponse> {
    const response = await fetch(
      `http://${mailhogContainer.getHost()}:${apiPort}/api/v2/messages`
    );
    return (await response.json()) as MailHogResponse;
  }

  function isCancelledMailTo(message: MailHogMessage, to: string): boolean {
    const headers = message.Content.Headers;
    return (
      (headers.To ?? []).some((t) => t.toLowerCase().includes(to)) &&
      (headers.Subject ?? []).some((s) => s.includes(CANCELLED_SUBJECT))
    );
  }

  function countCancelledMailTo(messages: MailHogMessage[], to: string): number {
    return messages.filter((m) => isCancelledMailTo(m, to)).length;
  }

  /** fire-and-forget 送信のため 200 応答後にメールが到着する可能性がある → ポーリングで待つ */
  async function waitForCancelledMailTo(to: string, timeoutMs = 10000): Promise<MailHogMessage | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const data = await fetchMailhogMessages();
      const hit = (data.items ?? []).find((m) => isCancelledMailTo(m, to));
      if (hit) {
        return hit;
      }
      await sleep(500);
    }
    return null;
  }

  function buildCommandBody(overrides: Record<string, unknown> = {}) {
    return {
      commandType: 'CANCEL_BOOKING',
      commandId: randomUUID(),
      bookingExternalId: '',
      expectedVersion: 1,
      requestedBySalesforceUserId: SF_OPERATOR_ID,
      correlationId: randomUUID(),
      ...overrides,
    };
  }

  beforeAll(async () => {
    // Start Mailhog container
    mailhogContainer = await new GenericContainer('mailhog/mailhog')
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forLogMessage('Serving under http://0.0.0.0:8025/'))
      .start();

    const smtpPort = mailhogContainer.getMappedPort(1025);
    apiPort = mailhogContainer.getMappedPort(8025);
    const host = mailhogContainer.getHost();

    console.log(`Mailhog started on ${host} SMTP:${smtpPort} API:${apiPort}`);

    // Set environment variables（IntegrationGuard / EmailModule / JwtAuthGuard 用）
    process.env.INTEGRATION_TOKEN = INTEGRATION_BEARER;
    process.env.MAIL_HOST = host;
    process.env.MAIL_PORT = smtpPort.toString();
    process.env.MAIL_USERNAME = 'test@example.com';
    process.env.MAIL_PASSWORD = 'password';
    process.env.MAIL_FROM = 'noreply@test.com';
    // global setup.ts が true を設定するため削除（テンプレート描画を有効化・email.e2e-spec.ts と同一）
    delete process.env.MAIL_DISABLE_TEMPLATES;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-e2e-tests';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key-for-e2e-tests';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
    process.env.CSRF_ENABLED = 'false';
    // .env.development が SF_PROJECTION_ENABLED=true を読み込むため、
    // process.env で明示上書き（投影 no-op → syncStatus=PENDING のまま維持）
    process.env.SF_PROJECTION_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    // --- シードデータ作成 ---
    const admin = await prismaService.user.create({
      data: {
        name: 'SF連携E2E管理者',
        phone: '13900090001',
        phoneHash: 'sf-cancel-e2e-admin-hash',
        userType: UserType.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    await prismaService.staticOperatorMapping.create({
      data: {
        salesforceUserId: SF_OPERATOR_ID,
        bookingUserId: admin.id,
        active: true,
      },
    });

    const timeSlot = await prismaService.timeSlot.create({
      data: {
        slotTime: '07:45:00',
        durationMinutes: 60,
        isActive: true,
      },
    });

    const service = await prismaService.service.create({
      data: {
        name: 'E2E SF Cancel Service',
        imageUrl: 'https://example.com/e2e-sf-cancel.png',
        durationMinutes: 60,
        isActive: true,
      },
    });

    // （timeSlotId, appointmentDate）部分一意インデックス（active ステータスのみ）のため
    // 各予約に異なる appointmentDate を与える
    const appointmentBase = {
      timeSlotId: timeSlot.id,
      serviceId: service.id,
      status: AppointmentStatus.PENDING,
      version: 1,
      customerName: 'E2E SF取消太郎',
      customerPhone: '13900090002',
      notes: 'E2E SF cancel command',
    };

    await prismaService.appointment.create({
      data: {
        ...appointmentBase,
        appointmentNumber: 'AP-20260910-9001',
        appointmentDate: new Date('2026-09-10'),
        customerEmail: HAPPY_EMAIL,
      },
    });

    await prismaService.appointment.create({
      data: {
        ...appointmentBase,
        appointmentNumber: 'AP-20260910-9002',
        appointmentDate: new Date('2026-09-11'),
        customerEmail: WRONG_TOKEN_EMAIL,
      },
    });

    await prismaService.appointment.create({
      data: {
        ...appointmentBase,
        appointmentNumber: 'AP-20260910-9003',
        appointmentDate: new Date('2026-09-12'),
        customerEmail: VERSION_MISMATCH_EMAIL,
      },
    });
  });

  afterAll(async () => {
    // 自分のテストデータのみ後始末（setup.ts cleanupTestData は integrationCommand/staticOperatorMapping を
    // カバーしないためここで明示削除・外部キー依存順）
    await prismaService.integrationCommand.deleteMany({});
    await prismaService.staticOperatorMapping.deleteMany({});
    await prismaService.appointment.deleteMany({});
    await prismaService.service.deleteMany({});
    await prismaService.timeSlot.deleteMany({});
    await prismaService.user.deleteMany({});

    if (app) {
      await app.close();
    }
    if (mailhogContainer) {
      await mailhogContainer.stop();
    }

    // global setup.ts の設定値へ復元（SF_PROJECTION_ENABLED は将来の投影系 spec への漏出を防止）
    process.env.MAIL_DISABLE_TEMPLATES = 'true';
    delete process.env.SF_PROJECTION_ENABLED;
  });

  it('TC-E2E-1 正常系：200 受理・正本 CANCELLED/version2/syncStatus PENDING・命令行作成・キャンセルメール送信', async () => {
    const happyAppointment = await prismaService.appointment.findUnique({
      where: { appointmentNumber: 'AP-20260910-9001' },
    });
    const commandId = randomUUID();

    const response = await request(app.getHttpServer())
      .post('/v1/integrations/salesforce/booking-commands')
      .set('Authorization', `Bearer ${INTEGRATION_BEARER}`)
      .send(
        buildCommandBody({
          commandId,
          bookingExternalId: happyAppointment.id,
          expectedVersion: 1,
        })
      )
      .expect(200);

    expect(response.body.code).toBe(200);
    expect(response.body.data.resultCode).toBe('SUCCESS');
    expect(response.body.data.canonicalVersion).toBe(2);

    // 正本更新（投影 no-op のため syncStatus は PENDING のまま）
    const cancelled = await prismaService.appointment.findUnique({
      where: { id: happyAppointment.id },
    });
    expect(cancelled.status).toBe(AppointmentStatus.CANCELLED);
    expect(cancelled.version).toBe(2);
    expect(cancelled.syncStatus).toBe('PENDING');

    // 命令行作成（冪等キー）
    const commandRow = await prismaService.integrationCommand.findUnique({
      where: { commandId },
    });
    expect(commandRow).not.toBeNull();
    expect(commandRow.resultCode).toBe('SUCCESS');
    expect(commandRow.canonicalVersion).toBe(2);

    // メール送信（fire-and-forget のためポーリング）
    const message = await waitForCancelledMailTo(HAPPY_EMAIL, 10000);
    expect(message).not.toBeNull();
    expect(message.Content.Headers.To[0]).toBe(HAPPY_EMAIL);
  });

  it('TC-E2E-2 誤 Bearer トークン：401 拒否・キャンセルメール送信なし', async () => {
    const target = await prismaService.appointment.findUnique({
      where: { appointmentNumber: 'AP-20260910-9002' },
    });

    await request(app.getHttpServer())
      .post('/v1/integrations/salesforce/booking-commands')
      .set('Authorization', 'Bearer wrong-token')
      .send(
        buildCommandBody({
          bookingExternalId: target.id,
          expectedVersion: 1,
        })
      )
      .expect(401);

    // 正本が PENDING のまま（何も起きていない）
    const after = await prismaService.appointment.findUnique({ where: { id: target.id } });
    expect(after.status).toBe(AppointmentStatus.PENDING);

    // 専用アドレス宛のメールが届かないことを確認（fire-and-forget 到着猶予として 2 秒待つ）
    await sleep(2000);
    const data = await fetchMailhogMessages();
    expect(countCancelledMailTo(data.items ?? [], WRONG_TOKEN_EMAIL)).toBe(0);
  });

  it('TC-E2E-3 expectedVersion 不一致：409・正本不変（PENDING）・キャンセルメール送信なし', async () => {
    const target = await prismaService.appointment.findUnique({
      where: { appointmentNumber: 'AP-20260910-9003' },
    });

    await request(app.getHttpServer())
      .post('/v1/integrations/salesforce/booking-commands')
      .set('Authorization', `Bearer ${INTEGRATION_BEARER}`)
      .send(
        buildCommandBody({
          bookingExternalId: target.id,
          expectedVersion: 0,
        })
      )
      .expect(409);

    const after = await prismaService.appointment.findUnique({ where: { id: target.id } });
    expect(after.status).toBe(AppointmentStatus.PENDING);
    expect(after.version).toBe(1);

    // 専用アドレス宛のメールが届かないことを確認（fire-and-forget 到着猶予として 2 秒待つ）
    await sleep(2000);
    const data = await fetchMailhogMessages();
    expect(countCancelledMailTo(data.items ?? [], VERSION_MISMATCH_EMAIL)).toBe(0);
  });

  it('TC-E2E-4 べき等リプレイ：同一 commandId は同一 canonicalVersion で 200・メールは 1 通のみ', async () => {
    const happyAppointment = await prismaService.appointment.findUnique({
      where: { appointmentNumber: 'AP-20260910-9001' },
    });

    // TC-E2E-1 で受理済みのコマンドを特定（canonicalVersion=2 の行）
    const originalRow = await prismaService.integrationCommand.findFirst({
      where: { appointmentId: happyAppointment.id, canonicalVersion: 2 },
    });
    expect(originalRow).not.toBeNull();

    const replayResponse = await request(app.getHttpServer())
      .post('/v1/integrations/salesforce/booking-commands')
      .set('Authorization', `Bearer ${INTEGRATION_BEARER}`)
      .send(
        buildCommandBody({
          commandId: originalRow.commandId,
          bookingExternalId: happyAppointment.id,
          expectedVersion: 1,
        })
      )
      .expect(200);

    expect(replayResponse.body.code).toBe(200);
    expect(replayResponse.body.data.resultCode).toBe('SUCCESS');
    expect(replayResponse.body.data.canonicalVersion).toBe(2);

    // リプレイで正本が二重更新されていないこと
    const after = await prismaService.appointment.findUnique({ where: { id: happyAppointment.id } });
    expect(after.version).toBe(2);

    // リプレイでメールが追加送信されていないこと（TC-E2E-1 の 1 通のみ）
    await sleep(2000);
    const data = await fetchMailhogMessages();
    expect(countCancelledMailTo(data.items ?? [], HAPPY_EMAIL)).toBe(1);
  });
});
