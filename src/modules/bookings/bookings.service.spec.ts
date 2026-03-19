/**
 * 预约服务单元测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateAppointmentDto, UpdateAppointmentDto, AppointmentStatusEnum } from './dto/booking.dto';
import {
  ResourceNotFoundException,
  TimeSlotConflictException,
  AppointmentException,
  ResourceConflictException,
  DatabaseException,
} from '../../common/exceptions/business.exceptions';import { AppointmentStatus } from '@prisma/client';

describe('BookingsService', () => {
  let service: BookingsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    timeSlot: {
      findUnique: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    service: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  // Create a transaction mock that passes the same mockPrismaService as the tx client
  const mockTransaction = jest.fn((fn) => fn(mockPrismaService));
  mockPrismaService['$transaction'] = mockTransaction;

  const mockEmailService = {
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
    sendBookingUpdate: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    const createBookingDto: CreateAppointmentDto = {
      timeSlotId: 'timeslot-123',
      userId: 'user-123',
      appointmentDate: '2024-01-15',
      customerName: '张三',
      customerPhone: '13800138000',
      customerEmail: 'test@example.com',
      notes: '测试预约',
    };

    const mockBooking = {
      id: 'booking-123',
      appointmentNumber: 'AP-20240115-0001',
      timeSlotId: 'timeslot-123',
      userId: 'user-123',
      status: AppointmentStatus.PENDING,
      appointmentDate: new Date('2024-01-15'),
      customerName: '张三',
      customerPhone: '13800138000',
      customerEmail: 'test@example.com',
      notes: '测试预约',
      confirmationSent: false,
      reminderSent: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { name: '张三', phoneNumber: '13800138000' },
      timeSlot: { slotTime: '09:00:00', durationMinutes: 30 },
    };

    it('应该成功创建预约', async () => {
      const mockTimeSlot = {
        id: 'timeslot-123',
        isActive: true,
        slotTime: '09:00:00',
        durationMinutes: 30,
      };

      mockPrismaService.timeSlot.findUnique.mockResolvedValue(mockTimeSlot);
      mockPrismaService.appointment.count.mockResolvedValue(0); // No existing appointments
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);
      mockPrismaService.appointment.create.mockResolvedValue(mockBooking);

      const result = await service.createBooking(createBookingDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('booking-123');
      expect(result.customerName).toBe('张三');
    });

    it('应该抛出时间段不存在的异常', async () => {
      mockPrismaService.timeSlot.findUnique.mockResolvedValue(null);

      await expect(service.createBooking(createBookingDto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('应该抛出时间段不可用的异常', async () => {
      const mockTimeSlot = {
        id: 'timeslot-123',
        isActive: false,
        slotTime: '09:00:00',
        durationMinutes: 30,
      };

      mockPrismaService.timeSlot.findUnique.mockResolvedValue(mockTimeSlot);

      await expect(service.createBooking(createBookingDto)).rejects.toThrow(
        TimeSlotConflictException,
      );
    });

    it('应该抛出时间段容量已满的异常', async () => {
      const mockTimeSlot = {
        id: 'timeslot-123',
        isActive: true,
        slotTime: '09:00:00',
        durationMinutes: 30,
      };

      mockPrismaService.timeSlot.findUnique.mockResolvedValue(mockTimeSlot);
      mockPrismaService.appointment.count.mockResolvedValue(1); // maxCapacity is 1, so 1 >= 1 means full

      await expect(service.createBooking(createBookingDto)).rejects.toThrow(
        TimeSlotConflictException,
      );
    });

    it('应该抛出用户冲突预约的异常', async () => {
      const mockTimeSlot = {
        id: 'timeslot-123',
        isActive: true,
        slotTime: '09:00:00',
        durationMinutes: 30,
      };

      const mockService = {
        id: 'service-123',
        name: 'Test Service',
        isActive: true,
      };

      // Mock for service conflict check (when serviceId is provided)
      mockPrismaService.service.findUnique.mockResolvedValue(mockService);
      mockPrismaService.timeSlot.findUnique.mockResolvedValue(mockTimeSlot);
      mockPrismaService.appointment.count.mockResolvedValue(0); // Not full
      mockPrismaService.appointment.findFirst.mockResolvedValue({ id: 'existing' }); // Service conflict

      // Add serviceId to trigger the conflict check
      const createDtoWithService = {
        ...createBookingDto,
        serviceId: 'service-123',
      };

      await expect(service.createBooking(createDtoWithService)).rejects.toThrow(
        TimeSlotConflictException,
      );
    });

    it('应该处理数据库异常', async () => {
      mockPrismaService.timeSlot.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.createBooking(createBookingDto)).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('findBookingById', () => {
    it('应该成功查找预约', async () => {
      const mockBooking = {
        id: 'booking-123',
        appointmentNumber: 'AP-20240115-0001',
        timeSlotId: 'timeslot-123',
        userId: 'user-123',
        status: AppointmentStatus.PENDING,
        appointmentDate: new Date('2024-01-15'),
        customerName: '张三',
        customerPhone: '13800138000',
        customerEmail: 'test@example.com',
        notes: '测试预约',
        confirmationSent: false,
        reminderSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { name: '张三', phoneNumber: '13800138000' },
        timeSlot: { slotTime: '09:00:00', durationMinutes: 30 },
        service: null,
      };

      mockPrismaService.appointment.findUnique.mockResolvedValue(mockBooking);

      const result = await service.findBookingById('booking-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('booking-123');
      expect(result.customerName).toBe('张三');
      expect(prismaService.appointment.findUnique).toHaveBeenCalledWith({
        where: { id: 'booking-123' },
        include: {
          timeSlot: true,
          user: true,
          service: true,
        },
      });
    });

    it('应该抛出预约不存在的异常', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      await expect(service.findBookingById('non-existent')).rejects.toThrow(
        ResourceNotFoundException,
      );
    });

    it('应该处理数据库异常', async () => {
      mockPrismaService.appointment.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findBookingById('booking-123')).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('updateBooking', () => {
    const updateDto: UpdateAppointmentDto = {
      status: AppointmentStatusEnum.CONFIRMED,  // 修复类型错误
      customerName: '李四',
      notes: '更新的备注',
    };

    it('应该成功更新预约', async () => {
      const existingBooking = {
        id: 'booking-123',
        status: AppointmentStatus.PENDING,
      };

      const updatedBooking = {
        id: 'booking-123',
        appointmentNumber: 'AP-20240115-0001',
        timeSlotId: 'timeslot-123',
        userId: 'user-123',
        status: AppointmentStatus.CONFIRMED,
        appointmentDate: new Date('2024-01-15'),
        customerName: '李四',
        customerPhone: '13800138000',
        notes: '更新的备注',
        confirmationSent: false,
        reminderSent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { name: '李四', phoneNumber: '13800138000' },
        timeSlot: { slotTime: '09:00:00', durationMinutes: 30 },
      };

      mockPrismaService.appointment.findUnique.mockResolvedValue(existingBooking);
      mockPrismaService.appointment.update.mockResolvedValue(updatedBooking);

      const result = await service.updateBooking('booking-123', updateDto);

      expect(result).toBeDefined();
      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(result.customerName).toBe('李四');
    });

    it('应该抛出预约不存在的异常', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      await expect(service.updateBooking('non-existent', updateDto)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe('findBookings', () => {
    const query = {
      userId: 'user-123',
      status: AppointmentStatusEnum.CONFIRMED,  // 修复类型错误
      page: 1,
      limit: 10,
    };

    it('应该成功查找预约列表', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          appointmentNumber: 'AP-20240115-0001',
          status: AppointmentStatus.CONFIRMED,
          customerName: '张三',
          timeSlot: { slotTime: '09:00:00', durationMinutes: 30 },
          user: { name: '张三', phoneNumber: '13800138000' },
        },
      ];

      mockPrismaService.appointment.findMany.mockResolvedValue(mockBookings);
      mockPrismaService.appointment.count.mockResolvedValue(1);

      const result = await service.findBookings(query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该处理数据库异常', async () => {
      mockPrismaService.appointment.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.findBookings(query)).rejects.toThrow(
        DatabaseException,
      );
    });
  });

  describe('getBookingStats', () => {
    it('应该成功获取预约统计', async () => {
      const mockStats = {
        totalAppointments: 10,
        pendingAppointments: 3,
        confirmedAppointments: 5,
        completedAppointments: 1,
        cancelledAppointments: 1,
        todayAppointments: 2,
        thisWeekAppointments: 8,
        thisMonthAppointments: 10,
      };

      // Mock各种统计查询
      mockPrismaService.appointment.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3)  // pending
        .mockResolvedValueOnce(5)  // confirmed
        .mockResolvedValueOnce(1)  // completed
        .mockResolvedValueOnce(1)  // cancelled
        .mockResolvedValueOnce(2)  // today
        .mockResolvedValueOnce(8)  // this week
        .mockResolvedValueOnce(10); // this month

      const result = await service.getBookingStats();

      expect(result).toBeDefined();
      expect(result.totalAppointments).toBe(10);
      expect(result.pendingAppointments).toBe(3);
    });

    it('应该处理数据库异常', async () => {
      mockPrismaService.appointment.count.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getBookingStats()).rejects.toThrow(
        DatabaseException,
      );
    });
  });
});