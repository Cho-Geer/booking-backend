/**
 * 集成命令服务单元测试（P0-3 B-2/B-3・TC-20〜TC-26）
 * - TC-20 幂等先行（RULE-03）：commandId 命中 → 原样返回初回结果，零 update / 零 create
 * - TC-21 静态映射 NG（RULE-12）：映射不存在 / active=false / 用户非 ADMIN / 用户 INACTIVE → 403
 * - TC-22 预约不存在 → 404
 * - TC-23 状态迁移 NG（RULE-05/07）：COMPLETED 宛・CANCELLED 宛 → 409
 * - TC-24 版本门（RULE-02・C-10）：同值受理 / 低 1 → 409 / expectedVersion=0 → 409
 * - TC-25 成功事务（RULE-08）：$transaction 使用・update data・create 同 tx・返回 200+canonicalVersion+SUCCESS
 * - TC-26 DB 例外：tx 内 update 抛错 → 异常传播，create 未达
 * 异常断言一律 getStatus()（对齐 business.exceptions.spec.ts 风格）
 * @author Booking System
 * @since 2024
 */

import { IntegrationCommandsService } from './integration-commands.service';
import { BookingCommandRequestDto } from './dto/booking-command-request.dto';
import {
  AuthorizationException,
  ResourceNotFoundException,
  ResourceConflictException,
  BusinessRuleException,
} from '../../common/exceptions/business.exceptions';

