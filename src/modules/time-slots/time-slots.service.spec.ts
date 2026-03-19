/**
 * 时间段服务测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TimeSlotsService } from './time-slots.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeSlotDto, UpdateTimeSlotDto, TimeSlotQueryDto, TimeSlotAvailabilityDto } from './dto/time-slot.dto';
import { BusinessException } from '../../common/exceptions/business.exceptions';

const mockPrismaService = {
  timeSlot: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
  },
  appointment: {
    count: jest.fn(),
  },
};

describe('TimeSlotsService', () => {
  let service: TimeSlotsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeSlotsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TimeSlotsService>(TimeSlotsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTimeSlotDto = {
      slotTime: '09:00:00',
      durationMinutes: 30,
      isActive: true,
    };

    it('应该成功创建时间段', async () => {
      mockPrismaService.timeSlot.findFirst.mockResolvedValue(null);
      mockPrismaService.timeSlot.create.mockResolvedValue({
        id: 'slot-id',
        ...createDto,
        displayOrder: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createDto);

      expect(result.slotTime).toBe('09:00:00');
    });

    it('应该抛出时间段冲突异常', async () => {
      mockPrismaService.timeSlot.findFirst.mockResolvedValue({ id: 'existing-slot' });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('应该返回所有时间段', async () => {
      const mockSlots = [
        { id: 'slot-1', slotTime: '09:00:00', durationMinutes: 30, isActive: true, displayOrder: 1 },
        { id: 'slot-2', slotTime: '10:00:00', durationMinutes: 30, isActive: true, displayOrder: 2 },
      ];

      mockPrismaService.timeSlot.findMany.mockResolvedValue(mockSlots);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
    });

    it('应该根据查询条件过滤', async () => {
      const query: TimeSlotQueryDto = { isActive: true };
      const mockSlots = [
        { id: 'slot-1', slotTime: '09:00:00', durationMinutes: 30, isActive: true, displayOrder: 1 },
      ];

      mockPrismaService.timeSlot.findMany.mockResolvedValue(mockSlots);

      const result = await service.findAll(query);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.timeSlot.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ isActive: true }),
        orderBy: { slotTime: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('应该返回时间段详情', async () => {
      const mockSlot = {
        id: 'slot-id',
        slotTime: '09:00:00',
        durationMinutes: 30,
        isActive: true,
        displayOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.timeSlot.findUnique.mockResolvedValue(mockSlot);

      const result = await service.findOne('slot-id');

      expect(result.id).toBe('slot-id');
    });

    it('应该抛出时间段不存在异常', async () => {
      mockPrismaService.timeSlot.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateTimeSlotDto = {
      slotTime: '10:00:00',
    };

    it('应该成功更新时间段', async () => {
      const existingSlot = {
        id: 'slot-id',
        slotTime: '09:00:00',
        durationMinutes: 30,
        isActive: true,
      };

      mockPrismaService.timeSlot.findUnique.mockResolvedValue(existingSlot);
      mockPrismaService.timeSlot.findFirst.mockResolvedValue(null);
      mockPrismaService.timeSlot.update.mockResolvedValue({
        ...existingSlot,
        slotTime: '10:00:00',
      });

      const result = await service.update('slot-id', updateDto);

      expect(result.slotTime).toBe('10:00:00');
    });

    it('应该抛出时间段不存在异常', async () => {
      mockPrismaService.timeSlot.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('应该抛出时间段冲突异常', async () => {
      const existingSlot = {
        id: 'slot-id',
        slotTime: '09:00:00',
        durationMinutes: 30,
        isActive: true,
      };

      mockPrismaService.timeSlot.findUnique.mockResolvedValue(existingSlot);
      mockPrismaService.timeSlot.findFirst.mockResolvedValue({ id: 'conflict-slot' });

      await expect(service.update('slot-id', updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('应该成功删除时间段', async () => {
      mockPrismaService.timeSlot.findUnique.mockResolvedValue({ id: 'slot-id' });
      mockPrismaService.timeSlot.delete.mockResolvedValue({ id: 'slot-id' });

      await service.remove('slot-id');

      expect(mockPrismaService.timeSlot.delete).toHaveBeenCalledWith({
        where: { id: 'slot-id' },
      });
    });

    it('应该抛出时间段不存在异常', async () => {
      mockPrismaService.timeSlot.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAvailability', () => {
    it('应该返回时间段可用性', async () => {
      const query: TimeSlotAvailabilityDto = {
        date: '2024-01-15',
      };

      const mockSlots = [
        { id: 'slot-1', slotTime: '09:00:00', durationMinutes: 30, isActive: true },
        { id: 'slot-2', slotTime: '10:00:00', durationMinutes: 30, isActive: true },
      ];

      mockPrismaService.timeSlot.findMany.mockResolvedValue(mockSlots);
      mockPrismaService.appointment.count.mockResolvedValue(0);

      const result = await service.getAvailability(query);

      expect(result).toHaveLength(2);
      expect(result[0].isAvailable).toBe(true);
    });

    it('应该返回已预约状态', async () => {
      const query: TimeSlotAvailabilityDto = {
        date: '2024-01-15',
      };

      const mockSlots = [
        { id: 'slot-1', slotTime: '09:00:00', durationMinutes: 30, isActive: true },
      ];

      mockPrismaService.timeSlot.findMany.mockResolvedValue(mockSlots);
      mockPrismaService.appointment.count.mockResolvedValue(1);

      const result = await service.getAvailability(query);

      expect(result[0].isAvailable).toBe(false);
    });
  });

  describe('initializeDefaultTimeSlots', () => {
    it('应该初始化默认时间段', async () => {
      mockPrismaService.timeSlot.count.mockResolvedValue(0);
      mockPrismaService.timeSlot.createMany.mockResolvedValue({ count: 16 });

      await service.initializeDefaultTimeSlots();

      expect(mockPrismaService.timeSlot.createMany).toHaveBeenCalled();
    });

    it('不应该重复初始化', async () => {
      mockPrismaService.timeSlot.count.mockResolvedValue(10);

      await service.initializeDefaultTimeSlots();

      expect(mockPrismaService.timeSlot.createMany).not.toHaveBeenCalled();
    });
  });
});
