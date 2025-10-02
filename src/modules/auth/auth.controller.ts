/**
 * 认证控制器
 * 处理用户认证相关的HTTP请求
 * @author Booking System
 * @since 2024
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, SendVerificationCodeDto, RefreshTokenDto, LoginResponseDto } from './dto/auth.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SkipJwtAuth } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';

/**
 * 认证控制器类
 * 提供用户认证相关的API接口
 */
@ApiTags('用户认证')
@Controller('auth')
@UseInterceptors(TransformInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户登录
   * @param loginDto 登录数据
   * @returns 登录响应
   */
  @Post('login')
  @SkipJwtAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录', description: '使用手机号和验证码登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: '验证码错误' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async login(@Body(ValidationPipe) loginDto: LoginDto): Promise<ApiResponseDto<LoginResponseDto>> {
    const result = await this.authService.login(loginDto);
    return ApiResponseDto.success(result, '登录成功');
  }

  /**
   * 用户注册
   * @param registerDto 注册数据
   * @returns 注册响应
   */
  @Post('register')
  @SkipJwtAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '用户注册', description: '新用户注册' })
  @ApiResponse({ status: 201, description: '注册成功', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: '验证码错误或用户已存在' })
  async register(@Body(ValidationPipe) registerDto: RegisterDto): Promise<ApiResponseDto<LoginResponseDto>> {
    const result = await this.authService.register(registerDto);
    return ApiResponseDto.success(result, '注册成功');
  }

  /**
   * 发送验证码
   * @param sendVerificationCodeDto 发送验证码数据
   * @returns 发送结果
   */
  @Post('send-verification-code')
  @SkipJwtAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '发送验证码', description: '向指定手机号发送验证码' })
  @ApiResponse({ status: 200, description: '验证码发送成功' })
  @ApiResponse({ status: 429, description: '发送频率过高' })
  async sendVerificationCode(
    @Body(ValidationPipe) sendVerificationCodeDto: SendVerificationCodeDto,
  ): Promise<ApiResponseDto<void>> {
    await this.authService.sendVerificationCode(sendVerificationCodeDto.phoneNumber);
    return ApiResponseDto.success(null, '验证码发送成功');
  }

  /**
   * 刷新访问令牌
   * @param refreshTokenDto 刷新令牌数据
   * @returns 新的访问令牌
   */
  @Post('refresh')
  @SkipJwtAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新令牌', description: '使用刷新令牌获取新的访问令牌' })
  @ApiResponse({ status: 200, description: '令牌刷新成功', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: '刷新令牌无效' })
  async refreshToken(
    @Body(ValidationPipe) refreshTokenDto: RefreshTokenDto,
  ): Promise<ApiResponseDto<LoginResponseDto>> {
    const result = await this.authService.refreshToken(refreshTokenDto);
    return ApiResponseDto.success(result, '令牌刷新成功');
  }

  /**
   * 用户登出
   * @param currentUser 当前用户
   * @returns 登出结果
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户登出', description: '用户登出系统' })
  @ApiResponse({ status: 200, description: '登出成功' })
  async logout(@CurrentUser() currentUser: any): Promise<ApiResponseDto<void>> {
    await this.authService.logout(currentUser.userId);
    return ApiResponseDto.success(null, '登出成功');
  }

  /**
   * 获取当前用户信息
   * @param currentUser 当前用户
   * @returns 用户信息
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户信息', description: '获取当前登录用户的详细信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getProfile(@CurrentUser() currentUser: any): Promise<ApiResponseDto<any>> {
    const user = await this.authService.getUserProfile(currentUser.userId);
    return ApiResponseDto.success(user, '获取用户信息成功');
  }

  /**
   * 验证令牌有效性
   * @param currentUser 当前用户
   * @returns 验证结果
   */
  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '验证令牌', description: '验证访问令牌是否有效' })
  @ApiResponse({ status: 200, description: '令牌有效' })
  @ApiResponse({ status: 401, description: '令牌无效' })
  async verifyToken(@CurrentUser() currentUser: any): Promise<ApiResponseDto<any>> {
    return ApiResponseDto.success(
      {
        userId: currentUser.userId,
        valid: true,
        expiresAt: currentUser.exp * 1000, // 转换为毫秒时间戳
      },
      '令牌验证成功',
    );
  }

  /**
   * 检查手机号是否已注册
   * @param phoneNumber 手机号
   * @returns 检查结果
   */
  @Get('check-phone')
  @SkipJwtAuth()
  @ApiOperation({ summary: '检查手机号', description: '检查手机号是否已注册' })
  @ApiQuery({ name: 'phoneNumber', description: '手机号' })
  @ApiResponse({ status: 200, description: '检查成功' })
  async checkPhoneNumber(@Query('phoneNumber') phoneNumber: string): Promise<ApiResponseDto<{ exists: boolean }>> {
    const exists = await this.authService.checkPhoneNumberExists(phoneNumber);
    return ApiResponseDto.success({ exists }, '检查完成');
  }
}