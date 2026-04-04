/**
 * 用户服务
 * 处理用户相关的业务逻辑
 * @author Booking System
 * @since 2024
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, AppointmentStatus } from '@prisma/client';
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserStatsDto, QueryUserDto } from './dto/user.dto';
import { ApiResponseDto, PaginationQueryDto } from '../../common/dto/api-response.dto';
import { 
  ResourceNotFoundException, 
  PhoneNumberExistsException,
  EmailExistsException,
  DatabaseException, 
  ValidationException
} from '../../common/exceptions/business.exceptions';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MaskingUtil } from '../../common/utils/masking.util';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private jwtService: JwtService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * 创建用户
   * @param createUserDto 创建用户数据
   * @returns 创建的用户信息
   */
  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      // 检查手机号是否已存在
      const existingUser = await this.prisma.user.findUnique({
        where: { phoneHash: this.hashPhoneNumber(createUserDto.phone) },
      });

      if (existingUser) {
        throw new PhoneNumberExistsException(createUserDto.phone);
      }

      // 检查邮箱是否已存在
      if (createUserDto.email) {
        const existingUserByEmail = await this.prisma.user.findUnique({
          where: { email: createUserDto.email },
        });

        if (existingUserByEmail) {
          throw new ValidationException('邮箱已被注册');
        }
      }

      // 创建用户
      const user = await this.prisma.user.create({
        data: {
          name: createUserDto.name,
          phone: MaskingUtil.maskPhoneNumber(createUserDto.phone),
          phoneHash: this.hashPhoneNumber(createUserDto.phone),
          email: createUserDto.email ?? undefined,
          userType: createUserDto.userType || 'CUSTOMER',
          status: createUserDto.status || 'ACTIVE',
          remarks: createUserDto.remarks,
        },
      });

      this.logger.log(`用户创建成功: ${user.id} - ${user.name}`);
      return this.mapToResponseDto(user);
    } catch (error) {
      if (error instanceof PhoneNumberExistsException) {
        throw error;
      }
      
      this.logger.error(`创建用户失败: ${error.message}`, error.stack);
      throw new DatabaseException('创建用户失败');
    }
  }

  /**
   * 根据ID查找用户
   * @param id 用户ID
   * @returns 用户信息
   */
  async findUserById(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new ResourceNotFoundException('用户');
      }

      return this.mapToResponseDto(user);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      
      this.logger.error(`查找用户失败: ${error.message}`, error.stack);
      throw new DatabaseException('查找用户失败');
    }
  }

  /**
   * 根据手机号哈希查找用户
   * @param phoneHash 手机号哈希
   * @returns 用户信息或null
   */
  async findUserByPhoneHash(phoneHash: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { phoneHash },
    });

    return user ? this.mapToResponseDto(user) : null;
  }

  /**
   * 根据手机号查找用户
   * @param phoneNumber 手机号
   * @returns 用户信息或null
   */
  async findUserByPhoneNumber(phoneNumber: string): Promise<UserResponseDto | null> {
    const phoneHash = this.hashPhoneNumber(phoneNumber);
    return this.findUserByPhoneHash(phoneHash);
  }

  /**
   * 根据邮箱查找用户
   * @param email 邮箱
   * @returns 用户信息或null
   */
  async findUserByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user ? this.mapToResponseDto(user) : null;
  }

  /**
   * 更新用户信息
   * @param id 用户ID
   * @param updateUserDto 更新数据
   * @returns 更新后的用户信息
   */
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    this.logger.log(`更新用户信息: ${id}`);
    try {
      // 检查用户是否存在
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
      });
  
      if (!existingUser) {
        throw new ResourceNotFoundException('用户');
      }
  
      // 检查手机号是否已被其他用户使用
      if (updateUserDto.phone) {
        const phoneHash = this.hashPhoneNumber(updateUserDto.phone);
        const userWithPhone = await this.prisma.user.findFirst({
          where: {
            phoneHash,
            id: { not: id },
          },
        });
  
        if (userWithPhone) {
          throw new PhoneNumberExistsException(updateUserDto.phone);
        }
      }

      // 检查邮箱是否已被其他用户使用
      if (updateUserDto.email) {
        const userWithEmail = await this.prisma.user.findFirst({
          where: {
            email: updateUserDto.email,
            id: { not: id },  // 自分自身を除く
          },
        });

        if (userWithEmail) {
          throw new EmailExistsException(updateUserDto.email);
        }  
      }
  
      // 构建更新数据
      const updateData: any = {};
      if (updateUserDto.email) updateData.email = updateUserDto.email;
      if (updateUserDto.name) updateData.name = updateUserDto.name;
      if (updateUserDto.phone) {
        updateData.phone = MaskingUtil.maskPhoneNumber(updateUserDto.phone);
        updateData.phoneHash = this.hashPhoneNumber(updateUserDto.phone);
      }
      if (updateUserDto.userType) updateData.userType = updateUserDto.userType;
      if (updateUserDto.status) updateData.status = updateUserDto.status;
      if (updateUserDto.remarks !== undefined) updateData.remarks = updateUserDto.remarks;
  
      // 更新用户
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
  
      return this.mapToResponseDto(updatedUser);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      if (error instanceof PhoneNumberExistsException || error instanceof EmailExistsException) {
        throw error;
      }
      this.logger.error(`更新用户失败：${error.message}`, error.stack);
      throw new DatabaseException('更新用户失败');
    }
  }

  /**
   * 切换用户状态
   * @param id 用户 ID
   * @param status 新的用户状态
   * @returns 更新后的用户信息
   */
  async toggleUserStatus(id: string, status: string): Promise<UserResponseDto> {
    this.logger.log(`切换用户状态：${id} to ${status}`);
      
    let bookingsToNotify: Array<{
      customerEmail: string;
      customerName: string;
      appointmentDate: Date;
      timeSlot?: { slotTime: any };
      serviceName?: string;
      appointmentNumber: string;
      notes?: string;
    }> = [];
  
    const user = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id },
      });
  
      if (!existingUser) {
        throw new ResourceNotFoundException('用户不存在');
      }
  
      // ACTIVE から他の状態へ変更する場合、トークンをブラックリストに入れ、予約をキャンセル
      if (existingUser.status === 'ACTIVE' && status !== 'ACTIVE') {
        this.logger.log(`ユーザー ${id} のステータスが ACTIVE から ${status} へ変更されます`);
                
        // ユーザーのアクティブセッションを取得してトークンをブラックリストに追加
        const activeSessions = await tx.userSession.findMany({
          where: { 
            userId: id,
            isActive: true,
          },
        });
              
        this.logger.log(`アクティブなセッション数：${activeSessions.length}`);
              
        // 各セッションのトークンをブラックリストに追加（Redis）
        for (const session of activeSessions) {
          // リフレッシュトークンをブラックリストに追加
          if (session.refreshToken && session.refreshExpiresAt) {
            const refreshTtl = session.refreshExpiresAt.getTime() - Date.now();
            if (refreshTtl > 0) {
              const refreshTokenHash = crypto.createHash('sha256').update(session.refreshToken).digest('hex');
              await this.cacheManager.set(`blacklist:${refreshTokenHash}`, 1, refreshTtl);
              this.logger.log(`リフレッシュトークンをブラックリストに追加：${refreshTokenHash.substring(0, 16)}...`);
            }
          }
                
          // セッションを無効化
          await tx.userSession.update({
            where: { id: session.id },
            data: { isActive: false },
          });
        }
                
        // PENDING と CONFIRMED の予約をキャンセル
        const activeBookings = await tx.appointment.findMany({
          where: {
            userId: id,
            status: {
              in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
            },
          },
          include: {
            timeSlot: true,
            service: true,
          },
        });
      
        this.logger.log(`アクティブな予約数：${activeBookings.length}`);
      
        for (const booking of activeBookings) {
          await tx.appointment.update({
            where: { id: booking.id },
            data: {
              status: AppointmentStatus.CANCELLED,
              cancelledAt: new Date(),
              updatedAt: new Date(),
            },
          });
      
          // メール送信情報を保存（トランザクション外で送信）
          if (booking.customerEmail) {
            bookingsToNotify.push({
              customerEmail: booking.customerEmail,
              customerName: booking.customerName,
              appointmentDate: booking.appointmentDate,
              timeSlot: booking.timeSlot,
              serviceName: booking.service?.name,
              appointmentNumber: booking.appointmentNumber,
              notes: booking.notes,
            });
          }
        }
      }
  
      // ユーザーのステータスを更新
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          status: status as any,
        },
      });
        
      this.logger.log(`ユーザー状態更新成功：${id}`);
      return updatedUser;
    });
  
    // トランザクションの外でメール送信（非同期）
    // 1. 予約キャンセル通知メール
    for (const booking of bookingsToNotify) {
      this.emailService.sendBookingCancellation(
        booking.customerEmail,
        {
          customerName: booking.customerName,
          appointmentDate: booking.appointmentDate.toLocaleDateString('zh-CN'),
          timeSlot: booking.timeSlot?.slotTime?.toString() || '',
          serviceName: booking.serviceName || 'Standard Service',
          appointmentNumber: booking.appointmentNumber,
          notes: booking.notes || '',
        },
      ).catch(err => this.logger.error('Error sending cancellation email', err));
    }
      
    // 2. ユーザー状態更新通知メール
    const userEmail = user.email;
    if (userEmail) {
      this.emailService.sendBookingUpdate(
        userEmail,
        {
          customerName: user.name,
          appointmentDate: new Date().toLocaleDateString('zh-CN'),
          timeSlot: '',
          serviceName: '账户状态变更',
          appointmentNumber: `USER-${user.id.substring(0, 8)}`,
          notes: `您的账户状态已变更为：${status}`,
        },
      ).catch(err => this.logger.error('Error sending status update email', err));
    }
  
    return this.mapToResponseDto(user);
  }
  
  /**
   * 删除用户
   * @param id 用户 ID
   */
  async deleteUser(id: string): Promise<void> {
    try {
      // 检查用户是否存在
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
      });
  
      if (!existingUser) {
        throw new ResourceNotFoundException('用户');
      }
  
      // 删除用户
      await this.prisma.user.delete({
        where: { id },
      });
  
      this.logger.log(`用户删除成功：${id}`);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
        
      this.logger.error(`删除用户失败：${error.message}`, error.stack);
      throw new DatabaseException('删除用户失败');
    }
  }

  /**
   * 查询用户列表
   * @param query 查询条件
   * @param pagination 分页参数
   * @returns 用户列表和分页信息
   */
  async findUsers(query: QueryUserDto, pagination: PaginationQueryDto): Promise<{
    items: UserResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // 构建查询条件
      const where: Prisma.UserWhereInput = {};
      
      if (query.name) {
        where.name = { contains: query.name };
      }
      
      if (query.phone) {
        where.phoneHash = this.hashPhoneNumber(query.phone);
      }
      
      if (query.userType) {
        where.userType = query.userType;
      }

      if (query.email) {
        where.email = query.email;
      }
      
      if (query.status) {
        where.status = query.status;
      }

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) {
          where.createdAt.gte = query.startDate;
        }
        if (query.endDate) {
          where.createdAt.lte = query.endDate;
        }
      }

      // 获取总数
      const total = await this.prisma.user.count({ where });

      // 获取分页数据
      const users = await this.prisma.user.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit
      });

      return {
        items: users.map(user => this.mapToResponseDto(user)),
        total,
        page: pagination.page,
        limit: pagination.limit,
      };
    } catch (error) {
      this.logger.error(`查询用户列表失败: ${error.message}`, error.stack);
      throw new DatabaseException('查询用户列表失败');
    }
  }

  /**
   * 获取用户统计信息
   * @returns 用户统计数据
   */
  async getUserStats(): Promise<UserStatsDto> {
    this.logger.log('获取用户统计信息');

    // 获取总用户数
    const totalUsers = await this.prisma.user.count();

    // 获取各状态用户数量
    const activeUsers = await this.prisma.user.count({
      where: { status: 'ACTIVE' },
    });

    const inactiveUsers = await this.prisma.user.count({
      where: { status: 'INACTIVE' },
    });

    const blockedUsers = await this.prisma.user.count({
      where: { status: 'BLOCKED' },
    });

    // 获取各角色用户数量
    const normalUsers = await this.prisma.user.count({
      where: { userType: 'CUSTOMER' },
    });

    const adminUsers = await this.prisma.user.count({
      where: { userType: 'ADMIN' },
    });

    // 暂时将superAdminUsers设为0，因为没有SUPER_ADMIN类型
    const superAdminUsers = 0;

    // 获取被暂停的用户数量（使用inactive状态的用户）
    const suspendedUsers = await this.prisma.user.count({
      where: { status: 'INACTIVE' },
    });

    // 获取时间范围内的新增用户数量
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayNewUsers = await this.prisma.user.count({
      where: { createdAt: { gte: todayStart } },
    });

    const weekNewUsers = await this.prisma.user.count({
      where: { createdAt: { gte: weekStart } },
    });

    const monthNewUsers = await this.prisma.user.count({
      where: { createdAt: { gte: monthStart } },
    });

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      blockedUsers,
      normalUsers,
      adminUsers,
      superAdminUsers,
      todayNewUsers,
      weekNewUsers,
      monthNewUsers,
      suspendedUsers, // 使用inactive状态的用户数量
    };
  }

  /**
   * 对手机号进行哈希处理
   * @param phoneNumber 手机号
   * @returns 哈希值
   */
  private hashPhoneNumber(phoneNumber: string): string {
    return crypto.createHash('sha256').update(phoneNumber).digest('hex');
  }

  /**
   * 将数据库用户对象转换为响应 DTO
   * @param user 数据库用户对象
   * @returns 用户响应 DTO
   */
  private mapToResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      phone: MaskingUtil.maskPhoneNumber(user.phone), // 電話番号を匿名化
      email: MaskingUtil.maskEmail(user.email), // メールを匿名化
      userType: user.userType,
      status: user.status,
      remarks: user.remarks,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
