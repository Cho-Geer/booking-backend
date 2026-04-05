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
import { Prisma, AppointmentStatus, UserType } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { MaskingUtil } from '../../common/utils/masking.util';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  /**
   * 创建预约
   * @param createAppointmentDto 创建预约数据
   * @param requestingUserId 请求用户的ID（用于预约所有者返回真实数据）
   * @returns 创建的预约信息
   */
  async createBooking(createAppointmentDto: CreateAppointmentDto, requestingUserId?: string): Promise<AppointmentResponseDto> {
    try {
      const appointmentDate = new Date(createAppointmentDto.appointmentDate);
      let serviceId: string | undefined = createAppointmentDto.serviceId;
      if (!serviceId && createAppointmentDto.serviceName) {
        const service = await this.prisma.service.findFirst({
          where: {
            name: createAppointmentDto.serviceName,
            isActive: true
          }
        });
        if (service) {
          serviceId = service.id;
        }
      }

      // 验证 serviceId 指向的服务是否处于启用状态
      if (serviceId) {
        const targetService = await this.prisma.service.findUnique({
          where: { id: serviceId },
        });
        if (!targetService) {
          throw new ResourceNotFoundException('服务');
        }
        if (!targetService.isActive) {
          this.logger.warn(`服务已被禁用，无法创建预约: ${targetService.id}, ${targetService.name}`);
          throw new BusinessRuleException(`服务 "${targetService.name}" 已被禁用，无法创建预约`);
        }
      }

      const appointmentNumber = await this.generateAppointmentNumber();
      const appointment = await this.prisma.$transaction(async (tx) => {
        const timeSlot = await tx.timeSlot.findUnique({
          where: { id: createAppointmentDto.timeSlotId },
        });

        if (!timeSlot) {
          throw new ResourceNotFoundException('时间段');
        }

        if (!timeSlot.isActive) {
          throw new TimeSlotConflictException('时间段不可用');
        }

        const maxCapacity = 1;
        const existingAppointments = await tx.appointment.count({
          where: {
            timeSlotId: createAppointmentDto.timeSlotId,
            appointmentDate,
            status: {
              in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING],
            },
          },
        });

        if (existingAppointments >= maxCapacity) {
          throw new TimeSlotConflictException('时间段已满');
        }

        if (serviceId) {
          const conflictingServiceAppointment = await tx.appointment.findFirst({
            where: {
              serviceId,
              timeSlotId: createAppointmentDto.timeSlotId,
              appointmentDate,
              status: {
                in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING],
              },
            },
          });

          if (conflictingServiceAppointment) {
            throw new TimeSlotConflictException('该服务在该时间段已被预约');
          }
        }

        return tx.appointment.create({
          data: {
            appointmentNumber,
            userId: createAppointmentDto.userId,
            appointmentDate,
            timeSlotId: createAppointmentDto.timeSlotId,
            serviceId,
            customerName: createAppointmentDto.customerName,
            customerPhone: createAppointmentDto.customerPhone,
            customerEmail: createAppointmentDto.customerEmail,
            customerWechat: createAppointmentDto.customerWechat,
            notes: createAppointmentDto.notes,
            status: AppointmentStatus.PENDING,
          },
          include: {
            timeSlot: true,
            user: true,
            service: true,
          },
        });
      });

      // Send confirmation email asynchronously
      // We do not await this to prevent blocking the response
      if (createAppointmentDto.customerEmail) {
        this.emailService.sendBookingConfirmation(createAppointmentDto.customerEmail, {
          customerName: createAppointmentDto.customerName,
          appointmentDate: appointmentDate.toLocaleDateString(),
          timeSlot: appointment.timeSlot ? appointment.timeSlot.slotTime.toString() : '',
          serviceName: appointment.service ? appointment.service.name : 'Standard Service',
          appointmentNumber: appointmentNumber,
          notes: appointment.notes
        }).catch(err => this.logger.error('Error triggering email confirmation', err));
      }

      return this.mapToResponseDto(appointment, requestingUserId ?? createAppointmentDto.userId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new TimeSlotConflictException('预约冲突，请选择其他时间段');
      }
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
   * @param requestingUserId 请求用户的ID（用于预约所有者返回真实数据）
   * @returns 预约信息
   */
  async findBookingById(id: string, requestingUserId?: string): Promise<AppointmentResponseDto> {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id },
        include: {
          timeSlot: true,
          user: true,
          service: true
        }
      });

      if (!appointment) {
        throw new ResourceNotFoundException('预约');
      }

      return this.mapToResponseDto(appointment, requestingUserId);
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
   * @param requestingUserId 请求用户的ID（用于预约所有者返回真实数据）
   * @returns 更新后的预约信息
   */
  async updateBooking(id: string, updateAppointmentDto: UpdateAppointmentDto, requestingUserId?: string): Promise<AppointmentResponseDto> {
    try {
      this.logger.log(`开始更新预约 ${id}: ${JSON.stringify(updateAppointmentDto)}`);
        
      // 检查预约是否存在
      const existingAppointment = await this.prisma.appointment.findUnique({
        where: { id },
        include: {
          service: true,
        },
      });
  
      if (!existingAppointment) {
        this.logger.warn(`预约不存在：${id}`);
        throw new ResourceNotFoundException('预约');
      }
  
      // 如果更新了 serviceId，则验证新服务是否处于启用状态
      if (updateAppointmentDto.serviceId !== undefined) {
        const newService = await this.prisma.service.findUnique({
          where: { id: updateAppointmentDto.serviceId },
        });
        if (!newService) {
          throw new ResourceNotFoundException('服务');
        }
        if (!newService.isActive) {
          this.logger.warn(`更新预约失败：目标服务已被禁用: ${newService.id}, ${newService.name}`);
          throw new BusinessRuleException(`服务 "${newService.name}" 已被禁用，无法更新预约`);
        }
      }

      // 如果不更改 serviceId，验证现有预约的服务是否仍处于启用状态
      if (updateAppointmentDto.serviceId === undefined && existingAppointment.serviceId) {
        if (existingAppointment.service && !existingAppointment.service.isActive) {
          this.logger.warn(`预约关联服务已被禁用，无法更新预约: ${existingAppointment.service.id}, ${existingAppointment.service.name}`);
          throw new BusinessRuleException(`服务 "${existingAppointment.service.name}" 已被禁用，无法更新预约`);
        }
      }

      this.logger.log(`更新预约数据: ${JSON.stringify(updateAppointmentDto)}`);
      
      // 构建更新数据，只更新提供的字段
      const updateData: any = {};
      if (updateAppointmentDto.status !== undefined) {
        // 确保状态值是有效的枚举值
        updateData.status = updateAppointmentDto.status;
        this.logger.log(`设置状态: ${updateAppointmentDto.status}`);
      }
      if (updateAppointmentDto.appointmentDate !== undefined) {
        updateData.appointmentDate = new Date(updateAppointmentDto.appointmentDate);
        this.logger.log(`设置预约日期: ${updateAppointmentDto.appointmentDate}`);
      }
      if (updateAppointmentDto.timeSlotId !== undefined) {
        updateData.timeSlotId = updateAppointmentDto.timeSlotId;
        this.logger.log(`设置时间段ID: ${updateAppointmentDto.timeSlotId}`);
      }
      if (updateAppointmentDto.serviceId !== undefined) {
        updateData.serviceId = updateAppointmentDto.serviceId;
        this.logger.log(`设置服务ID: ${updateAppointmentDto.serviceId}`);
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
          user: true,
          service: true
        }
      });

      this.logger.log(`预约更新成功: ${appointment.id}`);

      // Send update email asynchronously
      if (appointment.customerEmail) {
        this.emailService.sendBookingUpdate(appointment.customerEmail, {
          customerName: appointment.customerName,
          appointmentDate: appointment.appointmentDate.toLocaleDateString(),
          timeSlot: appointment.timeSlot ? appointment.timeSlot.slotTime.toString() : '',
          serviceName: appointment.service ? appointment.service.name : 'Standard Service',
          appointmentNumber: appointment.appointmentNumber,
          notes: appointment.notes
        }).catch(err => this.logger.error('Error triggering email update', err));
      }

      return this.mapToResponseDto(appointment, requestingUserId);
    } catch (error) {
      this.logger.error(`更新预约失败: ${error.message}`, error.stack);
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      if (error instanceof BusinessRuleException) {
        throw error;
      }
      throw new DatabaseException('更新预约失败');
    }
  }

  /**
   * 取消预约
   * @param id 预约ID
   * @param userId 用户ID（用于权限检查）
   * @param requestingUserId 请求用户的ID（用于预约所有者返回真实数据）
   * @returns 取消后的预约信息
   */
  async cancelBooking(id: string, userId?: string, userType?: UserType, requestingUserId?: string): Promise<AppointmentResponseDto> {
    try {
      // 检查预约是否存在
      const existingAppointment = await this.prisma.appointment.findUnique({
        where: { id },
        include: {
          timeSlot: true,
          user: true,
          service: true
        }
      });

      if (!existingAppointment) {
        throw new ResourceNotFoundException('预约');
      }

      // 权限检查：只有预约者本人或管理员可以取消
      if (userId && existingAppointment.userId && existingAppointment.userId !== userId 
        && userType !== UserType.ADMIN) {
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
          user: true,
          service: true
        }
      });

      // Send cancellation email asynchronously
      if (appointment.customerEmail) {
        this.emailService.sendBookingCancellation(appointment.customerEmail, {
          customerName: appointment.customerName,
          appointmentDate: appointment.appointmentDate.toLocaleDateString(),
          timeSlot: appointment.timeSlot ? appointment.timeSlot.slotTime.toString() : '',
          serviceName: appointment.service ? appointment.service.name : 'Standard Service',
          appointmentNumber: appointment.appointmentNumber,
          notes: appointment.notes
        }).catch(err => this.logger.error('Error triggering email cancellation', err));
      }

      return this.mapToResponseDto(appointment, requestingUserId);
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
   * @param requestingUserId 请求用户的ID（用于预约所有者返回真实数据）
   * @returns 预约列表
   */
  async findBookings(query: AppointmentQueryDto, requestingUserId?: string): Promise<AppointmentListResponseDto> {
    try {
      const { page = 1, limit = 10, status, userId, timeSlotId, startDate, endDate, keyword } = query;
      // 确保page和limit是数字类型
      const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
      const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
      const skip = (pageNum - 1) * limitNum;

      this.logger.log(`查询预约列表: page=${pageNum}, limit=${limitNum}, status=${status}, userId=${userId}, timeSlotId=${timeSlotId}, startDate=${startDate}, endDate=${endDate}, keyword=${keyword}`);

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

      // 处理关键词搜索
      if (keyword) {
        where.OR = [
          { customerName: { contains: keyword, mode: 'insensitive' } },
          { customerPhone: { contains: keyword, mode: 'insensitive' } },
          { notes: { contains: keyword, mode: 'insensitive' } },
          { appointmentNumber: { contains: keyword, mode: 'insensitive' } }
        ];
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
          user: true,
          service: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum  // 使用转换后的数字类型
      });

      this.logger.log(`查询到的预约数量: ${appointments.length}`);

      const items = appointments.map(appointment => {
        try {
          // 传入 requestingUserId 以便所有者能看到真实数据
          return this.mapToResponseDto(appointment, requestingUserId);
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
   * @param userId 用户 ID
   * @param query 查询条件
   * @returns 用户预约列表
   */
  async findUserBookings(userId: string, query: Omit<AppointmentQueryDto, 'userId'>): Promise<AppointmentListResponseDto> {
    try {
      return this.findBookings({ ...query, userId }, userId);
    } catch (error) {
      this.logger.error('查询用户预约列表失败', error);
      throw new DatabaseException('查询用户预约列表失败');
    }
  }
  
  /**
   * 获取指定日期的所有预约（无分页）
   * @param date 日期
   * @param userId 用户 ID（用于过滤）
   * @param requestingUserId 请求用户的ID（用于预约所有者返回真实数据）
   * @returns 该日期的所有预约
   */
  async findAllBookingsByDate(date: string, userId?: string, requestingUserId?: string): Promise<AppointmentListResponseDto> {
    try {
      this.logger.log(`查询日期 ${date} 的所有预约，userId: ${userId || 'all'}`);
  
      // 构建查询条件
      const where: Prisma.AppointmentWhereInput = {
        appointmentDate: new Date(date)
      };
  
      if (userId) {
        where.userId = userId;
      }
  
      this.logger.log(`构建的查询条件：${JSON.stringify(where)}`);
  
      // 查询数据（无分页限制）
      const appointments = await this.prisma.appointment.findMany({
        where,
        include: {
          timeSlot: true,
          user: true,
          service: true
        },
        orderBy: { createdAt: 'desc' }
      });
  
      this.logger.log(`查询到的预约数量：${appointments.length}`);
  
      const items = appointments.map(appointment => {
        try {
          // 传入 requestingUserId 以便所有者能看到真实数据
          return this.mapToResponseDto(appointment, requestingUserId);
        } catch (error) {
          this.logger.error(`映射预约数据失败：${error.message}`, error);
          throw error;
        }
      });
  
      this.logger.log(`映射后的预约数量：${items.length}`);
  
      // 返回无分页的结果
      return {
        items,
        total: items.length,
        page: 1,
        limit: items.length,
        totalPages: 1
      };
    } catch (error) {
      this.logger.error('查询指定日期预约失败', error);
      throw new DatabaseException('查询指定日期预约失败');
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
   * @param requestingUserId 请求用户的ID（预约所有者时跳过敏感字段脱敏）
   * @returns 预约响应DTO
   */
  private mapToResponseDto(appointment: any, requestingUserId?: string): AppointmentResponseDto {
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

    // 判断请求用户是否是预约所有者：所有者可查看真实手机号和邮箱，其他用户（包括管理员）看脱敏数据
    const isOwner = !!requestingUserId && appointment.userId === requestingUserId;

    return {
      id: appointment.id,
      appointmentNumber: appointment.appointmentNumber,
      userId: appointment.userId,
      timeSlotId: appointment.timeSlotId,
      appointmentDate: appointment.appointmentDate,
      customerName: appointment.customerName,
      customerPhone: isOwner
        ? appointment.customerPhone // 预约所有者返回真实手机号
        : MaskingUtil.maskPhoneNumber(appointment.customerPhone), // 非所有者返回脱敏手机号
      customerEmail: isOwner
        ? appointment.customerEmail // 预约所有者返回真实邮箱
        : MaskingUtil.maskEmail(appointment.customerEmail), // 非所有者返回脱敏邮箱
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
        phoneNumber: MaskingUtil.maskPhoneNumber(appointment.user.phone) // ユーザーの電話番号も匿名化
      } : undefined,
      service: appointment.service ? {
        id: appointment.service.id,
        name: appointment.service.name,
        durationMinutes: appointment.service.durationMinutes
      } : undefined
    };
  }
}
