/**
 * 预约服务
 * 处理预约相关业务逻辑
 * @author Booking System
 * @since 2024
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  CreateAppointmentDto, 
  UpdateAppointmentDto, 
  AppointmentResponseDto, 
  AppointmentQueryDto,
  AppointmentListResponseDto,
  AppointmentStatisticsDto,
  AppointmentStatusEnum
} from './dto/booking.dto';
import { 
  ResourceNotFoundException, 
  TimeSlotConflictException, 
  BusinessRuleException,
  AuthorizationException,
  DatabaseException
} from '../../common/exceptions/business.exceptions';
import { Prisma, AppointmentStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建预约
   * @param createAppointmentDto 创建预约数据
   * @returns 创建的预约信息
   */
  async createBooking(createAppointmentDto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
    try {
      // 检查时间段是否存在
      const timeSlot = await this.prisma.timeSlot.findUnique({
        where: { id: createAppointmentDto.timeSlotId }
      });

      if (!timeSlot) {
        throw new ResourceNotFoundException('时间段');
      }

      // 检查时间段是否可用
      if (!timeSlot.isActive) {
        throw new TimeSlotConflictException('时间段不可用');
      }

      // 检查时间段容量（假设默认容量为10）
      const maxCapacity = 10;
      const existingAppointments = await this.prisma.appointment.count({
        where: {
          timeSlotId: createAppointmentDto.timeSlotId,
          appointmentDate: new Date(createAppointmentDto.appointmentDate),
          status: {
            in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]
          }
        }
      });

      if (existingAppointments >= maxCapacity) {
        throw new TimeSlotConflictException('时间段已满');
      }

      // 检查用户是否有冲突的预约（如果提供了用户ID）
      if (createAppointmentDto.userId) {
        const conflictingAppointment = await this.prisma.appointment.findFirst({
          where: {
            userId: createAppointmentDto.userId,
            timeSlotId: createAppointmentDto.timeSlotId,
            appointmentDate: new Date(createAppointmentDto.appointmentDate),
            status: {
              in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]
            }
          }
        });

        if (conflictingAppointment) {
          throw new TimeSlotConflictException('用户在该时间段已有预约');
        }
      }

      // 生成预约编号
      const appointmentNumber = await this.generateAppointmentNumber();

      // 创建预约 - 使用正确的字段映射
      const appointment = await this.prisma.appointment.create({
        data: {
          appointmentNumber,
          userId: createAppointmentDto.userId,
          appointmentDate: new Date(createAppointmentDto.appointmentDate),
          timeSlotId: createAppointmentDto.timeSlotId,
          customerName: createAppointmentDto.customerName,
          customerPhone: createAppointmentDto.customerPhone,
          customerEmail: createAppointmentDto.customerEmail,
          customerWechat: createAppointmentDto.customerWechat,
          notes: createAppointmentDto.notes,
          status: AppointmentStatus.PENDING
        },
        include: {
          timeSlot: true,
          user: true
        }
      });

      return this.mapToResponseDto(appointment);
    } catch (error) {
      if (error instanceof ResourceNotFoundException || 
          error instanceof TimeSlotConflictException || 
          error instanceof BusinessRuleException) {
        throw error;
      }
      this.logger.error('创建预约失败', error);
      throw new DatabaseException('创建预约失败');
    }
  }

  /**
   * 根据ID查找预约
   * @param id 预约ID
   * @returns 预约信息
   */
  async findBookingById(id: string): Promise<AppointmentResponseDto> {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id },
        include: {
          timeSlot: true,
          user: true
        }
      });

      if (!appointment) {
        throw new ResourceNotFoundException('预约');
      }

      return this.mapToResponseDto(appointment);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      this.logger.error('查找预约失败', error);
      throw new DatabaseException('查找预约失败');
    }
  }

  /**
   * 更新预约
   * @param id 预约ID
   * @param updateAppointmentDto 更新数据
   * @returns 更新后的预约信息
   */
  async updateBooking(id: string, updateAppointmentDto: UpdateAppointmentDto): Promise<AppointmentResponseDto> {
    try {
      this.logger.log(`开始更新预约 ${id}: ${JSON.stringify(updateAppointmentDto)}`);
      
      // 检查预约是否存在
      const existingAppointment = await this.prisma.appointment.findUnique({
        where: { id }
      });

      if (!existingAppointment) {
        this.logger.warn(`预约不存在: ${id}`);
        throw new ResourceNotFoundException('预约');
      }

      this.logger.log(`更新预约数据: ${JSON.stringify(updateAppointmentDto)}`);
      
      // 构建更新数据，只更新提供的字段
      const updateData: any = {};
      if (updateAppointmentDto.status !== undefined) {
        // 确保状态值是有效的枚举值
        updateData.status = updateAppointmentDto.status;
        this.logger.log(`设置状态: ${updateAppointmentDto.status}`);
      }
      if (updateAppointmentDto.customerName !== undefined) {
        updateData.customerName = updateAppointmentDto.customerName;
        this.logger.log(`设置客户姓名: ${updateAppointmentDto.customerName}`);
      }
      if (updateAppointmentDto.customerPhone !== undefined) {
        updateData.customerPhone = updateAppointmentDto.customerPhone;
        this.logger.log(`设置客户电话: ${updateAppointmentDto.customerPhone}`);
      }
      if (updateAppointmentDto.customerEmail !== undefined) {
        updateData.customerEmail = updateAppointmentDto.customerEmail;
        this.logger.log(`设置客户邮箱: ${updateAppointmentDto.customerEmail}`);
      }
      if (updateAppointmentDto.customerWechat !== undefined) {
        updateData.customerWechat = updateAppointmentDto.customerWechat;
        this.logger.log(`设置客户微信: ${updateAppointmentDto.customerWechat}`);
      }
      if (updateAppointmentDto.notes !== undefined) {
        updateData.notes = updateAppointmentDto.notes;
        this.logger.log(`设置备注: ${updateAppointmentDto.notes}`);
      }
      
      this.logger.log(`构建的更新数据: ${JSON.stringify(updateData)}`);
      
      // 更新预约
      const appointment = await this.prisma.appointment.update({
        where: { id },
        data: updateData,
        include: {
          timeSlot: true,
          user: true
        }
      });

      this.logger.log(`预约更新成功: ${appointment.id}`);
      return this.mapToResponseDto(appointment);
    } catch (error) {
      this.logger.error(`更新预约失败: ${error.message}`, error.stack);
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      throw new DatabaseException('更新预约失败');
    }
  }

  /**
   * 取消预约
   * @param id 预约ID
   * @param userId 用户ID（用于权限检查）
   * @returns 取消后的预约信息
   */
  async cancelBooking(id: string, userId?: string): Promise<AppointmentResponseDto> {
    try {
      // 检查预约是否存在
      const existingAppointment = await this.prisma.appointment.findUnique({
        where: { id },
        include: {
          timeSlot: true,
          user: true
        }
      });

      if (!existingAppointment) {
        throw new ResourceNotFoundException('预约');
      }

      // 权限检查：只有预约者本人或管理员可以取消
      if (userId && existingAppointment.userId && existingAppointment.userId !== userId) {
        throw new AuthorizationException('无权取消此预约');
      }

      // 检查预约状态
      if (existingAppointment.status === AppointmentStatus.CANCELLED) {
        throw new BusinessRuleException('预约已被取消');
      }

      if (existingAppointment.status === AppointmentStatus.COMPLETED) {
        throw new BusinessRuleException('已完成的预约无法取消');
      }

      // 取消预约
      const appointment = await this.prisma.appointment.update({
        where: { id },
        data: { 
          status: AppointmentStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          timeSlot: true,
          user: true
        }
      });

      return this.mapToResponseDto(appointment);
    } catch (error) {
      if (error instanceof ResourceNotFoundException || 
          error instanceof AuthorizationException ||
          error instanceof BusinessRuleException) {
        throw error;
      }
      this.logger.error('取消预约失败', error);
      throw new DatabaseException('取消预约失败');
    }
  }

  /**
   * 查询预约列表
   * @param query 查询条件
   * @returns 预约列表
   */
  async findBookings(query: AppointmentQueryDto): Promise<AppointmentListResponseDto> {
    try {
      const { page = 1, limit = 10, status, userId, timeSlotId, startDate, endDate } = query;
      // 确保page和limit是数字类型
      const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
      const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
      const skip = (pageNum - 1) * limitNum;

      this.logger.log(`查询预约列表: page=${pageNum}, limit=${limitNum}, status=${status}, userId=${userId}, timeSlotId=${timeSlotId}, startDate=${startDate}, endDate=${endDate}`);

      // 构建查询条件
      const where: Prisma.AppointmentWhereInput = {};

      if (status) {
        where.status = status;
      }

      if (userId) {
        where.userId = userId;
      }

      if (timeSlotId) {
        where.timeSlotId = timeSlotId;
      }

      if (startDate || endDate) {
        where.appointmentDate = {};
        if (startDate) {
          where.appointmentDate.gte = new Date(startDate);
        }
        if (endDate) {
          where.appointmentDate.lte = new Date(endDate);
        }
      }

      this.logger.log(`构建的查询条件: ${JSON.stringify(where)}`);

      // 查询总数
      const total = await this.prisma.appointment.count({ where });
      this.logger.log(`查询到的总数: ${total}`);

      // 查询数据
      const appointments = await this.prisma.appointment.findMany({
        where,
        include: {
          timeSlot: true,
          user: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum  // 使用转换后的数字类型
      });

      this.logger.log(`查询到的预约数量: ${appointments.length}`);

      const items = appointments.map(appointment => {
        try {
          return this.mapToResponseDto(appointment);
        } catch (error) {
          this.logger.error(`映射预约数据失败: ${error.message}`, error);
          throw error;
        }
      });
      this.logger.log(`映射后的预约数量: ${items.length}`);

      // 直接返回对象而不是使用构造函数
      const result = {
        items,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      };
      
      this.logger.log(`最终返回结果: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('查询预约列表失败', error);
      throw new DatabaseException('查询预约列表失败');
    }
  }

  /**
   * 获取用户预约列表
   * @param userId 用户ID
   * @param query 查询条件
   * @returns 用户预约列表
   */
  async findUserBookings(userId: string, query: Omit<AppointmentQueryDto, 'userId'>): Promise<AppointmentListResponseDto> {
    try {
      return this.findBookings({ ...query, userId });
    } catch (error) {
      this.logger.error('查询用户预约列表失败', error);
      throw new DatabaseException('查询用户预约列表失败');
    }
  }

  /**
   * 获取预约统计信息
   * @returns 预约统计信息
   */
  async getBookingStats(): Promise<AppointmentStatisticsDto> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay());
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        completedAppointments,
        todayAppointments,
        thisWeekAppointments,
        thisMonthAppointments
      ] = await Promise.all([
        this.prisma.appointment.count(),
        this.prisma.appointment.count({ where: { status: AppointmentStatus.PENDING } }),
        this.prisma.appointment.count({ where: { status: AppointmentStatus.CONFIRMED } }),
        this.prisma.appointment.count({ where: { status: AppointmentStatus.CANCELLED } }),
        this.prisma.appointment.count({ where: { status: AppointmentStatus.COMPLETED } }),
        this.prisma.appointment.count({
          where: {
            createdAt: { gte: today }
          }
        }),
        this.prisma.appointment.count({
          where: {
            createdAt: { gte: thisWeekStart }
          }
        }),
        this.prisma.appointment.count({
          where: {
            createdAt: { gte: thisMonthStart }
          }
        })
      ]);

      return {
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        completedAppointments,
        todayAppointments,
        thisWeekAppointments,
        thisMonthAppointments
      };
    } catch (error) {
      this.logger.error('获取预约统计信息失败', error);
      throw new DatabaseException('获取预约统计信息失败');
    }
  }

  /**
   * 生成预约编号
   * @returns 预约编号
   */
  private async generateAppointmentNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // 查询今日预约数量
    const todayCount = await this.prisma.appointment.count({
      where: {
        appointmentNumber: {
          startsWith: `AP-${dateStr}-`
        }
      }
    });

    const sequence = (todayCount + 1).toString().padStart(4, '0');
    return `AP-${dateStr}-${sequence}`;
  }

  /**
   * 将预约实体转换为响应DTO
   * @param appointment 预约实体
   * @returns 预约响应DTO
   */
  private mapToResponseDto(appointment: any): AppointmentResponseDto {
    // 确保状态值是有效的枚举值
    let status: AppointmentStatusEnum;
    switch (appointment.status) {
      case 'PENDING':
        status = AppointmentStatusEnum.PENDING;
        break;
      case 'CONFIRMED':
        status = AppointmentStatusEnum.CONFIRMED;
        break;
      case 'CANCELLED':
        status = AppointmentStatusEnum.CANCELLED;
        break;
      case 'COMPLETED':
        status = AppointmentStatusEnum.COMPLETED;
        break;
      default:
        status = AppointmentStatusEnum.PENDING;
    }

    return {
      id: appointment.id,
      appointmentNumber: appointment.appointmentNumber,
      userId: appointment.userId,
      timeSlotId: appointment.timeSlotId,
      appointmentDate: appointment.appointmentDate,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      customerEmail: appointment.customerEmail,
      customerWechat: appointment.customerWechat,
      status: status,
      notes: appointment.notes,
      confirmationSent: appointment.confirmationSent || false,
      reminderSent: appointment.reminderSent || false,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      confirmedAt: appointment.confirmedAt,
      cancelledAt: appointment.cancelledAt,
      completedAt: appointment.completedAt,
      timeSlot: appointment.timeSlot ? {
        slotTime: appointment.timeSlot.slotTime,
        durationMinutes: appointment.timeSlot.durationMinutes
      } : undefined,
      user: appointment.user ? {
        name: appointment.user.name,
        phoneNumber: appointment.user.phone
      } : undefined
    };
  }
}