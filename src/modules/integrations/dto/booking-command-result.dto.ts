/**
 * 集成命令结果 DTO（P0-3 B-2・IF-02 §4.3）
 * 受理结果四要素：canonicalVersion / resultCode / currentVersion / correlationId（+httpStatus 内部用）
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * 集成命令受理结果（Service 层返回值）
 */
export interface BookingCommandResult {
  /**
   * 内部 HTTP 状态（200 受理 / 幂等回放原样返回）
   */
  httpStatus: number;

  /**
   * 受理时正本 version（TERM-10）
   */
  canonicalVersion: number;

  /**
   * 结果码（CD-12・SUCCESS）
   */
  resultCode: string;

  /**
   * 当前版本（失败场景 details 中携带）
   */
  currentVersion?: number;

  /**
   * 关联 ID（TERM-17・调用方透传原样返回）
   */
  correlationId?: string;
}

/**
 * 集成命令结果 DTO（Controller 响应 data 结构）
 * 注：service 真实返回包含内部 httpStatus 字段（受理路径 200），swagger 如实声明
 */
export class BookingCommandResultDto {
  @ApiProperty({ description: '内部 HTTP 状态（200 受理）', required: false })
  httpStatus?: number;

  @ApiProperty({ description: '受理时正本 version', required: false })
  canonicalVersion?: number;

  @ApiProperty({ description: '结果码（SUCCESS）', required: false })
  resultCode?: string;

  @ApiProperty({ description: '当前版本', required: false })
  currentVersion?: number;

  @ApiProperty({ description: '关联 ID', required: false })
  correlationId?: string;
}
