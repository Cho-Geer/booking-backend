import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';

/**
 * 通知基础DTO
 */
export class NotificationDto {
  @ApiProperty({ description: '通知ID' })
  id: string;
  
  @ApiProperty({ description: '用户ID' })
  userId: string;
  
  @ApiProperty({ description: '预约ID', required: false })
  appointmentId?: string;
  
  @ApiProperty({ 
    description: '通知类型', 
    enum: ['SMS', 'EMAIL', 'WECHAT', 'PUSH'] 
  })
  type: 'SMS' | 'EMAIL' | 'WECHAT' | 'PUSH';
  
  @ApiProperty({ description: '通知标题', maxLength: 200 })
  title: string;
  
  @ApiProperty({ description: '通知内容' })
  content: string;
  
  @ApiProperty({ description: '是否已读' })
  isRead: boolean;
  
  @ApiProperty({ 
    description: '通知状态', 
    enum: ['PENDING', 'SENT', 'FAILED', 'CANCELLED'] 
  })
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  
  @ApiProperty({ description: '计划发送时间', required: false })
  scheduledFor?: Date;
  
  @ApiProperty({ description: '实际发送时间', required: false })
  sentAt?: Date;
  
  @ApiProperty({ description: '阅读时间', required: false })
  readAt?: Date;
  
  @ApiProperty({ description: '附加数据', required: false })
  metadata?: any;
  
  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

/**
 * 通知查询DTO
 */
export class NotificationQueryDto {
  @ApiProperty({ description: '通知ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID('4', { message: '通知ID格式无效' })
  id?: string;

  @ApiProperty({ description: '用户ID', required: false })
  @IsOptional()
  @IsUUID('4', { message: '用户ID格式无效' })
  userId?: string;
  
  @ApiProperty({ 
    description: '通知类型', 
    enum: ['SMS', 'EMAIL', 'WECHAT', 'PUSH'],
    required: false 
  })
  @IsOptional()
  @IsEnum(['SMS', 'EMAIL', 'WECHAT', 'PUSH'], { each: true, message: '通知类型无效' })
  type?: string[];
  
  @ApiProperty({ description: '是否已读', required: false })
  @IsOptional()
  @IsBoolean({ message: 'isRead必须是布尔值' })
  isRead?: boolean;
  
  @ApiProperty({ description: '每页数量', default: 10, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'limit必须是数字' })
  @Min(1, { message: 'limit不能小于1' })
  @Max(100, { message: 'limit不能大于100' })
  limit?: number;
  
  @ApiProperty({ description: '偏移量', required: false })
  @IsOptional()
  @IsNumber({}, { message: 'offset必须是数字' })
  @Min(0, { message: 'offset不能小于0' })
  offset?: number;
  
  @ApiProperty({ description: '当前页码', default: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'page必须是数字' })
  @Min(1, { message: 'page不能小于1' })
  page?: number;
}

/**
 * 通知响应DTO
 */
export class NotificationResponseDto {
  @ApiProperty({ description: '通知ID' })
  id: string;
  
  @ApiProperty({ description: '用户ID' })
  userId: string;
  
  @ApiProperty({ description: '预约ID', required: false })
  appointmentId?: string;
  
  @ApiProperty({ 
    description: '通知类型', 
    enum: ['SMS', 'EMAIL', 'WECHAT', 'PUSH'] 
  })
  type: 'SMS' | 'EMAIL' | 'WECHAT' | 'PUSH';
  
  @ApiProperty({ description: '通知标题', maxLength: 200 })
  title: string;
  
  @ApiProperty({ description: '通知内容' })
  content: string;
  
  @ApiProperty({ description: '是否已读' })
  isRead: boolean;
  
  @ApiProperty({ 
    description: '通知状态', 
    enum: ['PENDING', 'SENT', 'FAILED', 'CANCELLED'] 
  })
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  
  @ApiProperty({ description: '计划发送时间', required: false })
  scheduledFor?: Date;
  
  @ApiProperty({ description: '实际发送时间', required: false })
  sentAt?: Date;
  
  @ApiProperty({ description: '阅读时间', required: false })
  readAt?: Date;
  
  @ApiProperty({ description: '附加数据', required: false })
  metadata?: any;
  
  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

/**
 * 通知列表响应DTO
 */
export class NotificationListResponseDto {
  @ApiProperty({ description: '通知列表', type: [NotificationResponseDto] })
  items: NotificationResponseDto[];
  
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
 * 通知创建DTO
 */
export class NotificationCreateDto {
  @ApiProperty({ description: '用户ID' })
  userId: string;
  
  @ApiProperty({ 
    description: '通知类型', 
    enum: ['SMS', 'EMAIL', 'WECHAT', 'PUSH'] 
  })
  type: 'SMS' | 'EMAIL' | 'WECHAT' | 'PUSH';
  
  @ApiProperty({ description: '通知标题', maxLength: 200 })
  title: string;
  
  @ApiProperty({ description: '通知内容' })
  content: string;
  
  @ApiProperty({ 
    description: '优先级', 
    enum: ['low', 'medium', 'high'],
    required: false 
  })
  priority?: 'low' | 'medium' | 'high';
  
  @ApiProperty({ description: '附加数据', required: false })
  data?: any;
  
  @ApiProperty({ description: '计划发送时间', required: false })
  scheduledAt?: Date;
}
