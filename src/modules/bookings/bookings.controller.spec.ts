/**
 * 预约控制器测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  AppointmentResponseDto,
  AppointmentQueryDto,
  AppointmentListResponseDto,
  AppointmentStatisticsDto,
  AppointmentStatusEnum
} from './dto/booking.dto';
import { UserRole } from '../users/dto/user.dto';
import { ResourceNotFoundException } from '../../common/exceptions/business.exceptions';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: BookingsService;

  // Mock数据
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    roles: [UserRole.USER],
  };

  const mockAdmin = {
    id: 'admin-123',
    email: 'admin@example.com',
    roles: [UserRole.ADMIN],
  };

  const mockAppointment: AppointmentResponseDto = {
    id: 'appointment-123',
    appointmentNumber: 'APT-001',
    timeSlotId: 'slot-123',
    userId: 'user-123',
    appointmentDate: new Date(),
    status: AppointmentStatusEnum.PENDING,  // 修复类型错误
    customerName: 'John Doe',
    customerPhone: '13800138000',
    customerEmail: 'john@example.com',
    notes: 'Test appointment',
    confirmationSent: false,
    reminderSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    timeSlot: {
      slotTime: '09:00',
      durationMinutes: 30,
    },
    user: {
      name: 'John Doe',
      phoneNumber: '13800138000',
    },
  };

  const mockStats: AppointmentStatisticsDto = {
    totalAppointments: 100,
    pendingAppointments: 20,
    confirmedAppointments: 60,
    cancelledAppointments: 15,
    completedAppointments: 5,
    todayAppointments: 10,
    thisWeekAppointments: 45,
    thisMonthAppointments: 80,
  };

  // Mock服务
  const mockBookingsService = {
    createBooking: jest.fn(),
    findBookings: jest.fn(),
    findBookingById: jest.fn(),
    updateBooking: jest.fn(),
    cancelBooking: jest.fn(),
    getBookingStats: jest.fn(),
  };

  const mockTimeSlotsService = {
    getAvailability: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: mockBookingsService,
        },
        {
          provide: TimeSlotsService,
          useValue: mockTimeSlotsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideInterceptor(TransformInterceptor)
      .useValue({ intercept: jest.fn((context, next) => next.handle()) })
      .compile();

    controller = module.get<BookingsController>(BookingsController);
    service = module.get<BookingsService>(BookingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应该成功创建预约', async () => {
      const createDto: CreateAppointmentDto = {
        userId: 'user-123',
        customerName: 'John Doe',
        customerPhone: '13800138000',
        customerEmail: 'john@example.com',
        timeSlotId: 'slot-123',
        appointmentDate: '2024-01-15',
        notes: 'Test appointment',
      };

      mockBookingsService.createBooking.mockResolvedValue(mockAppointment);

      const result = await controller.create(createDto, mockUser);

      expect(service.createBooking).toHaveBeenCalledWith(createDto, mockUser.id);
      expect(result.data).toEqual(mockAppointment);
      expect(result.message).toBe('创建预约成功');
      expect(result.code).toBe(200);
    });

    it('应该为没有userId的DTO设置当前用户ID', async () => {
      const createDto: CreateAppointmentDto = {
        customerName: 'John Doe',
        customerPhone: '13800138000',
        customerEmail: 'john@example.com',
        timeSlotId: 'slot-123',
        appointmentDate: '2024-01-15',
      };

      mockBookingsService.createBooking.mockResolvedValue(mockAppointment);

      await controller.create(createDto, mockUser);

      expect(createDto.userId).toBe(mockUser.id);
      expect(service.createBooking).toHaveBeenCalledWith(createDto, mockUser.id);
    });
  });

  describe('findAll', () => {
    it('应该返回预约列表', async () => {
      const query: AppointmentQueryDto = {
        page: 1,
        limit: 10,
      };

      const mockResult: AppointmentListResponseDto = {
        items: [mockAppointment],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockBookingsService.findBookings.mockResolvedValue(mockResult);

      const result = await controller.findAll(query, mockAdmin);

      expect(service.findBookings).toHaveBeenCalledWith(query, mockAdmin.id);
      expect(result).toEqual(mockResult);
    });

    it('非管理员用户只能查看自己的预约', async () => {
      const query: AppointmentQueryDto = {
        page: 1,
        limit: 10,
      };

      const mockResult: AppointmentListResponseDto = {
        items: [mockAppointment],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockBookingsService.findBookings.mockResolvedValue(mockResult);

      await controller.findAll(query, mockUser);

      expect(query.userId).toBe(mockUser.id);
      expect(service.findBookings).toHaveBeenCalledWith(query, mockUser.id);
    });
  });

  describe('findOne', () => {
    it('应该返回预约详情', async () => {
      // 修复测试，确保用户ID匹配
      const mockBookingWithUser = {
        ...mockAppointment,
        userId: mockUser.id  // 确保用户ID匹配
      };
      
      mockBookingsService.findBookingById.mockResolvedValue(mockBookingWithUser);

      const result = await controller.findOne('appointment-123', mockUser);

      expect(service.findBookingById).toHaveBeenCalledWith('appointment-123', mockUser.id);
      expect(result).toEqual(mockBookingWithUser);
    });

    it('应该抛出预约不存在的异常', async () => {
      mockBookingsService.findBookingById.mockResolvedValue(null);

      await expect(controller.findOne('non-existent', mockUser)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('应该成功更新预约', async () => {
      const updateDto: UpdateAppointmentDto = {
        status: AppointmentStatusEnum.CONFIRMED,
        notes: '更新的备注',
      };

      // 修复测试，确保用户ID匹配
      const mockBookingWithUser = {
        ...mockAppointment,
        userId: mockUser.id  // 确保用户ID匹配
      };
      
      const updatedBooking = {
        ...mockAppointment,
        status: AppointmentStatusEnum.CONFIRMED,
        notes: '更新的备注',
        userId: mockUser.id
      };

      mockBookingsService.findBookingById.mockResolvedValue(mockBookingWithUser);
      mockBookingsService.updateBooking.mockResolvedValue(updatedBooking);

      const result = await controller.update('appointment-123', updateDto, mockUser);

      expect(service.findBookingById).toHaveBeenCalledWith('appointment-123', mockUser.id);
      expect(service.updateBooking).toHaveBeenCalledWith('appointment-123', updateDto, mockUser.id);
      expect(result.data).toEqual(updatedBooking);
      expect(result.message).toBe('更新预约成功');
      expect(result.code).toBe(200);
    });

    it('应该抛出预约不存在的异常', async () => {
      const updateDto: UpdateAppointmentDto = {
        status: AppointmentStatusEnum.CONFIRMED,
      };

      mockBookingsService.findBookingById.mockResolvedValue(null);

      await expect(controller.update('non-existent', updateDto, mockUser)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('应该成功取消预约', async () => {
      // 修复测试，确保用户ID匹配
      const mockBookingWithUser = {
        ...mockAppointment,
        userId: mockUser.id  // 确保用户ID匹配
      };
      
      mockBookingsService.findBookingById.mockResolvedValue(mockBookingWithUser);
      mockBookingsService.cancelBooking.mockResolvedValue(mockBookingWithUser);  // 修复返回值

      await controller.remove('appointment-123', mockUser);

      expect(service.findBookingById).toHaveBeenCalledWith('appointment-123', mockUser.id);
      expect(service.cancelBooking).toHaveBeenCalledWith('appointment-123', mockUser.id, undefined, mockUser.id);
    });

    it('应该抛出预约不存在的异常', async () => {
      mockBookingsService.findBookingById.mockResolvedValue(null);

      await expect(controller.remove('non-existent', mockUser)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('应该返回预约统计信息', async () => {
      mockBookingsService.getBookingStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(mockAdmin);

      expect(service.getBookingStats).toHaveBeenCalled();
      expect(result.data).toEqual(mockStats);
    });
  });
});