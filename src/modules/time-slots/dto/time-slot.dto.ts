/**
 * 时间段相关DTO
 * 处理时间段业务的数据传输对象
 * @author Booking System
 * @since 2024
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsBoolean, IsOptional, IsUUID, IsInt, Min, Max, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 创建时间段请求DTO
 */
export class CreateTimeSlotDto {
  @ApiProperty({ description: '时间段时间', example: '09:00:00' })
  @IsNotEmpty({ message: '时间段时间不能为空' })
  @IsString({ message: '时间段时间必须是字符串' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, { message: '时间格式必须为HH:mm:ss' })
  slotTime: string;

  @ApiProperty({ description: '持续时间（分钟）', example: 30 })
  @IsNotEmpty({ message: '持续时间不能为空' })
  @IsInt({ message: '持续时间必须是整数' })
  @Min(15, { message: '持续时间至少15分钟' })
  @Max(480, { message: '持续时间最多480分钟' })
  durationMinutes: number;

  @ApiProperty({ description: '是否激活', example: true })
  @IsNotEmpty({ message: '是否激活不能为空' })
  @IsBoolean({ message: '是否激活必须是布尔值' })
  isActive: boolean;

  @ApiProperty({ description: '显示顺序', required: false, example: 1 })
  @IsOptional()
  @IsInt({ message: '显示顺序必须是整数' })
  @Min(0, { message: '显示顺序不能小于0' })
  displayOrder?: number;
}

/**
 * 更新时间段DTO
 */
export class UpdateTimeSlotDto {
  @ApiProperty({ description: '时间段时间', required: false, example: '09:00:00' })
  @IsOptional()
  @IsString({ message: '时间段时间必须是字符串' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, { message: '时间格式必须为HH:mm:ss' })
  slotTime?: string;

  @ApiProperty({ description: '持续时间（分钟）', required: false, example: 30 })
  @IsOptional()
  @IsInt({ message: '持续时间必须是整数' })
  @Min(15, { message: '持续时间至少15分钟' })
  @Max(480, { message: '持续时间最多480分钟' })
  durationMinutes?: number;

  @ApiProperty({ description: '是否激活', required: false, example: true })
  @IsOptional()
  @IsBoolean({ message: '是否激活必须是布尔值' })
  isActive?: boolean;

  @ApiProperty({ description: '显示顺序', required: false, example: 1 })
  @IsOptional()
  @IsInt({ message: '显示顺序必须是整数' })
  @Min(0, { message: '显示顺序不能小于0' })
  displayOrder?: number;
}

/**
 * 时间段响应DTO
 */
export class TimeSlotResponseDto {
  @ApiProperty({ description: '时间段ID' })
  id: string;

  @ApiProperty({ description: '时间段时间' })
  slotTime: string;

  @ApiProperty({ description: '持续时间（分钟）' })
  durationMinutes: number;

  @ApiProperty({ description: '是否激活' })
  isActive: boolean;

  @ApiProperty({ description: '显示顺序' })
  displayOrder?: number;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

/**
 * 时间段查询DTO
 */
export class TimeSlotQueryDto {
  @ApiProperty({ description: '时间段时间', required: false, example: '09:00:00' })
  @IsOptional()
  @IsString({ message: '时间段时间必须是字符串' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, { message: '时间格式必须为HH:mm:ss' })
  slotTime?: string;

  @ApiProperty({ description: '是否激活', required: false, example: true })
  @IsOptional()
  @IsBoolean({ message: '是否激活必须是布尔值' })
  isActive?: boolean;

  @ApiProperty({ description: '最小持续时间（分钟）', required: false, example: 30 })
  @IsOptional()
  @IsInt({ message: '最小持续时间必须是整数' })
  @Min(15, { message: '最小持续时间至少15分钟' })
  minDuration?: number;

  @ApiProperty({ description: '最大持续时间（分钟）', required: false, example: 120 })
  @IsOptional()
  @IsInt({ message: '最大持续时间必须是整数' })
  @Max(480, { message: '最大持续时间最多480分钟' })
  maxDuration?: number;

  @ApiProperty({ description: '页码', required: false, default: 1, minimum: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false, default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  limit?: number = 10;
}

/**
 * 时间段可用性查询DTO
 */
export class TimeSlotAvailabilityDto {
  @ApiProperty({ description: '日期', example: '2024-01-01' })
  @IsNotEmpty({ message: '日期不能为空' })
  @IsString({ message: '日期必须是字符串' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式必须为YYYY-MM-DD' })
  date: string;

  @ApiProperty({ description: '时间段ID', required: false, example: '123e4567-e89b-12d3-a456-426614174000' })
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsUUID('4', { message: '时间段ID格式无效' })
  timeSlotId?: string;
}

/**
 * 时间段可用性响应DTO
 */
export class TimeSlotAvailabilityResponseDto {
  @ApiProperty({ description: '时间段ID' })
  id: string;

  @ApiProperty({ description: '时间段时间' })
  slotTime: string;

  @ApiProperty({ description: '持续时间（分钟）' })
  durationMinutes: number;

  @ApiProperty({ description: '已预约数' })
  bookedCount: number;

  @ApiProperty({ description: '是否可用' })
  isAvailable: boolean;

  @ApiProperty({ description: '可用性状态描述' })
  availabilityStatus: string;

  @ApiProperty({ description: '预约详情' })
  appointments?: Array<{
    id: string;
    customerName: string;
    status: string;
  }>;
}