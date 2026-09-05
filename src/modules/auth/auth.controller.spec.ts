import { Test, TestingModule } from '@nestjs/testing';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const mockAuthService = {
    logout: jest.fn().mockResolvedValue(undefined),
    getUserProfile: jest.fn(),
  };
  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  it('uses bearer access token on logout when cookies are absent', async () => {
    const request = {
      cookies: {},
      headers: { authorization: 'Bearer access-from-header' },
    } as unknown as Request;
    const response = {
      clearCookie: jest.fn(),
    } as unknown as Response;
    
    // 模拟ConfigService返回值
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'COOKIE_SAME_SITE') return 'lax';
      if (key === 'COOKIE_DOMAIN') return undefined;
      return undefined;
    });

    await controller.logout({ id: 'user-1' }, request, response);

    expect(mockAuthService.logout).toHaveBeenCalledWith('user-1', null, 'access-from-header');
    expect(response.clearCookie).toHaveBeenCalledWith('access_token', {
      path: '/',
      secure: false,
      sameSite: 'lax',
    });
    expect(response.clearCookie).toHaveBeenCalledWith('refresh_token', {
      path: '/',
      secure: false,
      sameSite: 'lax',
    });
    expect(response.clearCookie).toHaveBeenCalledWith('csrf_token', {
      path: '/',
      secure: false,
      sameSite: 'lax',
    });
  });

  it('getProfile 应透传当前用户 ID 并返回含 mappingActive 的用户信息', async () => {
    const profileUser = {
      id: 'user-1',
      name: '测试用户',
      phoneNumber: '138****8000',
      email: 'test@example.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      mappingActive: true,
    };
    mockAuthService.getUserProfile.mockResolvedValue(profileUser);

    const result = await controller.getProfile({ id: 'user-1' });

    expect(mockAuthService.getUserProfile).toHaveBeenCalledWith('user-1');
    expect(result.data).toEqual(profileUser);
    expect(result.data.mappingActive).toBe(true);
  });
});
