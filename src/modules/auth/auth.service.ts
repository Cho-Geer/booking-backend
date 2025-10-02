/**
 * 认证服务
 * 处理用户认证相关的业务逻辑
 * @author Booking System
 * @since 2024
 */

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, LoginResponseDto, RefreshTokenDto } from './dto/auth.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import {
  AuthenticationException,
  ResourceNotFoundException,
  PhoneNumberExistsException,
  VerificationCodeException,
  DatabaseException,
} from '../../common/exceptions/business.exceptions';
import { UsersService } from '../users/users.service';
import { UserStatus, UserType, UserRole } from '../users/dto/user.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private usersService: UsersService,
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
        throw new ResourceNotFoundException('用户');
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
        expiresIn: 3600, // 1小时
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
        throw new PhoneNumberExistsException(registerDto.phoneNumber);
      }

      // 创建用户
      const user = await this.usersService.createUser({
        name: registerDto.name,
        phone: registerDto.phoneNumber,
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
        expiresIn: 3600,
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
      // 验证刷新令牌
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: process.env.JWT_SECRET,
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
        expiresIn: 3600,
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
   * @returns 发送结果
   */
  async sendVerificationCode(phoneNumber: string): Promise<ApiResponseDto<void>> {
    try {
      const verificationCode = this.generateVerificationCode();
      
      // 保存验证码到数据库
      await this.saveVerificationCode(phoneNumber, verificationCode);
      
      // TODO: 集成短信服务发送验证码
      this.logger.log(`验证码已生成: ${phoneNumber} - ${verificationCode}`);
      
      return ApiResponseDto.success(null, '验证码发送成功');
    } catch (error) {
      this.logger.error(`发送验证码失败: ${error.message}`, error.stack);
      throw new DatabaseException('发送验证码失败');
    }
  }

  /**
   * 用户登出
   * @param userId 用户ID
   * @returns 登出结果
   */
  async logout(userId: string): Promise<ApiResponseDto<void>> {
    try {
      // TODO: 将刷新令牌加入黑名单
      this.logger.log(`用户登出: ${userId}`);
      
      return ApiResponseDto.success(null, '登出成功');
    } catch (error) {
      this.logger.error(`用户登出失败: ${error.message}`, error.stack);
      throw new DatabaseException('登出失败');
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

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '1h',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
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
    // TODO: 从数据库验证验证码
    // 临时实现：所有验证码都返回true
    this.logger.log(`验证验证码: ${phoneNumber} - ${verificationCode}`);
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
   * 保存验证码到数据库
   * @param phoneNumber 手机号
   * @param verificationCode 验证码
   */
  private async saveVerificationCode(phoneNumber: string, verificationCode: string): Promise<void> {
    // TODO: 实现验证码存储逻辑
    this.logger.log(`保存验证码: ${phoneNumber} - ${verificationCode}`);
  }

  /**
   * 验证JWT令牌
   * @param token JWT令牌
   * @returns 令牌载荷
   */
  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (error) {
      this.logger.error(`验证令牌失败: ${error.message}`);
      throw new AuthenticationException('令牌无效');
    }
  }
}