/**
 * 数据保留服务测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RetentionService } from './retention.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  appointment: {
    count: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: any) => {
    // 从process.env读取值，如果不存在则返回defaultValue
    const value = process.env[key];
    return value !== undefined ? value : defaultValue;
  }),
};

describe('RetentionService', () => {
  let service: RetentionService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getRetentionDays', () => {
    it('应该返回默认保留天数', () => {
      delete process.env.RETENTION_DAYS;
      expect(service.getRetentionDays()).toBe(30);
    });

    it('应该返回配置的保留天数', () => {
      process.env.RETENTION_DAYS = '60';
      expect(service.getRetentionDays()).toBe(60);
    });

    it('应该处理无效值', () => {
      process.env.RETENTION_DAYS = 'invalid';
      expect(service.getRetentionDays()).toBe(30);
    });

    it('应该处理负值', () => {
      process.env.RETENTION_DAYS = '-10';
      expect(service.getRetentionDays()).toBe(30);
    });

    it('应该处理零值', () => {
      process.env.RETENTION_DAYS = '0';
      expect(service.getRetentionDays()).toBe(30);
    });
  });

  describe('getBatchSize', () => {
    it('应该返回默认批次大小', () => {
      delete process.env.RETENTION_BATCH_SIZE;
      expect(service.getBatchSize()).toBe(500);
    });

    it('应该返回配置的批次大小', () => {
      process.env.RETENTION_BATCH_SIZE = '100';
      expect(service.getBatchSize()).toBe(100);
    });

    it('应该处理无效值', () => {
      process.env.RETENTION_BATCH_SIZE = 'invalid';
      expect(service.getBatchSize()).toBe(500);
    });
  });

  describe('getBatchSleepMs', () => {
    it('应该返回默认批次休眠时间', () => {
      delete process.env.RETENTION_BATCH_SLEEP_MS;
      expect(service.getBatchSleepMs()).toBe(200);
    });

    it('应该返回配置的批次休眠时间', () => {
      process.env.RETENTION_BATCH_SLEEP_MS = '100';
      expect(service.getBatchSleepMs()).toBe(100);
    });

    it('应该处理零值', () => {
      process.env.RETENTION_BATCH_SLEEP_MS = '0';
      expect(service.getBatchSleepMs()).toBe(0);
    });
  });

  describe('isEnabled', () => {
    it('应该默认返回true', () => {
      delete process.env.RETENTION_ENABLED;
      expect(service.isEnabled()).toBe(true);
    });

    it('应该返回false当设置为false', () => {
      process.env.RETENTION_ENABLED = 'false';
      expect(service.isEnabled()).toBe(false);
    });

    it('应该返回false当设置为0', () => {
      process.env.RETENTION_ENABLED = '0';
      expect(service.isEnabled()).toBe(false);
    });

    it('应该返回true当设置为true', () => {
      process.env.RETENTION_ENABLED = 'true';
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('isDryRunEnabled', () => {
    it('应该默认返回false', () => {
      delete process.env.RETENTION_DRY_RUN;
      expect(service.isDryRunEnabled()).toBe(false);
    });

    it('应该返回true当设置为true', () => {
      process.env.RETENTION_DRY_RUN = 'true';
      expect(service.isDryRunEnabled()).toBe(true);
    });

    it('应该返回true当设置为1', () => {
      process.env.RETENTION_DRY_RUN = '1';
      expect(service.isDryRunEnabled()).toBe(true);
    });
  });

  describe('runDry', () => {
    it('应该返回干运行摘要', async () => {
      mockPrismaService.appointment.count.mockResolvedValue(10);

      const result = await service.runDry();

      expect(result.mode).toBe('dry-run');
      expect(result.matchedAppointments).toBe(10);
      expect(result.deletedAppointments).toBe(0);
      expect(result.days).toBeDefined();
      expect(result.batchSize).toBeDefined();
      expect(result.cutoff).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('runExecute', () => {
    it('应该删除匹配的预约', async () => {
      mockPrismaService.appointment.count.mockResolvedValue(2);
      mockPrismaService.appointment.findMany
        .mockResolvedValueOnce([{ id: 'appt-1' }, { id: 'appt-2' }])
        .mockResolvedValueOnce([]);
      mockPrismaService.appointment.deleteMany.mockResolvedValue({ count: 2 });

      process.env.RETENTION_BATCH_SLEEP_MS = '0';
      const result = await service.runExecute();

      expect(result.mode).toBe('execute');
      expect(result.matchedAppointments).toBe(2);
      expect(result.deletedAppointments).toBe(2);
    });

    it('应该处理空结果', async () => {
      mockPrismaService.appointment.count.mockResolvedValue(0);
      mockPrismaService.appointment.findMany.mockResolvedValue([]);

      const result = await service.runExecute();

      expect(result.matchedAppointments).toBe(0);
      expect(result.deletedAppointments).toBe(0);
    });

    it('应该分批处理大量数据', async () => {
      mockPrismaService.appointment.count.mockResolvedValue(3);
      mockPrismaService.appointment.findMany
        .mockResolvedValueOnce([{ id: 'appt-1' }])
        .mockResolvedValueOnce([{ id: 'appt-2' }])
        .mockResolvedValueOnce([{ id: 'appt-3' }])
        .mockResolvedValueOnce([]);
      mockPrismaService.appointment.deleteMany.mockResolvedValue({ count: 1 });

      process.env.RETENTION_BATCH_SIZE = '1';
      process.env.RETENTION_BATCH_SLEEP_MS = '0';
      
      const result = await service.runExecute();

      expect(result.deletedAppointments).toBe(3);
      expect(mockPrismaService.appointment.deleteMany).toHaveBeenCalledTimes(3);
    });
  });

  describe('runRetention', () => {
    it('应该根据配置选择干运行模式', async () => {
      process.env.RETENTION_DRY_RUN = 'true';
      mockPrismaService.appointment.count.mockResolvedValue(5);

      const result = await service.runRetention();

      expect(result.mode).toBe('dry-run');
    });

    it('应该根据配置选择执行模式', async () => {
      process.env.RETENTION_DRY_RUN = 'false';
      mockPrismaService.appointment.count.mockResolvedValue(0);
      mockPrismaService.appointment.findMany.mockResolvedValue([]);

      const result = await service.runRetention();

      expect(result.mode).toBe('execute');
    });
  });
});
