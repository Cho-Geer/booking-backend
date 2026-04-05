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

    await controller.logout({ id: 'user-1' }, request, response);

    expect(mockAuthService.logout).toHaveBeenCalledWith('user-1', null, 'access-from-header');
    expect(response.clearCookie).toHaveBeenCalledWith('access_token');
    expect(response.clearCookie).toHaveBeenCalledWith('refresh_token');
    expect(response.clearCookie).toHaveBeenCalledWith('csrf_token');
  });
});
