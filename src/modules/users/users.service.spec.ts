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
import { ProjectionSenderService } from '../integrations/projection-sender.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto } from './dto/user.dto';
import { EmailExistsException, PhoneNumberExistsException, ResourceNotFoundException, DatabaseException } from '../../common/exceptions/business.exceptions';
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
  userSession: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  appointment: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(async (fn) => fn(mockPrismaService)),
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

// Mock ProjectionSenderService（B-4 级联取消投影送信）
const mockProjectionSenderService = {
  projectBooking: jest.fn(),
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
        {
          provide: ProjectionSenderService,
          useValue: mockProjectionSenderService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    mockProjectionSenderService.projectBooking.mockResolvedValue({
      eventId: 'evt-001',
      syncStatus: 'SYNCED',
    });

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

    it('应该抛出EmailExistsException当邮箱已存在', async () => {
      const createUserWithEmailDto: CreateUserDto = {
        ...createUserDto,
        email: 'exists@example.com',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-user' });

      await expect(service.createUser(createUserWithEmailDto)).rejects.toThrow(EmailExistsException);
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
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

  describe('toggleUserStatus（级联取消・B-4 投影送信）', () => {
    const existingUser = {
      id: 'user-1',
      name: '测试用户',
      phone: '138****8000',
      email: 'test@example.com',
      userType: 'CUSTOMER',
      status: 'ACTIVE',
      remarks: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const activeBooking = {
      id: 'booking-1',
      userId: 'user-1',
      customerEmail: 'a@example.com',
      customerName: 'A',
      appointmentDate: new Date(),
      timeSlot: { slotTime: '09:00:00' },
      service: { name: '服务' },
      appointmentNumber: 'AP-001',
    };

    it('用户状态从 ACTIVE 变更为 INACTIVE 时取消预约：update data 含 version 递增 + PENDING，且投影被调', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.userSession.findMany.mockResolvedValue([]);
      mockPrismaService.appointment.findMany.mockResolvedValue([activeBooking]);
      mockPrismaService.appointment.update.mockResolvedValue({
        ...activeBooking,
        status: 'CANCELLED',
      });
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        status: 'INACTIVE',
      });

      const result = await service.toggleUserStatus('user-1', UserStatus.INACTIVE);

      expect(result.status).toBe('INACTIVE');
      // B-4 投影送信（RULE-08）：级联取消 update data 含 version 递增 + syncStatus=PENDING
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'booking-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            version: { increment: 1 },
            syncStatus: 'PENDING',
          }),
        }),
      );
      // 事务 resolve 后对受影响预约调用投影
      expect(mockProjectionSenderService.projectBooking).toHaveBeenCalledTimes(1);
      expect(mockProjectionSenderService.projectBooking).toHaveBeenCalledWith('booking-1');
    });

    it('多个受影响预约逐条投影；投影失败不影响应答（C-4）', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.userSession.findMany.mockResolvedValue([]);
      mockPrismaService.appointment.findMany.mockResolvedValue([
        activeBooking,
        { ...activeBooking, id: 'booking-2', customerEmail: 'b@example.com' },
      ]);
      mockPrismaService.appointment.update.mockResolvedValue({
        ...activeBooking,
        status: 'CANCELLED',
      });
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        status: 'INACTIVE',
      });
      mockProjectionSenderService.projectBooking
        .mockResolvedValueOnce({ eventId: 'e1', syncStatus: 'SYNCED' })
        .mockRejectedValueOnce(new Error('投影失败'));

      const result = await service.toggleUserStatus('user-1', UserStatus.INACTIVE);

      expect(result.status).toBe('INACTIVE');
      expect(mockProjectionSenderService.projectBooking).toHaveBeenCalledTimes(2);
      expect(mockProjectionSenderService.projectBooking).toHaveBeenNthCalledWith(1, 'booking-1');
      expect(mockProjectionSenderService.projectBooking).toHaveBeenNthCalledWith(2, 'booking-2');
      expect(mockPrismaService.appointment.update).toHaveBeenCalledTimes(2);
    });

    it('用户从 INACTIVE 复激活为 ACTIVE（非 ACTIVE→ACTIVE・无级联取消路径）时不触发投影', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...existingUser,
        status: 'INACTIVE',
      });
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        status: 'ACTIVE',
      });

      const result = await service.toggleUserStatus('user-1', UserStatus.ACTIVE);

      expect(result.status).toBe('ACTIVE');
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
      expect(mockProjectionSenderService.projectBooking).not.toHaveBeenCalled();
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

    it('应该使用稳定的默认排序和二级 id 排序', async () => {
      const query: QueryUserDto = {};
      const pagination = new PaginationQueryDto();
      pagination.page = 2;
      pagination.limit = 20;

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(2);

      await service.findUsers(query, pagination);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {},
        skip: 20,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }));
    });

    it('应该对白名单排序字段保留二级 id 排序，非法字段回退默认排序', async () => {
      const pagination = new PaginationQueryDto();
      pagination.page = 1;
      pagination.limit = 10;

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(2);

      await service.findUsers({ sortBy: 'name', order: 'asc' } as QueryUserDto, pagination);
      expect(mockPrismaService.user.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }));

      await service.findUsers({ sortBy: 'invalidField', order: 'asc' } as QueryUserDto, pagination);
      expect(mockPrismaService.user.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }));
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
