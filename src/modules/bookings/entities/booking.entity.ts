/**
 * 预约实体类
 * 基于Prisma的预约数据模型
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * 预约状态枚举
 */
export enum BookingStatus {
  /** 待确认 */
  PENDING = 'PENDING',
  /** 已确认 */
  CONFIRMED = 'CONFIRMED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
  /** 已完成 */
  COMPLETED = 'COMPLETED'
}

/**
 * 预约实体类
 * 对应数据库中的appointments表
 */
export class Booking {
  @ApiProperty({ description: '预约ID' })
  id: string;

  @ApiProperty({ description: '预约编号' })
  appointmentNumber: string;

  @ApiProperty({ description: '预约日期' })
  appointmentDate: Date;

  @ApiProperty({ description: '时间段ID' })
  timeSlotId: string;

  @ApiProperty({ description: '用户ID（可选）' })
  userId?: string;

  @ApiProperty({ description: '客户姓名' })
  customerName: string;

  @ApiProperty({ description: '客户手机号' })
  customerPhone: string;

  @ApiProperty({ description: '客户邮箱（可选）' })
  customerEmail?: string;

  @ApiProperty({ description: '客户微信（可选）' })
  customerWechat?: string;

  @ApiProperty({ description: '状态' })
  status: BookingStatus;

  @ApiProperty({ description: '备注（可选）' })
  notes?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}