/**
 * 预约取消命令请求 DTO（P0-3 B-2・IF-02 §4.3・CHK-02 C-11）
 * 六项字段全部必填：commandType / commandId / bookingExternalId / requestedBySalesforceUserId / correlationId / expectedVersion
 * - commandType 仅接受 'CANCEL_BOOKING'（完全一致判定・RULE-13）
 * - expectedVersion 为严格整型（JSON 数字），不做 UUID 形式校验（C-11 明文）
 * - 多余字段由全局 ValidationPipe forbidNonWhitelisted 拒绝（400）
 */

import { IsIn, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 集成命令请求 DTO
 */
export class BookingCommandRequestDto {
  /**
   * 命令类型（仅 CANCEL_BOOKING）
   */
  @ApiProperty({ description: '命令类型（仅支持 CANCEL_BOOKING）', example: 'CANCEL_BOOKING' })
  @IsIn(['CANCEL_BOOKING'])
  commandType: string;

  /**
   * 幂等键（调用方生成的唯一命令 ID）
   */
  @ApiProperty({ description: '调用方生成的唯一命令 ID（幂等键）' })
  @IsString()
  @IsNotEmpty()
  commandId: string;

  /**
   * Booking 侧预约 ID（appointments.id，uuid）
   */
  @ApiProperty({ description: 'Booking 侧预约 ID（appointments.id）' })
  @IsString()
  @IsNotEmpty()
  bookingExternalId: string;

  /**
   * Salesforce 操作员用户 ID（静态映射键）
   */
  @ApiProperty({ description: 'Salesforce 操作员用户 ID（静态映射键）' })
  @IsString()
  @IsNotEmpty()
  requestedBySalesforceUserId: string;

  /**
   * 关联 ID（调用方透传）
   */
  @ApiProperty({ description: '关联 ID（调用方透传）' })
  @IsString()
  @IsNotEmpty()
  correlationId: string;

  /**
   * 期望版本（乐观锁・RULE-02；严格整型，无 0 特例・C-10）
   * 注：全局 ValidationPipe 的 enableImplicitConversion 会在 @Transform 之前执行类型转换
   * （2026-09-03 探针实证），故 "" → 0、"1" → 1 会放行进入业务门而非 400——此为已知偏差
   * （CHK-02 C-11 弱化），待 D 系注记；null 与缺失仍被 @IsInt 拒 400。
   */
  @ApiProperty({ description: '期望版本（乐观锁），严格整型' })
  @IsInt()
  expectedVersion: number;
}
