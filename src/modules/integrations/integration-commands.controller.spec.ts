/**
 * 集成命令控制器单元测试（P0-3 B-2/B-3・TC-19 + 接线断言）
 * - TC-19：commandType 为 CANCEL_BOOKING 以外 → 400；六项字段各自 null/空串/缺失 → 400（断言 service 零调用）
 *   （例外：expectedVersion 空串在 enableImplicitConversion 下被隐式转 0 放行——已知偏差・C-11 弱化，见专测）
 * - 合法 DTO → service 被调且返回 ApiResponseDto.success envelope（code 200・data 与 service 真实返回一致的三字段）
 * - 元数据断言：skipJwtAuth=true；IntegrationGuard 位于路由 guards 中
 * 校验路径：以真实控制器 + 与 main.ts 完全一致的全局 ValidationPipe（含 transformOptions.enableImplicitConversion）构建测试应用，经 HTTP 层验证
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { IntegrationCommandsController } from './integration-commands.controller';
import { IntegrationCommandsService } from './integration-commands.service';
import { IntegrationGuard } from '../../common/guards/integration.guard';
import { BookingCommandRequestDto } from './dto/booking-command-request.dto';

describe('IntegrationCommandsController', () => {
  let app: INestApplication;
  let service: IntegrationCommandsService;

  // Mock IntegrationCommandsService
  const mockService = {
    executeCancelCommand: jest.fn(),
  };

  // 与 main.ts 完全一致的全局校验管道配置（含 transformOptions.enableImplicitConversion）
  const globalValidationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });

  // 合法 DTO（六项全必填）
  const VALID_DTO: BookingCommandRequestDto = {
    commandType: 'CANCEL_BOOKING',
    commandId: 'cmd-001',
    bookingExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    requestedBySalesforceUserId: 'sf-user-001',
    correlationId: 'corr-001',
    expectedVersion: 1,
  };

  // 受理结果（与 service 真实返回一致的三字段：httpStatus/canonicalVersion/resultCode）
  const VALID_RESULT = {
    httpStatus: 200,
    canonicalVersion: 2,
    resultCode: 'SUCCESS',
  };

  // 保存 env 原值，afterAll 时还原，避免污染其他测试
  let originalIntegrationToken: string | undefined;

  beforeAll(async () => {
    originalIntegrationToken = process.env.INTEGRATION_TOKEN;
    process.env.INTEGRATION_TOKEN = 'test-integration-token-2026';

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationCommandsController],
      providers: [
        {
          provide: IntegrationCommandsService,
          useValue: mockService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(globalValidationPipe);
    await app.init();

    service = moduleRef.get<IntegrationCommandsService>(IntegrationCommandsService);
  });

  afterAll(async () => {
    if (originalIntegrationToken === undefined) {
      delete process.env.INTEGRATION_TOKEN;
    } else {
      process.env.INTEGRATION_TOKEN = originalIntegrationToken;
    }
    await app.close();
  });

  beforeEach(() => {
    mockService.executeCancelCommand.mockResolvedValue(VALID_RESULT);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('TC-19 参数校验（违规请求 → 400・service 零调用）', () => {
    // 辅助：发起 POST 请求并断言 400
    async function expectBadRequest(payload: Record<string, unknown>): Promise<void> {
      await request(app.getHttpServer())
        .post('/integrations/salesforce/booking-commands')
        .set('Authorization', 'Bearer test-integration-token-2026')
        .send(payload)
        .expect(400);
      expect(service.executeCancelCommand).not.toHaveBeenCalled();
    }

    it('commandType 为 CANCEL_BOOKING 以外时返回 400 且不调用 service', async () => {
      await expectBadRequest({ ...VALID_DTO, commandType: 'CREATE_BOOKING' });
    });

    // 六项字段各自 null/空串/缺失 → 400
    // 注：expectedVersion 的空串用例除外——enableImplicitConversion 下 "" → 0 放行（已知偏差・见下方专测）
    const sixFields = [
      'commandType',
      'commandId',
      'bookingExternalId',
      'requestedBySalesforceUserId',
      'correlationId',
      'expectedVersion',
    ] as const;

    for (const field of sixFields) {
      const nullCase = { ...VALID_DTO, [field]: null } as Record<string, unknown>;
      it(`字段 ${field} 为 null 时返回 400 且不调用 service`, async () => {
        await expectBadRequest(nullCase);
      });

      const emptyStringCase = { ...VALID_DTO, [field]: '' } as Record<string, unknown>;
      const emptyString400Field: ReadonlyArray<string> = [
        'commandType',
        'commandId',
        'bookingExternalId',
        'requestedBySalesforceUserId',
        'correlationId',
      ];
      if (emptyString400Field.includes(field)) {
        it(`字段 ${field} 为空串时返回 400 且不调用 service`, async () => {
          await expectBadRequest(emptyStringCase);
        });
      }

      const missingCase: Record<string, unknown> = { ...VALID_DTO };
      delete missingCase[field];
      it(`字段 ${field} 缺失时返回 400 且不调用 service`, async () => {
        await expectBadRequest(missingCase);
      });
    }

    it('已知偏差（C-11 弱化）：expectedVersion 空串在 enableImplicitConversion 下被隐式转 0 放行进入业务门而非 400', async () => {
      // 2026-09-03 ts-node 探针实证：隐式转换先于 @Transform，"" → 0 通过 @IsInt（@Transform 收到已转换值）。
      // 生产行为：该形态不再被 400 拦截，而是以 expectedVersion=0 进入业务门（版本门/状态门兜底）。
      const response = await request(app.getHttpServer())
        .post('/integrations/salesforce/booking-commands')
        .set('Authorization', 'Bearer test-integration-token-2026')
        .send({ ...VALID_DTO, expectedVersion: '' })
        .expect(200);

      expect(service.executeCancelCommand).toHaveBeenCalledTimes(1);
      expect(service.executeCancelCommand).toHaveBeenCalledWith(
        expect.objectContaining({ expectedVersion: 0 })
      );
      expect(response.body.code).toBe(200);
    });
  });

  describe('合法 DTO 受理（200・envelope 形状）', () => {
    it('应该调用 service 并返回 ApiResponseDto.success 信封（code 200・data 与 service 真实返回一致）', async () => {
      const response = await request(app.getHttpServer())
        .post('/integrations/salesforce/booking-commands')
        .set('Authorization', 'Bearer test-integration-token-2026')
        .send(VALID_DTO)
        .expect(200);

      expect(service.executeCancelCommand).toHaveBeenCalledTimes(1);
      expect(service.executeCancelCommand).toHaveBeenCalledWith(VALID_DTO);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('取消命令受理成功');
      expect(response.body.data).toEqual(VALID_RESULT);
    });
  });

  describe('路由元数据（接线断言）', () => {
    it('receiveCommand 应带有 skipJwtAuth=true 元数据', () => {
      const controller = app.get(IntegrationCommandsController);
      const skipAuth = Reflect.getMetadata('skipJwtAuth', controller.receiveCommand);
      expect(skipAuth).toBe(true);
    });

    it('IntegrationGuard 应位于该路由 guards 中', () => {
      const controller = app.get(IntegrationCommandsController);
      const classGuards = Reflect.getMetadata('__guards__', IntegrationCommandsController) || [];
      const methodGuards = Reflect.getMetadata('__guards__', controller.receiveCommand) || [];
      expect([...classGuards, ...methodGuards]).toContain(IntegrationGuard);
    });
  });
});
