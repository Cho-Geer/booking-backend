/**
 * 认证服务测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto, VerificationCodeType } from './dto/auth.dto';
import {
  VerificationCodeException,
  ResourceNotFoundException,
  PhoneNumberExistsException,
  AuthenticationException,
} from '../../common/exceptions/business.exceptions';
import { UserStatus, UserType } from '../users/dto/user.dto';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  signAsync: jest.fn().mockResolvedValue('mock-token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-id', exp: Date.now() / 1000 + 3600 }),
};

const mockUsersService = {
  findUserByPhoneNumber: jest.fn(),
  findUserById: jest.fn(),
  createUser: jest.fn(),
};

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

const mockConfig: Record<string, any> = {
  JWT_SECRET: 'test-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_EXPIRES_IN: 3600,
  JWT_REFRESH_EXPIRES_IN: 604800,
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => mockConfig[key]),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    Object.assign(mockConfig, {
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_EXPIRES_IN: 3600,
      JWT_REFRESH_EXPIRES_IN: 604800,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      phoneNumber: '13800138000',
      verificationCode: '123456',
    };

    it('应该成功登录', async () => {
      const mockUser = {
        id: 'user-id',
        name: '测试用户',
        phone: '138****8000',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      mockCacheManager.get.mockResolvedValue('123456');
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBeDefined();
      expect(result.user.id).toBe('user-id');
    });

    it('应该抛出验证码错误异常', async () => {
      mockCacheManager.get.mockResolvedValue('654321');

      await expect(service.login(loginDto)).rejects.toThrow(VerificationCodeException);
    });

    it('应该抛出用户不存在异常', async () => {
      mockCacheManager.get.mockResolvedValue('123456');
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(ResourceNotFoundException);
    });

    it('应该抛出用户已被禁用异常', async () => {
      const mockUser = {
        id: 'user-id',
        status: UserStatus.INACTIVE,
      };

      mockCacheManager.get.mockResolvedValue('123456');
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(AuthenticationException);
    });

    it('JWT_EXPIRES_IN 为时长字符串时也应返回秒数', async () => {
      const mockUser = {
        id: 'user-id',
        name: '测试用户',
        phone: '138****8000',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      mockConfig.JWT_EXPIRES_IN = '1h';
      mockCacheManager.get.mockResolvedValue('123456');
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.expiresIn).toBe(3600);
    });
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      phoneNumber: '13800138000',
      verificationCode: '123456',
      name: '新用户',
    };

    it('应该成功注册', async () => {
      const mockUser = {
        id: 'new-user-id',
        name: '新用户',
        phone: '138****8000',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      mockCacheManager.get.mockResolvedValue('123456');
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);
      mockUsersService.createUser.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(result.accessToken).toBeDefined();
      expect(result.user.name).toBe('新用户');
    });

    it('应该抛出手机号已存在异常', async () => {
      const existingUser = { id: 'existing-user-id' };

      mockCacheManager.get.mockResolvedValue('123456');
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(PhoneNumberExistsException);
    });
  });

  describe('sendVerificationCode', () => {
    it('注册场景：手机号已存在应该抛出异常', async () => {
      mockUsersService.findUserByPhoneNumber.mockResolvedValue({ id: 'existing-user-id' });

      await expect(
        service.sendVerificationCode('13800138000', VerificationCodeType.REGISTER)
      ).rejects.toThrow(PhoneNumberExistsException);
    });

    it('登录场景：用户不存在应该抛出异常', async () => {
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);

      await expect(
        service.sendVerificationCode('13800138000', VerificationCodeType.LOGIN)
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('登录场景：用户被禁用应该抛出异常', async () => {
      mockUsersService.findUserByPhoneNumber.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.INACTIVE,
      });

      await expect(
        service.sendVerificationCode('13800138000', VerificationCodeType.LOGIN)
      ).rejects.toThrow(AuthenticationException);
    });

    it('应该成功发送验证码', async () => {
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);

      const result = await service.sendVerificationCode('13800138000', VerificationCodeType.REGISTER);

      expect(result.message).toBe('验证码发送成功');
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('JWT_EXPIRES_IN 为数字字符串时应返回对应秒数', async () => {
      const mockUser = {
        id: 'user-id',
        name: '测试用户',
        phone: '138****8000',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      mockConfig.JWT_EXPIRES_IN = '900';
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUsersService.findUserById.mockResolvedValue(mockUser);

      const result = await service.refreshToken({ refreshToken: 'valid-refresh-token' });

      expect(result.expiresIn).toBe(900);
    });
  });

  describe('logout', () => {
    it('应该成功登出', async () => {
      const result = await service.logout('user-id', 'refresh-token', 'access-token');

      expect(result.message).toBe('登出成功');
    });
  });

  describe('getUserProfile', () => {
    it('应该成功获取用户信息', async () => {
      const mockUser = {
        id: 'user-id',
        name: '测试用户',
        email: 'test@example.com',
        phone: '138****8000',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserProfile('user-id');

      expect(result.id).toBe('user-id');
    });

    it('应该抛出用户不存在异常', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserProfile('non-existent-id')).rejects.toThrow(ResourceNotFoundException);
    });
  });
});
