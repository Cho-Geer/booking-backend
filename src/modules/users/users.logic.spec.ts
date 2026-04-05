/**
 * 用户业务逻辑测试
 * 专门测试UsersService的业务逻辑，避免控制器装饰器依赖问题
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CreateUserDto, UpdateUserDto, UserRole, UserStatus, UserType } from './dto/user.dto';
import { ApiResponseDto, PaginationQueryDto } from '../../common/dto/api-response.dto';
import { BusinessException } from '../../common/exceptions/business.exceptions';

import { DatabaseException, ResourceNotFoundException, PhoneNumberExistsException } from '../../common/exceptions/business.exceptions';

// Mock PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
};

const mockEmailService = {
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
  sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
  sendBookingUpdate: jest.fn().mockResolvedValue(undefined),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn().mockReturnValue({ userId: 'test-user-id' }),
};

const mockCacheManager = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

describe('UsersService Logic', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('应该成功创建用户', async () => {
      const createUserDto: CreateUserDto = {
        name: '测试用户',
        phone: '13800138000',

        userType: UserType.CUSTOMER,
      };

      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '测试用户',
        phone: '138****8000',
        email: null,
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        remarks: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.createUser(createUserDto);

      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: '测试用户',
          phone: '138****8000',
          phoneHash: expect.any(String),
          userType: UserType.CUSTOMER,
          status: UserStatus.ACTIVE,
        }),
      });
      expect(result.name).toBe('测试用户');
    });

    it('应该抛出BusinessException当手机号已存在', async () => {
      const createUserDto: CreateUserDto = {
        name: '测试用户',
        phone: '13800138000',

        userType: UserType.CUSTOMER,
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user-id',
        phone: '138****8000',
        phoneHash: 'hashed-13800138000',
      });

      await expect(service.createUser(createUserDto)).rejects.toThrow(BusinessException);
      await expect(service.createUser(createUserDto)).rejects.toThrow('手机号 13800138000 已存在');
    });
  });

  describe('findUserById', () => {
    it('应该成功获取用户详情', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const mockUser = {
        id: userId,
        name: '测试用户',
        phone: '138****8000',
        email: null,
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        remarks: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findUserById(userId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result.id).toBe(userId);
      expect(result.name).toBe('测试用户');
    });

    it('应该抛出ResourceNotFoundException当用户不存在', async () => {
      const userId = 'non-existent-user-id';

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findUserById(userId)).rejects.toThrow(ResourceNotFoundException);
      await expect(service.findUserById(userId)).rejects.toThrow('用户');
    });
  });

  describe('updateUser', () => {
    it('应该成功更新用户信息', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const updateUserDto: UpdateUserDto = {
        name: '更新后的用户',
        phone: '13800138001',
      };

      const mockUser = {
        id: userId,
        name: '更新后的用户',
        phone: '138****8001',
        email: null,
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
        remarks: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.user.findFirst.mockResolvedValue(null); // For phone check
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.updateUser(userId, updateUserDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          name: '更新后的用户',
          phone: '138****8001',
          phoneHash: expect.any(String),
        }),
      });
      expect(result.name).toBe('更新后的用户');
    });

    it('应该抛出ResourceNotFoundException当用户不存在', async () => {
      const userId = 'non-existent-user-id';
      const updateUserDto: UpdateUserDto = {
        name: '更新后的用户',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUser(userId, updateUserDto)).rejects.toThrow(ResourceNotFoundException);
      await expect(service.updateUser(userId, updateUserDto)).rejects.toThrow('用户');
    });
  });

  describe('deleteUser', () => {
    it('应该成功删除用户', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.user.delete.mockResolvedValue({ id: userId });

      await service.deleteUser(userId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('应该抛出ResourceNotFoundException当用户不存在', async () => {
      const userId = 'non-existent-user-id';

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser(userId)).rejects.toThrow(ResourceNotFoundException);
      await expect(service.deleteUser(userId)).rejects.toThrow('用户');
    });

    it('应该抛出DatabaseException当删除失败', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.user.delete.mockRejectedValue(new Error('数据库错误'));

      await expect(service.deleteUser(userId)).rejects.toThrow(DatabaseException);
      await expect(service.deleteUser(userId)).rejects.toThrow('删除用户失败');
    });
  });

  describe('findUsers', () => {
    it('应该成功获取用户列表', async () => {
      const query = { name: '测试' };
      const pagination: PaginationQueryDto = new PaginationQueryDto();
      pagination.page = 1;
      pagination.limit = 10;

      const mockUsers = [
        {
          id: 'user1',
          name: '测试用户1',
          phone: '138****8001',
          email: null,
          userType: UserType.CUSTOMER,
          status: UserStatus.ACTIVE,
          remarks: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user2',
          name: '测试用户2',
          phone: '138****8002',
          email: null,
          userType: UserType.CUSTOMER,
          status: UserStatus.ACTIVE,
          remarks: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockTotal = 2;

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(mockTotal);

      const result = await service.findUsers(query, pagination);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          name: { contains: '测试' },
        }),
        skip: 0,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          name: { contains: '测试' },
        }),
      });
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  describe('getUserStats', () => {
    it('应该成功获取用户统计信息', async () => {
      // 模拟count方法的返回值
      mockPrismaService.user.count
        .mockResolvedValueOnce(111) // 总用户数
        .mockResolvedValueOnce(90)   // 活跃用户
        .mockResolvedValueOnce(20)   // 非活跃用户
        .mockResolvedValueOnce(0)    // 被禁用用户
        .mockResolvedValueOnce(100)  // 普通用户
        .mockResolvedValueOnce(10)   // 管理员
        .mockResolvedValueOnce(0)    // 超级管理员
        .mockResolvedValueOnce(20)   // 被暂停用户（使用inactive状态的用户数量）
        .mockResolvedValueOnce(20)   // 今日新增
        .mockResolvedValueOnce(20)   // 本周新增
        .mockResolvedValueOnce(15);  // 本月新增

      const result = await service.getUserStats();

      // 验证count方法被调用了10次
      expect(mockPrismaService.user.count).toHaveBeenCalledTimes(10);
      expect(result).toEqual({
        totalUsers: 111,
        activeUsers: 90,
        inactiveUsers: 20,
        blockedUsers: 0,
        normalUsers: 100,
        adminUsers: 10,
        superAdminUsers: 0,
        suspendedUsers: 0,
        todayNewUsers: 20,
        weekNewUsers: 20,
        monthNewUsers: 20,
      });
    });
  });
});
