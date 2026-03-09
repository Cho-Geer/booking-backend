/**
 * 认证服务
 * 处理用户认证相关的业务逻辑
 * @author Booking System
 * @since 2024
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, LoginResponseDto, RefreshTokenDto, VerificationCodeType } from './dto/auth.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import {
  AuthenticationException,
  ResourceNotFoundException,
  PhoneNumberExistsException,
  VerificationCodeException,
  DatabaseException,
  InvalidPhoneNumberException,
  ValidationException,
} from '../../common/exceptions/business.exceptions';
import { UsersService } from '../users/users.service';
import { UserStatus, UserType, UserRole } from '../users/dto/user.dto';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private usersService: UsersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {}

  /**
   * 用户登录
   * @param loginDto 登录数据
   * @returns 登录响应
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    try {
      // 验证验证码
      const isValidCode = await this.validateVerificationCode(
        loginDto.phoneNumber,
        loginDto.verificationCode,
      );

      if (!isValidCode) {
        throw new VerificationCodeException();
      }

      // 根据手机号查找用户
      const user = await this.usersService.findUserByPhoneNumber(loginDto.phoneNumber);

      if (!user) {
        throw new ResourceNotFoundException('用户不存在，请先注册');
      }

      // 检查用户状态
      if (user.status !== UserStatus.ACTIVE) {
        throw new AuthenticationException('用户账户已被禁用');
      }

      // 生成JWT令牌
      const tokens = await this.generateTokens(user);

      this.logger.log(`用户登录成功: ${user.id} - ${user.name}`);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: Number(this.configService.get('JWT_EXPIRES_IN') || 3600), // 1小时
        user: {
          id: user.id,
          name: user.name,
          phoneNumber: user.phone,
          role: user.userType,
          status: user.status,
        },
      };
    } catch (error) {
      if (error instanceof VerificationCodeException || 
          error instanceof ResourceNotFoundException ||
          error instanceof AuthenticationException) {
        throw error;
      }
      
      this.logger.error(`用户登录失败: ${error.message}`, error.stack);
      throw new AuthenticationException('登录失败，请重试');
    }
  }

  /**
   * 用户注册
   * @param registerDto 注册数据
   * @returns 注册响应
   */
  async register(registerDto: RegisterDto): Promise<LoginResponseDto> {
    try {
      // 验证验证码
      const isValidCode = await this.validateVerificationCode(
        registerDto.phoneNumber,
        registerDto.verificationCode,
      );

      if (!isValidCode) {
        throw new VerificationCodeException();
      }

      // 检查手机号是否已存在
      const existingUser = await this.usersService.findUserByPhoneNumber(registerDto.phoneNumber);
      if (existingUser) {
        throw new PhoneNumberExistsException('手机号已被注册');
      }

      // 创建用户
      const user = await this.usersService.createUser({
        name: registerDto.name,
        phone: registerDto.phoneNumber,
        email: registerDto.email,
        userType: UserType.CUSTOMER,
        status: UserStatus.ACTIVE,
      });

      // 生成JWT令牌
      const tokens = await this.generateTokens(user);

      this.logger.log(`用户注册成功: ${user.id} - ${user.name}`);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: Number(this.configService.get('JWT_EXPIRES_IN') || 3600),
        user: {
          id: user.id,
          name: user.name,
          phoneNumber: user.phone,
          role: user.userType,
          status: user.status,
        },
      };
    } catch (error) {
      if (error instanceof VerificationCodeException || 
          error instanceof PhoneNumberExistsException) {
        throw error;
      }
      
      this.logger.error(`用户注册失败: ${error.message}`, error.stack);
      throw new DatabaseException('注册失败，请重试');
    }
  }

  /**
   * 刷新访问令牌
   * @param refreshTokenDto 刷新令牌数据
   * @returns 新的访问令牌
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<LoginResponseDto> {
    try {
      // 检查刷新令牌是否在黑名单中
      const tokenHash = crypto.createHash('sha256').update(refreshTokenDto.refreshToken).digest('hex');
      const isBlacklisted = await this.cacheManager.get(`blacklist:${tokenHash}`);
      
      if (isBlacklisted) {
        throw new AuthenticationException('刷新令牌已被吊销');
      }
      
      // 验证刷新令牌
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // 根据用户ID查找用户
      const user = await this.usersService.findUserById(payload.sub);

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new AuthenticationException('用户不存在或已被禁用');
      }

      // 生成新的令牌
      const tokens = await this.generateTokens(user);

      this.logger.log(`令牌刷新成功: ${user.id}`);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: Number(this.configService.get('JWT_EXPIRES_IN') || 3600),
        user: {
          id: user.id,
          name: user.name,
          phoneNumber: user.phone,
          role: user.userType,
          status: user.status,
        },
      };
    } catch (error) {
      this.logger.error(`刷新令牌失败: ${error.message}`, error.stack);
      throw new AuthenticationException('刷新令牌无效');
    }
  }

  /**
   * 发送验证码
   * @param phoneNumber 手机号
   * @param type 验证码类型
   * @returns 发送结果
   */
  async sendVerificationCode(phoneNumber: string, type: VerificationCodeType): Promise<ApiResponseDto<void>> {
    try {
      // 1. 查询手机号是否已存在
      const existingUser = await this.usersService.findUserByPhoneNumber(phoneNumber);

      // 2. 根据场景进行不同的预检
      if (type === VerificationCodeType.REGISTER) {
        // 【注册场景】：如果用户已存在，报错阻止
        if (existingUser) {
          throw new PhoneNumberExistsException(phoneNumber);
        }
      } else if (type === VerificationCodeType.LOGIN) {
        // 【登录场景】：如果用户不存在，报错引导去注册
        if (!existingUser) {
          // 这里抛出 404 异常，前端捕获后可自动跳转到注册页
          throw new ResourceNotFoundException('用户不存在，请先注册');
        }
        // 登录场景额外检查：账号是否被禁用
        if (existingUser.status !== UserStatus.ACTIVE) {
          throw new AuthenticationException('用户账户已被禁用');
        }
      }

      // 3. 通用逻辑：生成并保存验证码
      const verificationCode = this.generateVerificationCode();
      
      // 保存验证码到Redis
      await this.saveVerificationCode(phoneNumber, verificationCode);

      // TODO: 集成短信服务发送验证码
      this.logger.log(`[${type}] 验证码已生成: ${phoneNumber} - ${verificationCode}`);
      
      return ApiResponseDto.success(null, '验证码发送成功');
    } catch (error) {
      if (error instanceof PhoneNumberExistsException || 
          error instanceof ResourceNotFoundException ||
          error instanceof AuthenticationException ||
          error instanceof InvalidPhoneNumberException) {
        throw error;
      }
      this.logger.error(`发送验证码失败: ${error.message}`, error.stack);
      throw new DatabaseException('发送验证码失败');
    }
  }

  /**
   * 用户登出
   * @param userId 用户ID
   * @param refreshToken 刷新令牌
   * @param accessToken 访问令牌
   * @returns 登出结果
   */
  async logout(userId: string, refreshToken: string, accessToken: string): Promise<ApiResponseDto<void>> {
    try {
      // 将刷新令牌加入黑名单
      await this.addRefreshTokenToBlacklist(refreshToken);
      // 将访问令牌加入黑名单
      await this.addAccessTokenToBlacklist(accessToken);
      this.logger.log(`用户登出: ${userId}`);
      
      return ApiResponseDto.success(null, '登出成功');
    } catch (error) {
      this.logger.error(`用户登出失败: ${error.message}`, error.stack);
      throw new DatabaseException('登出失败');
    }
  }

  /**
   * 将刷新令牌加入黑名单
   * @param refreshToken 刷新令牌
   */
  private async addRefreshTokenToBlacklist(refreshToken: string): Promise<void> {
    try {
      if (!refreshToken) {
        return;
      }
      
      // 验证刷新令牌并获取过期时间
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      
      // 计算令牌剩余有效期（秒）
      const expiresAt = payload.exp;
      const now = Math.floor(Date.now() / 1000);
      const ttl = expiresAt - now;
      
      if (ttl > 0) {
        // 使用Redis存储黑名单，键为令牌哈希，值为1，过期时间为令牌剩余有效期
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await this.cacheManager.set(`blacklist:${tokenHash}`, 1, ttl * 1000);
      }
    } catch (error) {
      // 令牌无效时忽略错误，不影响登出流程
      this.logger.warn(`无效的刷新令牌: ${error.message}`);
    }
  }

  /**
   * 将访问令牌加入黑名单
   * @param accessToken 访问令牌
   */
  private async addAccessTokenToBlacklist(accessToken: string): Promise<void> {
    try {
      if (!accessToken) {
        return;
      }
      
      // 验证访问令牌并获取过期时间
      const payload = this.jwtService.verify(accessToken, {
        secret: this.configService.get('JWT_SECRET'),
      });
      
      // 计算令牌剩余有效期（秒）
      const expiresAt = payload.exp;
      const now = Math.floor(Date.now() / 1000);
      const ttl = expiresAt - now;
      
      if (ttl > 0) {
        // 使用Redis存储黑名单，键为令牌哈希，值为1，过期时间为令牌剩余有效期
        const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
        await this.cacheManager.set(`blacklist:${tokenHash}`, 1, ttl * 1000);
      }
    } catch (error) {
      // 令牌无效时忽略错误，不影响登出流程
      this.logger.warn(`无效的访问令牌: ${error.message}`);
    }
  }

  /**
   * 获取用户详细信息
   * @param userId 用户ID
   * @returns 用户信息
   */
  async getUserProfile(userId: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          userType: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new ResourceNotFoundException('用户不存在');
      }

      return user;
    } catch (error) {
      this.logger.error(`获取用户信息失败: ${error.message}`, error.stack);
      if (error instanceof ResourceNotFoundException) {
        throw error;
      }
      throw new DatabaseException('获取用户信息失败');
    }
  }

  /**
   * 检查手机号是否已存在
   * @param phoneNumber 手机号
   * @returns 是否存在
   */
  async checkPhoneNumberExists(phoneNumber: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { phone: phoneNumber },
        select: { id: true },
      });

      return !!user;
    } catch (error) {
      this.logger.error(`检查手机号失败: ${error.message}`, error.stack);
      throw new DatabaseException('检查手机号失败');
    }
  }

  /**
   * 生成JWT令牌
   * @param user 用户信息
   * @returns 访问令牌和刷新令牌
   */
  private async generateTokens(user: any): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = {
      sub: user.id,
      email: user.email,
      phoneNumber: user.phone,
      role: user.userType,
    };

    // 获取配置值，默认为 3600
    const jwtExpiresIn = this.configService.get('JWT_EXPIRES_IN') || 3600;
    const jwtRefreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN') || 604800;

    // 辅助处理函数：如果是纯数字字符串则转为数字（秒），否则保留字符串（如 "1d"）
    const resolveExpiresIn = (val: string | number) => {
      const num = Number(val);
      return !isNaN(num) ? num : val;
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: resolveExpiresIn(jwtExpiresIn),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: resolveExpiresIn(jwtRefreshExpiresIn),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * 验证手机号格式
   * @param phoneNumber 手机号
   * @returns 是否有效
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // 简单的中国大陆手机号正则
    return /^1[3-9]\d{9}$/.test(phoneNumber);
  }

  /**
   * 验证验证码
   * @param phoneNumber 手机号
   * @param verificationCode 验证码
   * @returns 验证结果
   */
  private async validateVerificationCode(
    phoneNumber: string,
    verificationCode: string,
  ): Promise<boolean> {
    const key = `verification_code:${phoneNumber}`;
    const storedCode = await this.cacheManager.get<string>(key);

    if (!storedCode) {
      throw new VerificationCodeException('验证码已过期或不存在');
    }

    if (storedCode !== verificationCode) {
      throw new VerificationCodeException('验证码错误');
    }

    // 验证成功后删除验证码，防止重复使用
    await this.cacheManager.del(key);
    
    return true;
  }

  /**
   * 生成6位数验证码
   * @returns 验证码
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 保存验证码到Redis
   * @param phoneNumber 手机号
   * @param verificationCode 验证码
   */
  private async saveVerificationCode(phoneNumber: string, verificationCode: string): Promise<void> {
    const key = `verification_code:${phoneNumber}`;
    // 设置验证码有效期为5分钟 (300秒)
    // 注意: cache-manager v5+ 使用毫秒作为TTL，而 v4 使用秒
    // 假设使用的是较新版本，或者根据项目配置调整
    await this.cacheManager.set(key, verificationCode, 300 * 1000);
    
    // 开发环境下打印验证码，方便测试
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`保存验证码: ${phoneNumber} - ${verificationCode}`);
    }
  }

  /**
   * 验证JWT令牌
   * @param token JWT令牌
   * @returns 令牌载荷
   */
  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
    } catch (error) {
      this.logger.error(`验证令牌失败: ${error.message}`);
      throw new AuthenticationException('令牌无效');
    }
  }
}