/**
 * 认证服务测试
 * @author Booking System
 * @since 2024
 */

import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { LoginDto, RegisterDto, VerificationCodeType } from './dto/auth.dto';
import {
  VerificationCodeException,
  VerificationCodeRateLimitException,
  RecipientEmailMissingException,
  ExternalServiceException,
  ResourceNotFoundException,
  PhoneNumberExistsException,
  EmailExistsException,
  AuthenticationException,
} from '../../common/exceptions/business.exceptions';
import { UserStatus, UserType } from '../users/dto/user.dto';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  staticOperatorMapping: {
    findFirst: jest.fn(),
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
  findUserEmailByPhoneNumber: jest.fn(),
};

const mockEmailService = {
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
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
        { provide: EmailService, useValue: mockEmailService },
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
    const phoneNumber = '13800138000';
    const codeKey = `verification_code:register:${phoneNumber}`;
    const issuedEmailKey = `verification_code_email:register:${phoneNumber}`;
    const boundEmail = 'new-user@example.com';

    const registerDto: RegisterDto = {
      phoneNumber,
      verificationCode: '123456',
      name: '新用户',
      email: boundEmail,
    };

    const mockIssuedEmail = (issuedEmail: string | undefined) => {
      mockCacheManager.get.mockImplementation((key: string) => {
        if (key === codeKey) return Promise.resolve('123456');
        if (key === issuedEmailKey) return Promise.resolve(issuedEmail);
        return Promise.resolve(undefined);
      });
    };

    it('应该成功注册', async () => {
      const mockUser = {
        id: 'new-user-id',
        name: '新用户',
        phone: '138****8000',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      mockIssuedEmail(boundEmail);
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);
      mockUsersService.createUser.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(result.accessToken).toBeDefined();
      expect(result.user.name).toBe('新用户');
    });

    it('邮箱的大小写・前後空白の差は正規化して一致とみなす', async () => {
      const mockUser = {
        id: 'new-user-id',
        name: '新用户',
        phone: '138****8000',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      mockIssuedEmail('  New-User@Example.COM  ');
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);
      mockUsersService.createUser.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(result.accessToken).toBeDefined();
    });

    it('email が発码宛先と一致しない場合は拒否しコードを消費しない', async () => {
      mockIssuedEmail('someone-else@example.com');
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow(VerificationCodeException);

      // 不一致時は validate 前に中断し、コード・试行カウンタを消費しない
      expect(mockCacheManager.del).not.toHaveBeenCalledWith(codeKey);
      expect(mockCacheManager.del).not.toHaveBeenCalledWith(
        `verification_code:attempts:register:${phoneNumber}`,
      );
      expect(mockUsersService.createUser).not.toHaveBeenCalled();
    });

    it('email 未指定の場合は拒否する', async () => {
      mockIssuedEmail(boundEmail);
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);

      await expect(
        service.register({ ...registerDto, email: undefined }),
      ).rejects.toThrow(VerificationCodeException);

      expect(mockCacheManager.del).not.toHaveBeenCalledWith(codeKey);
      expect(mockUsersService.createUser).not.toHaveBeenCalled();
    });

    it('発码宛先が保存されていない場合（未送信）は拒否する', async () => {
      mockIssuedEmail(undefined);
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow(VerificationCodeException);

      expect(mockUsersService.createUser).not.toHaveBeenCalled();
    });

    it('应该抛出手机号已存在异常', async () => {
      const existingUser = { id: 'existing-user-id' };

      mockIssuedEmail(boundEmail);
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(PhoneNumberExistsException);
    });

    it('应该透传邮箱已存在异常', async () => {
      const existingEmail = 'test@example.com';

      mockIssuedEmail(existingEmail);
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);
      mockUsersService.createUser.mockRejectedValue(new EmailExistsException(existingEmail));

      await expect(service.register({ ...registerDto, email: existingEmail })).rejects.toThrow(EmailExistsException);
    });
  });

  describe('sendVerificationCode', () => {
    const phoneNumber = '13800138000';
    const registerEmail = 'new-user@example.com';

    it('注册场景：手机号已存在应该抛出异常', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUsersService.findUserByPhoneNumber.mockResolvedValue({ id: 'existing-user-id' });

      await expect(
        service.sendVerificationCode(phoneNumber, VerificationCodeType.REGISTER, registerEmail)
      ).rejects.toThrow(PhoneNumberExistsException);
    });

    it('登录场景：用户不存在应该抛出异常', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);

      await expect(
        service.sendVerificationCode(phoneNumber, VerificationCodeType.LOGIN)
      ).rejects.toThrow(ResourceNotFoundException);
    });

    it('登录场景：用户被禁用应该抛出异常', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      mockUsersService.findUserByPhoneNumber.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.INACTIVE,
      });

      await expect(
        service.sendVerificationCode(phoneNumber, VerificationCodeType.LOGIN)
      ).rejects.toThrow(AuthenticationException);
    });

    it('注册场景：应该向请求邮箱发送邮件并按 type スコープ键保存验证码', async () => {
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.sendVerificationCode(
        phoneNumber,
        VerificationCodeType.REGISTER,
        registerEmail,
      );

      expect(result.message).toBe('验证码发送成功');
      expect(mockEmailService.sendVerificationCode).toHaveBeenCalledTimes(1);

      const [to, code, expiresMinutes] = mockEmailService.sendVerificationCode.mock.calls[0];
      expect(to).toBe(registerEmail);
      expect(code).toMatch(/^\d{6}$/);
      expect(expiresMinutes).toBe(5);

      // 保存値は素の6桁文字列のまま（外部 e2e 互換）
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `verification_code:register:${phoneNumber}`,
        code,
        300 * 1000,
      );
      // クールダウンは送信成功後に設定される
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `verification_code:cooldown:register:${phoneNumber}`,
        1,
        60 * 1000,
      );
    });

    it('注册场景：缺少邮箱时应该抛出 RecipientEmailMissingException 且不发送邮件', async () => {
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);
      mockCacheManager.get.mockResolvedValue(undefined);

      await expect(
        service.sendVerificationCode(phoneNumber, VerificationCodeType.REGISTER)
      ).rejects.toThrow(RecipientEmailMissingException);

      expect(mockEmailService.sendVerificationCode).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('登录场景：应该向数据库中的绑定邮箱发送验证码', async () => {
      mockUsersService.findUserByPhoneNumber.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.ACTIVE,
      });
      mockUsersService.findUserEmailByPhoneNumber.mockResolvedValue('bound@example.com');
      mockCacheManager.get.mockResolvedValue(undefined);

      await service.sendVerificationCode(phoneNumber, VerificationCodeType.LOGIN);

      expect(mockUsersService.findUserEmailByPhoneNumber).toHaveBeenCalledWith(phoneNumber);
      expect(mockEmailService.sendVerificationCode).toHaveBeenCalledWith(
        'bound@example.com',
        expect.stringMatching(/^\d{6}$/),
        5,
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `verification_code:login:${phoneNumber}`,
        expect.stringMatching(/^\d{6}$/),
        300 * 1000,
      );
    });

    it('登录场景：账号未绑定邮箱时应该抛出 RecipientEmailMissingException', async () => {
      mockUsersService.findUserByPhoneNumber.mockResolvedValue({
        id: 'user-id',
        status: UserStatus.ACTIVE,
      });
      mockUsersService.findUserEmailByPhoneNumber.mockResolvedValue(null);
      mockCacheManager.get.mockResolvedValue(undefined);

      await expect(
        service.sendVerificationCode(phoneNumber, VerificationCodeType.LOGIN)
      ).rejects.toThrow(RecipientEmailMissingException);

      expect(mockEmailService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('邮件发送失败时应该抛出 ExternalServiceException 且不保存验证码', async () => {
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(null);
      mockCacheManager.get.mockResolvedValue(undefined);
      mockEmailService.sendVerificationCode.mockRejectedValueOnce(new Error('SMTP unavailable'));

      await expect(
        service.sendVerificationCode(phoneNumber, VerificationCodeType.REGISTER, registerEmail)
      ).rejects.toThrow(ExternalServiceException);

      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('クールダウン中は VerificationCodeRateLimitException を投げて送信しない', async () => {
      mockCacheManager.get.mockImplementation((key: string) =>
        Promise.resolve(
          key === `verification_code:cooldown:register:${phoneNumber}` ? 1 : undefined,
        ),
      );

      await expect(
        service.sendVerificationCode(phoneNumber, VerificationCodeType.REGISTER, registerEmail)
      ).rejects.toThrow(VerificationCodeRateLimitException);

      expect(mockEmailService.sendVerificationCode).not.toHaveBeenCalled();
      expect(mockUsersService.findUserByPhoneNumber).not.toHaveBeenCalled();
    });
  });

  describe('validateVerificationCode（type スコープキー・试行回数制限）', () => {
    const phoneNumber = '13800138000';
    const loginDto: LoginDto = { phoneNumber, verificationCode: '000000' };

    it('误输入時は type スコープの试行计数键をインクリメントする', async () => {
      mockCacheManager.get.mockImplementation((key: string) =>
        Promise.resolve(key === `verification_code:login:${phoneNumber}` ? '123456' : undefined),
      );

      await expect(service.login(loginDto)).rejects.toThrow(VerificationCodeException);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `verification_code:attempts:login:${phoneNumber}`,
        1,
        300 * 1000,
      );
    });

    it('试行回数が上限に達したら验证码を削除して例外（メッセージは不一致と区別不能）', async () => {
      mockCacheManager.get.mockImplementation((key: string) => {
        if (key === `verification_code:login:${phoneNumber}`) return Promise.resolve('123456');
        if (key === `verification_code:attempts:login:${phoneNumber}`) return Promise.resolve(4);
        return Promise.resolve(undefined);
      });

      await expect(service.login(loginDto)).rejects.toThrow('验证码错误或已过期');

      expect(mockCacheManager.del).toHaveBeenCalledWith(`verification_code:login:${phoneNumber}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        `verification_code:attempts:login:${phoneNumber}`,
      );
      expect(mockCacheManager.set).not.toHaveBeenCalledWith(
        `verification_code:attempts:login:${phoneNumber}`,
        expect.anything(),
        expect.anything(),
      );
    });

    it('验证码不存在時も不一致時と同じメッセージを返す', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);

      await expect(service.login(loginDto)).rejects.toThrow('验证码错误或已过期');
    });

    it('验证成功時は type スコープ键を削除する', async () => {
      const mockUser = {
        id: 'user-id',
        name: '测试用户',
        phone: '138****8000',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      mockCacheManager.get.mockImplementation((key: string) =>
        Promise.resolve(key === `verification_code:login:${phoneNumber}` ? '000000' : undefined),
      );
      mockUsersService.findUserByPhoneNumber.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBeDefined();
      expect(mockCacheManager.del).toHaveBeenCalledWith(`verification_code:login:${phoneNumber}`);
    });

    it('再送後は试行回数がリセットされ、4 回误输入済みでも新コードが有効', async () => {
      // 実運用に近い get/set/del の往復を再現するステートフルなストア
      const store = new Map<string, unknown>();
      mockCacheManager.get.mockImplementation((key: string) => Promise.resolve(store.get(key)));
      mockCacheManager.set.mockImplementation((key: string, value: unknown) => {
        store.set(key, value);
        return Promise.resolve(undefined);
      });
      mockCacheManager.del.mockImplementation((key: string) => {
        store.delete(key);
        return Promise.resolve(undefined);
      });

      const codeKey = `verification_code:login:${phoneNumber}`;
      const attemptsKey = `verification_code:attempts:login:${phoneNumber}`;
      const mockUser = {
        id: 'user-id',
        name: '测试用户',
        phone: '138****8000',
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      };

      mockUsersService.findUserByPhoneNumber.mockResolvedValue(mockUser);
      mockUsersService.findUserEmailByPhoneNumber.mockResolvedValue('bound@example.com');
      mockEmailService.sendVerificationCode.mockResolvedValue(undefined);

      // 既存コードに対して 4 回误输入（上限 5 回の手前まで）
      store.set(codeKey, '111111');
      for (let i = 0; i < 4; i += 1) {
        await expect(service.login(loginDto)).rejects.toThrow(VerificationCodeException);
      }
      expect(store.get(attemptsKey)).toBe(4);

      // 再送（メール送信成功）→ 试行カウンタがフルリセットされる
      await service.sendVerificationCode(phoneNumber, VerificationCodeType.LOGIN);
      expect(store.has(attemptsKey)).toBe(false);

      const newCodeCalls = mockEmailService.sendVerificationCode.mock.calls;
      const newCode = newCodeCalls[newCodeCalls.length - 1][1] as string;
      expect(newCode).toMatch(/^\d{6}$/);

      // リセットされていなければこの 1 回で 5 回目となり新コードが失効してしまう
      await expect(service.login(loginDto)).rejects.toThrow(VerificationCodeException);
      expect(store.get(attemptsKey)).toBe(1);
      expect(store.get(codeKey)).toBe(newCode);

      // 新しいコードは有効（4 回误输入の履歴に食われない）
      const result = await service.login({ phoneNumber, verificationCode: newCode });
      expect(result.accessToken).toBeDefined();
    });
  });

  describe('refreshToken', () => {
    // 仅用于喂给 mock 的夹具令牌,运行期随机生成,无任何真实凭据含义
    const MOCK_REFRESH_TOKEN = randomUUID();

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

      const result = await service.refreshToken({ refreshToken: MOCK_REFRESH_TOKEN });

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
    const mockUser = {
      id: 'user-id',
      name: '测试用户',
      email: 'test@example.com',
      phone: '138****8000',
      userType: UserType.CUSTOMER,
      status: UserStatus.ACTIVE,
    };

    it('应该成功获取用户信息', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.staticOperatorMapping.findFirst.mockResolvedValue(null);

      const result = await service.getUserProfile('user-id');

      expect(result.id).toBe('user-id');
      expect(result.mappingActive).toBe(false);
    });

    it('存在 active 映射时 mappingActive 为 true（per-user 定位）', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.staticOperatorMapping.findFirst.mockResolvedValue({ id: 'mapping-id' });

      const result = await service.getUserProfile('user-id');

      expect(result.mappingActive).toBe(true);
      expect(mockPrismaService.staticOperatorMapping.findFirst).toHaveBeenCalledWith({
        where: { bookingUserId: 'user-id', active: true },
        select: { id: true },
      });
    });

    it('无映射时 mappingActive 为 false', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.staticOperatorMapping.findFirst.mockResolvedValue(null);

      const result = await service.getUserProfile('user-id');

      expect(result.mappingActive).toBe(false);
      expect(mockPrismaService.staticOperatorMapping.findFirst).toHaveBeenCalledWith({
        where: { bookingUserId: 'user-id', active: true },
        select: { id: true },
      });
    });

    it('应该抛出用户不存在异常', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserProfile('non-existent-id')).rejects.toThrow(ResourceNotFoundException);
    });
  });
});
