import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../entities/booking.entity';
import { z } from 'zod';

// Zod验证模式
export const CreateBookingSchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
  notes: z.string().optional()
}).refine(data => {
  const start = new Date(`${data.date}T${data.startTime}`);
  const end = new Date(`${data.date}T${data.endTime}`);
  return start < end;
}, {
  message: '结束时间必须晚于开始时间',
  path: ['endTime']
});

/**
 * 创建预约DTO
 */
export class CreateBookingDto {
  /**
   * 服务ID
   */
  @ApiProperty({ description: '服务ID' })
  @IsString()
  serviceId: string;

  /**
   * 预约日期
   */
  @ApiProperty({ description: '预约日期 (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  /**
   * 开始时间
   */
  @ApiProperty({ description: '开始时间 (HH:mm:ss)' })
  @IsString()
  startTime: string;

  /**
   * 结束时间
   */
  @ApiProperty({ description: '结束时间 (HH:mm:ss)' })
  @IsString()
  endTime: string;

  /**
   * 备注
   */
  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * 更新预约状态DTO
 */
export class UpdateBookingStatusDto {
  /**
   * 状态
   */
  @ApiProperty({ description: '预约状态', enum: BookingStatus })
  @IsEnum(BookingStatus)
  status: BookingStatus;
}
