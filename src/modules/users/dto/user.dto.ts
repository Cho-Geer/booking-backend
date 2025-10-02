/**
 * 用户相关DTO定义
 * 提供用户模块的数据传输对象
 * @author Booking System
 * @since 2024
 */

import { IsString, IsEnum, IsOptional, IsDate, IsBoolean, IsPhoneNumber, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UserType as PrismaUserType, UserStatus as PrismaUserStatus } from '@prisma/client';

/**
 * 用户状态枚举
 */
export type UserStatus = PrismaUserStatus;
export const UserStatus = PrismaUserStatus;

/**
 * 用户类型枚举
 */
export type UserType = PrismaUserType;
export const UserType = PrismaUserType;

/**
 * 用户角色枚举（为了向后兼容）
 */
export enum UserRole {
  USER = 'CUSTOMER',
  ADMIN = 'ADMIN'
}

/**
 * 创建用户DTO
 */
export class CreateUserDto {
  @ApiProperty({ description: '用户姓名' })
  @IsString({ message: '姓名必须是字符串' })
  @IsNotEmpty({ message: '姓名不能为空' })
  @MaxLength(50, { message: '姓名最多50个字符' })
  name: string;

  @ApiProperty({ description: '手机号' })
  @IsPhoneNumber('CN', { message: '手机号格式不正确' })
  @IsNotEmpty({ message: '手机号不能为空' })
  phone: string;

  @ApiProperty({ description: '用户类型', enum: UserType, required: false, default: UserType.CUSTOMER })
  @IsEnum(UserType, { message: '无效的用户类型' })
  @IsOptional()
  userType?: UserType = UserType.CUSTOMER;

  @ApiProperty({ description: '用户状态', enum: UserStatus, required: false, default: UserStatus.ACTIVE })
  @IsEnum(UserStatus, { message: '无效的用户状态' })
  @IsOptional()
  status?: UserStatus = UserStatus.ACTIVE;

  @ApiProperty({ description: '备注信息', required: false })
  @IsString({ message: '备注必须是字符串' })
  @IsOptional()
  @MaxLength(500, { message: '备注最多500个字符' })
  remarks?: string;
}

/**
 * 更新用户DTO
 */
export class UpdateUserDto {
  @ApiProperty({ description: '用户姓名', required: false })
  @IsString({ message: '姓名必须是字符串' })
  @IsOptional()
  @MaxLength(50, { message: '姓名最多50个字符' })
  name?: string;

  @ApiProperty({ description: '手机号', required: false })
  @IsPhoneNumber('CN', { message: '手机号格式不正确' })
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: '用户类型', enum: UserType, required: false })
  @IsEnum(UserType, { message: '无效的用户类型' })
  @IsOptional()
  userType?: UserType;

  @ApiProperty({ description: '用户状态', enum: UserStatus, required: false })
  @IsEnum(UserStatus, { message: '无效的用户状态' })
  @IsOptional()
  status?: UserStatus;

  @ApiProperty({ description: '备注信息', required: false })
  @IsString({ message: '备注必须是字符串' })
  @IsOptional()
  @MaxLength(500, { message: '备注最多500个字符' })
  remarks?: string;
}

/**
 * 用户响应DTO
 */
export class UserResponseDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '用户姓名' })
  name: string;

  @ApiProperty({ description: '手机号（脱敏）' })
  phone: string;

  @ApiProperty({ description: '用户类型', enum: UserType })
  userType: UserType;

  @ApiProperty({ description: '用户状态', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: '备注信息' })
  remarks?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

/**
 * 用户列表响应DTO
 */
export class UserListResponseDto {
  @ApiProperty({ description: '用户列表', type: [UserResponseDto] })
  items: UserResponseDto[];

  @ApiProperty({ description: '总记录数' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;
}

/**
 * 查询用户DTO
 */
export class QueryUserDto {
  @ApiProperty({ description: '用户姓名', required: false })
  @IsString({ message: '姓名必须是字符串' })
  @IsOptional()
  name?: string;

  @ApiProperty({ description: '手机号', required: false })
  @IsPhoneNumber('CN', { message: '手机号格式不正确' })
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: '用户类型', enum: UserType, required: false })
  @IsEnum(UserType, { message: '无效的用户类型' })
  @IsOptional()
  userType?: UserType;

  @ApiProperty({ description: '用户状态', enum: UserStatus, required: false })
  @IsEnum(UserStatus, { message: '无效的用户状态' })
  @IsOptional()
  status?: UserStatus;

  @ApiProperty({ description: '开始时间', required: false })
  @IsDate({ message: '开始时间必须是日期格式' })
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @ApiProperty({ description: '结束时间', required: false })
  @IsDate({ message: '结束时间必须是日期格式' })
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @ApiProperty({ description: '页码', required: false, default: 1, minimum: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false, default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({ description: '排序字段', required: false, default: 'createdAt' })
  @IsString({ message: '排序字段必须是字符串' })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({ description: '排序方式', required: false, default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
}

/**
 * 用户统计DTO
 */
export class UserStatsDto {
  @ApiProperty({ description: '用户总数' })
  totalUsers: number;

  @ApiProperty({ description: '活跃用户数量' })
  activeUsers: number;

  @ApiProperty({ description: '非活跃用户数量' })
  inactiveUsers: number;

  @ApiProperty({ description: '被禁用用户数量' })
  blockedUsers: number;

  @ApiProperty({ description: '普通用户数量' })
  normalUsers: number;

  @ApiProperty({ description: '管理员数量' })
  adminUsers: number;

  @ApiProperty({ description: '超级管理员数量' })
  superAdminUsers: number;

  @ApiProperty({ description: '今日新增用户数量' })
  todayNewUsers: number;

  @ApiProperty({ description: '本周新增用户数量' })
  weekNewUsers: number;

  @ApiProperty({ description: '本月新增用户数量' })
  monthNewUsers: number;

  @ApiProperty({ description: '被暂停用户数量' })
  suspendedUsers: number;
}