describe('IntegrationCommandsService', () => {
  // Mock PrismaService
  const mockPrismaService = {
    integrationCommand: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    staticOperatorMapping: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(mockPrismaService)),
  };

  let service: IntegrationCommandsService;

  // 公共测试数据
  const MAPPING = {
    id: 'map-1',
    salesforceUserId: 'sf-user-001',
    bookingUserId: 'booking-user-1',
    active: true,
  };
  const ADMIN_USER = { id: 'booking-user-1', userType: 'ADMIN', status: 'ACTIVE' };
  const PENDING_APPOINTMENT = {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    version: 1,
    status: 'PENDING',
  };

  // 构造合法 DTO
  function buildDto(overrides: Partial<BookingCommandRequestDto> = {}): BookingCommandRequestDto {
    return {
      commandType: 'CANCEL_BOOKING',
      commandId: 'cmd-001',
      bookingExternalId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      requestedBySalesforceUserId: 'sf-user-001',
      correlationId: 'corr-001',
      expectedVersion: 1,
      ...overrides,
    };
  }

  beforeEach(() => {
    // 默认走通映射/用户/预约查询（各用例按需覆盖）
    mockPrismaService.integrationCommand.findUnique.mockResolvedValue(null);
    mockPrismaService.staticOperatorMapping.findFirst.mockResolvedValue(MAPPING);
    mockPrismaService.user.findUnique.mockResolvedValue(ADMIN_USER);
    mockPrismaService.appointment.findUnique.mockResolvedValue(PENDING_APPOINTMENT);
    mockPrismaService.appointment.update.mockResolvedValue({
      ...PENDING_APPOINTMENT,
      status: 'CANCELLED',
      version: 2,
      cancelledAt: new Date(),
    });
    mockPrismaService.integrationCommand.create.mockResolvedValue({ id: 'cmd-row-1' });

    service = new IntegrationCommandsService(mockPrismaService as any);
  });

  describe('TC-20 幂等先行（RULE-03）', () => {
    it('commandId 命中既有命令行时原样返回初回结果，零 update / 零 create / 不再查询映射与预约', async () => {
      mockPrismaService.integrationCommand.findUnique.mockResolvedValue({
        id: 'row-1',
        commandId: 'cmd-001',
        httpStatus: 200,
        resultCode: 'SUCCESS',
        canonicalVersion: 3,
      });

      const result = await service.executeCancelCommand(buildDto());

      expect(result).toEqual({
        httpStatus: 200,
        canonicalVersion: 3,
        resultCode: 'SUCCESS',
      });
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.integrationCommand.create).not.toHaveBeenCalled();
      expect(mockPrismaService.staticOperatorMapping.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.appointment.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('TC-21 静态映射 NG（RULE-12・403）', () => {
    it('映射不存在时抛 403 授权异常且零 update', async () => {
      mockPrismaService.staticOperatorMapping.findFirst.mockResolvedValue(null);

      const error = await service.executeCancelCommand(buildDto()).catch((e) => e);

      expect(error).toBeInstanceOf(AuthorizationException);
      expect(error.getStatus()).toBe(403);
      // WHERE 形状锁死（防谓词回归）：必须以 salesforceUserId + active:true 查询
      expect(mockPrismaService.staticOperatorMapping.findFirst).toHaveBeenCalledWith({
        where: { salesforceUserId: 'sf-user-001', active: true },
      });
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });

    it('映射存在但 active=false 时（findFirst 按 active:true 查不到）抛 403 且零 update', async () => {
      mockPrismaService.staticOperatorMapping.findFirst.mockResolvedValue(null);

      const error = await service.executeCancelCommand(buildDto()).catch((e) => e);

      expect(error).toBeInstanceOf(AuthorizationException);
      expect(error.getStatus()).toBe(403);
      // WHERE 形状锁死（防谓词回归）：active=false 的映射按 active:true 谓词不可命中
      expect(mockPrismaService.staticOperatorMapping.findFirst).toHaveBeenCalledWith({
        where: { salesforceUserId: 'sf-user-001', active: true },
      });
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });

    it('映射用户非 ADMIN 时抛 403 授权异常且零 update', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'booking-user-1',
        userType: 'CUSTOMER',
        status: 'ACTIVE',
      });

      const error = await service.executeCancelCommand(buildDto()).catch((e) => e);

      expect(error).toBeInstanceOf(AuthorizationException);
      expect(error.getStatus()).toBe(403);
      // WHERE 形状锁死（防谓词回归）：映射查询与用户定位的谓词
      expect(mockPrismaService.staticOperatorMapping.findFirst).toHaveBeenCalledWith({
        where: { salesforceUserId: 'sf-user-001', active: true },
      });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'booking-user-1' },
      });
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });

    it('映射用户 INACTIVE 时抛 403 授权异常且零 update', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'booking-user-1',
        userType: 'ADMIN',
        status: 'INACTIVE',
      });

      const error = await service.executeCancelCommand(buildDto()).catch((e) => e);

      expect(error).toBeInstanceOf(AuthorizationException);
      expect(error.getStatus()).toBe(403);
      // WHERE 形状锁死（防谓词回归）：映射查询与用户定位的谓词
      expect(mockPrismaService.staticOperatorMapping.findFirst).toHaveBeenCalledWith({
        where: { salesforceUserId: 'sf-user-001', active: true },
      });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'booking-user-1' },
      });
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });
  });

  describe('TC-22 预约定位（404）', () => {
    it('bookingExternalId 不存在时抛 404 资源不存在异常', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      const error = await service.executeCancelCommand(buildDto()).catch((e) => e);

      expect(error).toBeInstanceOf(ResourceNotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });
  });

  describe('TC-23 状态迁移 NG（RULE-05/07・409）', () => {
    it('对 COMPLETED 状态预约发起取消时抛 409 业务规则异常且零 update', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue({
        ...PENDING_APPOINTMENT,
        status: 'COMPLETED',
      });

      const error = await service.executeCancelCommand(buildDto()).catch((e) => e);

      expect(error).toBeInstanceOf(BusinessRuleException);
      expect(error.getStatus()).toBe(409);
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });

    it('对 CANCELLED 状态预约以新 commandId 发起取消时抛 409 业务规则异常且零 update', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue({
        ...PENDING_APPOINTMENT,
        status: 'CANCELLED',
      });

      const error = await service.executeCancelCommand(buildDto()).catch((e) => e);

      expect(error).toBeInstanceOf(BusinessRuleException);
      expect(error.getStatus()).toBe(409);
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });
  });

  describe('TC-24 版本门（RULE-02・C-10 无 0 特例・409）', () => {
    it('expectedVersion 与正本 version 同值时受理成功', async () => {
      const result = await service.executeCancelCommand(buildDto({ expectedVersion: 1 }));

      expect(result).toEqual({
        httpStatus: 200,
        canonicalVersion: 2,
        resultCode: 'SUCCESS',
      });
      expect(mockPrismaService.appointment.update).toHaveBeenCalledTimes(1);
    });

    it('expectedVersion 比正本低 1 时抛 409 冲突异常且 details 含 currentVersion', async () => {
      const error = await service.executeCancelCommand(buildDto({ expectedVersion: 0 })).catch((e) => e);

      expect(error).toBeInstanceOf(ResourceConflictException);
      expect(error.getStatus()).toBe(409);
      expect(error.details).toEqual({
        currentVersion: 1,
        correlationId: 'corr-001',
      });
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });

    it('expectedVersion=0 对正本 version=1 时仍抛 409（无 0 特例）', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue({ ...PENDING_APPOINTMENT, version: 1 });

      const error = await service.executeCancelCommand(buildDto({ expectedVersion: 0 })).catch((e) => e);

      expect(error).toBeInstanceOf(ResourceConflictException);
      expect(error.getStatus()).toBe(409);
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });
  });

  describe('TC-25 成功事务（RULE-08）', () => {
    it('使用 $transaction；update data 含 CANCELLED + version 递增 + syncStatus=PENDING + cancelledAt；create 在同一 tx；返回 200+canonicalVersion+SUCCESS', async () => {
      const result = await service.executeCancelCommand(buildDto());

      // $transaction 被使用，且以回调函数调用
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      const txCallback = mockPrismaService.$transaction.mock.calls[0][0];
      expect(typeof txCallback).toBe('function');

      // update data 断言（tx 内正本更新）
      expect(mockPrismaService.appointment.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
        data: {
          status: 'CANCELLED',
          version: { increment: 1 },
          syncStatus: 'PENDING',
          cancelledAt: expect.any(Date),
        },
      });

      // create 在同一 tx（tx === mockPrismaService）内被调用
      expect(mockPrismaService.integrationCommand.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.integrationCommand.create).toHaveBeenCalledWith({
        data: {
          commandId: 'cmd-001',
          commandType: 'CANCEL_BOOKING',
          appointmentId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          httpStatus: 200,
          resultCode: 'SUCCESS',
          canonicalVersion: 2,
          correlationId: 'corr-001',
        },
      });

      expect(result).toEqual({
        httpStatus: 200,
        canonicalVersion: 2,
        resultCode: 'SUCCESS',
      });
    });
  });

  describe('TC-26 DB 例外（事务内异常传播）', () => {
    it('tx 内 update 抛错时异常传播、create 未达、正本逻辑不变', async () => {
      const dbError = new Error('数据库连接失败');
      mockPrismaService.appointment.update.mockRejectedValue(dbError);

      // 正本逻辑不变：幂等/映射/预约查询仍按顺序执行
      await expect(service.executeCancelCommand(buildDto())).rejects.toThrow('数据库连接失败');
      expect(mockPrismaService.integrationCommand.create).not.toHaveBeenCalled();
      expect(mockPrismaService.integrationCommand.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.staticOperatorMapping.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.appointment.findUnique).toHaveBeenCalledTimes(1);
    });

    it('tx 内 integrationCommand.create 拒绝（P2002 模拟）时异常传播、整笔事务不返回成功结果', async () => {
      const conflictError = Object.assign(
        new Error('Unique constraint failed on the fields: (`command_id`)'),
        { code: 'P2002' }
      );
      mockPrismaService.integrationCommand.create.mockRejectedValue(conflictError);

      // update 已在 tx 内执行（事务撤销语义以 mock 呈现：create 失败 → 无成功结果返回）
      await expect(service.executeCancelCommand(buildDto())).rejects.toThrow(
        'Unique constraint failed on the fields: (`command_id`)'
      );
      expect(mockPrismaService.appointment.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.integrationCommand.create).toHaveBeenCalledTimes(1);
    });
  });
});
