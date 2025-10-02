/**
 * 认证相关DTO
 * 处理用户认证的数据传输对象
 * @author Booking System
 * @since 2024
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsPhoneNumber, IsOptional } from 'class-validator';

/**
 * 用户登录请求DTO
 */
export class LoginDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsPhoneNumber('CN', { message: '请输入有效的手机号' })
  phoneNumber: string;

  @ApiProperty({ description: '验证码', example: '123456' })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString({ message: '验证码必须是字符串' })
  verificationCode: string;
}

/**
 * 用户注册请求DTO
 */
export class RegisterDto {
  @ApiProperty({ description: '用户姓名', example: '张三' })
  @IsNotEmpty({ message: '用户姓名不能为空' })
  @IsString({ message: '用户姓名必须是字符串' })
  name: string;

  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsPhoneNumber('CN', { message: '请输入有效的手机号' })
  phoneNumber: string;

  @ApiProperty({ description: '验证码', example: '123456' })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString({ message: '验证码必须是字符串' })
  verificationCode: string;
}

/**
 * 发送验证码请求DTO
 */
export class SendVerificationCodeDto {
  @ApiProperty({ description: '手机号', example: '13800138000' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsPhoneNumber('CN', { message: '请输入有效的手机号' })
  phoneNumber: string;
}

/**
 * 刷新Token请求DTO
 */
export class RefreshTokenDto {
  @ApiProperty({ description: '刷新令牌', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsNotEmpty({ message: '刷新令牌不能为空' })
  @IsString({ message: '刷新令牌必须是字符串' })
  refreshToken: string;
}

/**
 * 登录响应DTO
 */
export class LoginResponseDto {
  @ApiProperty({ description: '访问令牌' })
  accessToken: string;

  @ApiProperty({ description: '刷新令牌' })
  refreshToken: string;

  @ApiProperty({ description: '令牌类型' })
  tokenType: string;

  @ApiProperty({ description: '过期时间（秒）' })
  expiresIn: number;

  @ApiProperty({ description: '用户信息' })
  user: {
    id: string;
    name: string;
    phoneNumber: string;
    role: string;
    status: string;
  };
}

/**
 * 用户信息响应DTO
 */
export class UserInfoResponseDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '用户姓名' })
  name: string;

  @ApiProperty({ description: '手机号' })
  phoneNumber: string;

  @ApiProperty({ description: '用户角色' })
  role: string;

  @ApiProperty({ description: '用户状态' })
  status: string;

  @ApiProperty({ description: '备注' })
  remarks?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}