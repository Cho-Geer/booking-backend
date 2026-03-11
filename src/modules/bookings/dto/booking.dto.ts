/**
 * 预约相关DTO
 * 处理预约业务的数据传输对象
 * @author Booking System
 * @since 2024
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString, IsEnum, IsOptional, IsUUID, IsEmail, IsPhoneNumber } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

/**
 * 预约状态枚举
 */
export enum AppointmentStatusEnum {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

/**
 * 创建预约请求DTO
 */
export class CreateAppointmentDto {
  @ApiProperty({ description: '时间段ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsNotEmpty({ message: '时间段ID不能为空' })
  @IsUUID('4', { message: '时间段ID格式无效' })
  timeSlotId: string;

  @ApiProperty({ description: '用户ID', required: false, example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID('4', { message: '用户ID格式无效' })
  userId?: string;

  @ApiProperty({ description: '服务ID', required: false, example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID('4', { message: '服务ID格式无效' })
  serviceId?: string;

  @ApiProperty({ description: '预约日期', example: '2024-01-01' })
  @IsNotEmpty({ message: '预约日期不能为空' })
  @IsDateString({}, { message: '预约日期格式无效' })
  appointmentDate: string;

  @ApiProperty({ description: '客户姓名', example: '张三' })
  @IsNotEmpty({ message: '客户姓名不能为空' })
  @IsString({ message: '客户姓名必须是字符串' })
  customerName: string;

  @ApiProperty({ description: '客户手机号', example: '13800138000' })
  @IsNotEmpty({ message: '客户手机号不能为空' })
  @IsPhoneNumber('CN', { message: '手机号格式不正确' })
  customerPhone: string;

  @ApiProperty({ description: '客户邮箱', required: false, example: 'user@example.com' })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  customerEmail?: string;

  @ApiProperty({ description: '客户微信', required: false, example: 'wechat_id' })
  @IsOptional()
  @IsString({ message: '微信号必须是字符串' })
  customerWechat?: string;

  @ApiProperty({ description: '预约备注', required: false, example: '特殊需求说明' })
  @IsOptional()
  @IsString({ message: '备注必须是字符串' })
  notes?: string;

  @ApiProperty({ description: '服务名称', example: '咨询服务' })
  @IsOptional()
  @IsString({ message: '服务名称必须是字符串' })
  serviceName?: string;
}

/**
 * 更新预约DTO
 */
export class UpdateAppointmentDto {
  @ApiProperty({ description: '预约状态', enum: AppointmentStatusEnum, required: false })
  @IsOptional()
  @IsEnum(AppointmentStatusEnum, { message: '预约状态无效' })
  status?: AppointmentStatusEnum;

  @ApiProperty({ description: '客户姓名', required: false, example: '张三' })
  @IsOptional()
  @IsString({ message: '客户姓名必须是字符串' })
  customerName?: string;

  @ApiProperty({ description: '客户手机号', required: false, example: '13800138000' })
  @IsOptional()
  @IsPhoneNumber('CN', { message: '手机号格式不正确' })
  customerPhone?: string;

  @ApiProperty({ description: '客户邮箱', required: false, example: 'user@example.com' })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  customerEmail?: string;

  @ApiProperty({ description: '客户微信', required: false, example: 'wechat_id' })
  @IsOptional()
  @IsString({ message: '微信号必须是字符串' })
  customerWechat?: string;

  @ApiProperty({ description: '预约备注', required: false, example: '特殊需求说明' })
  @IsOptional()
  @IsString({ message: '备注必须是字符串' })
  notes?: string;
}

/**
 * 预约响应DTO
 */
export class AppointmentResponseDto {
  @ApiProperty({ description: '预约ID' })
  id: string;

  @ApiProperty({ description: '预约编号' })
  appointmentNumber: string;

  @ApiProperty({ description: '时间段ID' })
  timeSlotId: string;

  @ApiProperty({ description: '用户ID' })
  userId?: string;

  @ApiProperty({ description: '预约日期' })
  appointmentDate: Date;

  @ApiProperty({ description: '预约状态', enum: AppointmentStatusEnum })
  status: AppointmentStatusEnum;

  @ApiProperty({ description: '客户姓名' })
  customerName: string;

  @ApiProperty({ description: '客户手机号' })
  customerPhone: string;

  @ApiProperty({ description: '客户邮箱' })
  customerEmail?: string;

  @ApiProperty({ description: '客户微信' })
  customerWechat?: string;

  @ApiProperty({ description: '预约备注' })
  notes?: string;

  @ApiProperty({ description: '时间段信息' })
  timeSlot?: {
    slotTime: string;
    durationMinutes: number;
  };

  @ApiProperty({ description: '用户信息' })
  user?: {
    name: string;
    phoneNumber: string;
  };

  @ApiProperty({ description: '服务信息' })
  service?: {
    id: string;
    name: string;
    durationMinutes: number;
  };

  @ApiProperty({ description: '确认发送状态' })
  confirmationSent: boolean;

  @ApiProperty({ description: '提醒发送状态' })
  reminderSent: boolean;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;

  @ApiProperty({ description: '确认时间' })
  confirmedAt?: Date;

  @ApiProperty({ description: '取消时间' })
  cancelledAt?: Date;

  @ApiProperty({ description: '完成时间' })
  completedAt?: Date;
}

/**
 * 预约查询DTO
 */
export class AppointmentQueryDto {
  @ApiProperty({ description: '用户ID', required: false, example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID('4', { message: '用户ID格式无效' })
  userId?: string;

  @ApiProperty({ description: '时间段ID', required: false, example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID('4', { message: '时间段ID格式无效' })
  timeSlotId?: string;

  @ApiProperty({ description: '预约状态', enum: AppointmentStatusEnum, required: false, example: 'CONFIRMED' })
  @IsOptional()
  @IsEnum(AppointmentStatusEnum, { message: '预约状态无效' })
  status?: AppointmentStatusEnum;

  @ApiProperty({ description: '客户姓名', required: false, example: '张三' })
  @IsOptional()
  @IsString({ message: '客户姓名必须是字符串' })
  customerName?: string;

  @ApiProperty({ description: '客户手机号', required: false, example: '13800138000' })
  @IsOptional()
  @IsPhoneNumber('CN', { message: '手机号格式不正确' })
  customerPhone?: string;

  @ApiProperty({ description: '开始日期', required: false, example: '2024-01-01' })
  @IsOptional()
  @IsDateString({}, { message: '开始日期格式无效' })
  startDate?: string;

  @ApiProperty({ description: '结束日期', required: false, example: '2024-12-31' })
  @IsOptional()
  @IsDateString({}, { message: '结束日期格式无效' })
  endDate?: string;

  @ApiProperty({ description: '页码', required: false, default: 1, minimum: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false, default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  limit?: number = 10;
}

/**
 * 预约列表响应DTO
 */
export class AppointmentListResponseDto {
  @ApiProperty({ description: '预约列表', type: [AppointmentResponseDto] })
  items: AppointmentResponseDto[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;
}

/**
 * 预约统计DTO
 */
export class AppointmentStatisticsDto {
  @ApiProperty({ description: '总预约数' })
  totalAppointments: number;

  @ApiProperty({ description: '待确认预约数' })
  pendingAppointments: number;

  @ApiProperty({ description: '已确认预约数' })
  confirmedAppointments: number;

  @ApiProperty({ description: '已完成预约数' })
  completedAppointments: number;

  @ApiProperty({ description: '已取消预约数' })
  cancelledAppointments: number;

  @ApiProperty({ description: '今日预约数' })
  todayAppointments: number;

  @ApiProperty({ description: '本周预约数' })
  thisWeekAppointments: number;

  @ApiProperty({ description: '本月预约数' })
  thisMonthAppointments: number;
}