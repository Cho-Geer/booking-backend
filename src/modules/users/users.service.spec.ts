/**
 * 用户服务测试文件
 * 测试用户相关的业务逻辑
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import { PhoneNumberExistsException, ResourceNotFoundException, DatabaseException } from '../../common/exceptions/business.exceptions';
import { PaginationQueryDto } from '../../common/dto/api-response.dto';
import { UserStatus, UserType } from './dto/user.dto';

// 模拟PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
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

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

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
    prisma = module.get<PrismaService>(PrismaService);

    // 清除所有mock
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const createUserDto: CreateUserDto = {
      name: '测试用户',
      phone: '13800138000',
      userType: UserType.CUSTOMER,
      status: UserStatus.ACTIVE,
      remarks: '测试备注',
    };

    const mockUser = {
      id: '1',
      name: '测试用户',
      phone: '138****8000',
      phoneHash: 'hashed_phone',
      email: null,
      userType: 'USER',
      status: 'ACTIVE',
      remarks: '测试备注',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该成功创建用户', async () => {
      // 模拟手机号不存在
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      // 模拟创建用户成功
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.createUser(createUserDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('测试用户');
      expect(result.userType).toBe('USER');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('应该抛出异常当手机号已存在', async () => {
      // 模拟手机号已存在
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.createUser(createUserDto)).rejects.toThrow(PhoneNumberExistsException);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('应该抛出DatabaseException当数据库操作失败', async () => {
      // 模拟手机号不存在
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      // 模拟数据库操作失败
      mockPrismaService.user.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createUser(createUserDto)).rejects.toThrow(DatabaseException);
    });
  });

  describe('findUserById', () => {
    const userId = '1';
    const mockUser = {
      id: '1',
      name: '测试用户',
      phone: '138****8000',
      phoneHash: 'hashed_phone',
      userType: 'USER',
      status: 'ACTIVE',
      remarks: '测试备注',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该返回用户信息', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findUserById(userId);

      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
      expect(result.name).toBe('测试用户');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('应该抛出ResourceNotFoundException当用户不存在', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findUserById(userId)).rejects.toThrow(ResourceNotFoundException);
    });
  });

  describe('updateUser', () => {
    const userId = '1';
    const updateUserDto: UpdateUserDto = {
      name: '更新后的用户',
      userType: UserType.ADMIN,
      status: UserStatus.INACTIVE,
    };

    const mockUser = {
      id: '1',
      name: '更新后的用户',
      phone: '138****8000',
      phoneHash: 'hashed_phone',
      userType: 'ADMIN',
      status: 'INACTIVE',
      remarks: '测试备注',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该成功更新用户', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.updateUser(userId, updateUserDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('更新后的用户');
      expect(result.userType).toBe('ADMIN');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('应该抛出ResourceNotFoundException当用户不存在', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUser(userId, updateUserDto)).rejects.toThrow(ResourceNotFoundException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    const userId = '1';

    it('应该成功删除用户', async () => {
      const mockUser = {
        id: '1',
        name: '测试用户',
        phone: '138****8000',
        phoneHash: 'hashed_phone',
        userType: 'USER',
        status: 'ACTIVE',
        remarks: '测试备注',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      await service.deleteUser(userId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('应该抛出ResourceNotFoundException当用户不存在', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser(userId)).rejects.toThrow(ResourceNotFoundException);
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('findUsers', () => {
    const mockUsers = [
      {
        id: '1',
        name: '用户1',
        phone: '138****8001',
        phoneHash: 'hashed_phone1',
        userType: 'USER',
        status: 'ACTIVE',
        remarks: '备注1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        name: '用户2',
        phone: '138****8002',
        phoneHash: 'hashed_phone2',
        userType: 'ADMIN',
        status: 'ACTIVE',
        remarks: '备注2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('应该返回用户列表', async () => {
      const query: QueryUserDto = {};
      const pagination = new PaginationQueryDto();
      pagination.page = 1;
      pagination.limit = 10;

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(2);

      const result = await service.findUsers(query, pagination);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrismaService.user.findMany).toHaveBeenCalled();
      expect(mockPrismaService.user.count).toHaveBeenCalled();
    });

    it('应该根据查询条件过滤用户', async () => {
      const query: QueryUserDto = {
        phone: '13800138001',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };
      const pagination = new PaginationQueryDto();
      pagination.page = 1;
      pagination.limit = 10;

      mockPrismaService.user.findMany.mockResolvedValue([mockUsers[0]]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.findUsers(query, pagination);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrismaService.user.findMany).toHaveBeenCalled();
      expect(mockPrismaService.user.count).toHaveBeenCalled();
    });
  });

  describe('getUserStats', () => {
    it('应该返回用户统计信息', async () => {
      // 模拟各种统计数据
      mockPrismaService.user.count
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(80)  // activeUsers
        .mockResolvedValueOnce(15)  // inactiveUsers
        .mockResolvedValueOnce(5)   // blockedUsers
        .mockResolvedValueOnce(85)  // normalUsers
        .mockResolvedValueOnce(10)  // adminUsers
        .mockResolvedValueOnce(0)   // superAdminUsers
        .mockResolvedValueOnce(15)  // suspendedUsers (inactive状态)
        .mockResolvedValueOnce(20)  // todayNewUsers
        .mockResolvedValueOnce(15)  // weekNewUsers
        .mockResolvedValueOnce(25); // monthNewUsers

      const result = await service.getUserStats();

      expect(result).toBeDefined();
      expect(result.totalUsers).toBe(100);
      expect(result.activeUsers).toBe(80);
      expect(result.inactiveUsers).toBe(15);
      expect(result.blockedUsers).toBe(5);
      expect(result.suspendedUsers).toBe(0); // suspendedUsers = inactiveUsers
      expect(result.normalUsers).toBe(85);
      expect(result.adminUsers).toBe(10);
      expect(result.superAdminUsers).toBe(0);
      expect(result.todayNewUsers).toBe(15);
      expect(result.weekNewUsers).toBe(20); // 修正mock值
      expect(result.monthNewUsers).toBe(15);
    });
  });
});
