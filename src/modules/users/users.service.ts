/**
 * 用户服务
 * 处理用户相关的业务逻辑
 * @author Booking System
 * @since 2024
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateUserDto, UpdateUserDto, UserResponseDto, UserStatsDto, QueryUserDto } from './dto/user.dto';
import { ApiResponseDto, PaginationQueryDto } from '../../common/dto/api-response.dto';
import { 
  ResourceNotFoundException, 
  PhoneNumberExistsException,
  DatabaseException, 
  ValidationException
} from '../../common/exceptions/business.exceptions';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

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
          phone: this.maskPhoneNumber(createUserDto.phone),
          phoneHash: this.hashPhoneNumber(createUserDto.phone),
          email: createUserDto.email,
          userType: createUserDto.userType || 'CUSTOMER',
          status: createUserDto.status || 'ACTIVE',
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

    // 构建更新数据
    const updateData: any = {};
    if (updateUserDto.name) updateData.name = updateUserDto.name;
    if (updateUserDto.phone) {
      updateData.phone = this.maskPhoneNumber(updateUserDto.phone);
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
  }

  /**
   * 删除用户
   * @param id 用户ID
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

      this.logger.log(`用户删除成功: ${id}`);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      
      this.logger.error(`删除用户失败: ${error.message}`, error.stack);
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
        take: pagination.limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.order || 'desc',
        },
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
   * 对手机号进行脱敏处理
   * @param phoneNumber 手机号
   * @returns 脱敏后的手机号
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length !== 11) {
      return phoneNumber;
    }
    return phoneNumber.substring(0, 3) + '****' + phoneNumber.substring(7);
  }

  /**
   * 将数据库用户对象转换为响应DTO
   * @param user 数据库用户对象
   * @returns 用户响应DTO
   */
  private mapToResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      status: user.status,
      remarks: user.remarks,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
