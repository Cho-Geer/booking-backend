/**
 * 服务管理服务测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateServiceDto, UpdateServiceDto, ToggleServiceStatusDto, ServiceQueryDto } from './dto/service.dto';
import { DatabaseException } from '../../common/exceptions/business.exceptions';
import { AppointmentStatus } from '@prisma/client';

const mockPrismaService = {
  service: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  appointment: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrismaService)),
};

const mockEmailService = {
  sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
  sendBookingUpdate: jest.fn().mockResolvedValue(undefined),
};

describe('ServicesService', () => {
  let service: ServicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('应该返回所有活跃服务', async () => {
      const mockServices = [
        { id: 'service-1', name: '服务1', isActive: true },
        { id: 'service-2', name: '服务2', isActive: true },
      ];

      mockPrismaService.service.findMany.mockResolvedValue(mockServices);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        include: { category: true },
      });
    });
  });

  describe('findAllForAdmin', () => {
    it('应该返回分页服务列表', async () => {
      const mockServices = [
        { id: 'service-1', name: '服务1', isActive: true, category: null },
      ];

      mockPrismaService.service.count.mockResolvedValue(1);
      mockPrismaService.service.findMany.mockResolvedValue(mockServices);

      const query: ServiceQueryDto = { page: 1, limit: 10 };
      const result = await service.findAllForAdmin(query);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该根据查询条件过滤', async () => {
      const mockServices = [
        { id: 'service-1', name: '测试服务', isActive: true, category: null },
      ];

      mockPrismaService.service.count.mockResolvedValue(1);
      mockPrismaService.service.findMany.mockResolvedValue(mockServices);

      const query: ServiceQueryDto = { name: '测试服务' };
      const result = await service.findAllForAdmin(query);

      expect(result.items).toHaveLength(1);
    });
  });

  describe('createService', () => {
    const createDto: CreateServiceDto = {
      name: '新服务',
      description: '服务描述',
      durationMinutes: 30,
      price: 100,
      imageUrl: 'http://example.com/image.jpg',
    };

    it('应该成功创建服务', async () => {
      const mockService = {
        id: 'service-id',
        ...createDto,
        isActive: true,
        displayOrder: null,
        category: null,
      };

      mockPrismaService.service.create.mockResolvedValue(mockService);

      const result = await service.createService(createDto);

      expect(result.name).toBe('新服务');
    });
  });

  describe('updateService', () => {
    const updateDto: UpdateServiceDto = {
      name: '更新服务',
    };

    it('应该成功更新服务', async () => {
      const existingService = {
        id: 'service-id',
        name: '旧服务',
        isActive: true,
        category: null,
      };

      mockPrismaService.service.findUnique.mockResolvedValue(existingService);
      mockPrismaService.service.update.mockResolvedValue({
        ...existingService,
        name: '更新服务',
      });

      const result = await service.updateService('service-id', updateDto);

      expect(result.name).toBe('更新服务');
    });

    it('应该抛出服务不存在异常', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.updateService('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleServiceStatus', () => {
    const toggleDto: ToggleServiceStatusDto = {
      isActive: false,
    };

    it('应该成功切换服务状态', async () => {
      const existingService = {
        id: 'service-id',
        name: '服务',
        isActive: true,
        category: null,
      };

      mockPrismaService.service.findUnique.mockResolvedValue(existingService);
      mockPrismaService.appointment.findMany.mockResolvedValue([]);
      mockPrismaService.service.update.mockResolvedValue({
        ...existingService,
        isActive: false,
      });

      const result = await service.toggleServiceStatus('service-id', toggleDto);

      expect(result.isActive).toBe(false);
    });

    it('应该取消关联预约当禁用服务时', async () => {
      const existingService = {
        id: 'service-id',
        name: '服务',
        isActive: true,
      };

      const activeBooking = {
        id: 'booking-id',
        customerEmail: 'test@example.com',
        customerName: '测试用户',
        appointmentDate: new Date(),
        timeSlot: { slotTime: '09:00:00' },
        service: { name: '服务' },
        appointmentNumber: 'AP-001',
      };

      mockPrismaService.service.findUnique.mockResolvedValue(existingService);
      mockPrismaService.appointment.findMany.mockResolvedValue([activeBooking]);
      mockPrismaService.appointment.update.mockResolvedValue({
        ...activeBooking,
        status: AppointmentStatus.CANCELLED,
      });
      mockPrismaService.service.update.mockResolvedValue({
        ...existingService,
        isActive: false,
      });

      const result = await service.toggleServiceStatus('service-id', toggleDto);

      expect(result.isActive).toBe(false);
      expect(mockEmailService.sendBookingCancellation).toHaveBeenCalled();
    });

    it('应该抛出服务不存在异常', async () => {
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.toggleServiceStatus('non-existent', toggleDto)).rejects.toThrow(NotFoundException);
    });
  });
});
