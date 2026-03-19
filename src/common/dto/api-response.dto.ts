/**
 * 统一响应DTO
 * 所有API响应都必须使用此格式
 * @author Booking System
 * @since 2024
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * 统一响应数据结构
 */
export class ApiResponseDto<T = any> {
  @ApiProperty({ description: '响应状态码', example: 200 })
  code: number;

  @ApiProperty({ description: '响应消息', example: '操作成功' })
  message: string;

  @ApiProperty({ description: '响应数据', required: false })
  data?: T;

  @ApiProperty({ description: '请求唯一标识', example: 'req_1234567890' })
  requestId: string;

  @ApiProperty({ description: '响应时间戳', example: '2024-01-01T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ description: '错误详情', required: false })
  error?: {
    code: string;
    message: string;
    details?: any;
  };

  constructor(partial?: Partial<ApiResponseDto<T>>) {
    this.code = partial?.code || 200;
    this.message = partial?.message || '操作成功';
    this.data = partial?.data;
    this.requestId = partial?.requestId || this.generateRequestId();
    this.timestamp = partial?.timestamp || new Date().toISOString();
    this.error = partial?.error;
  }

  /**
   * 生成请求唯一标识
   * @returns 请求ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `req_${timestamp}_${random}`;
  }

  /**
   * 创建成功响应
   * @param data 响应数据
   * @param message 响应消息
   * @returns 统一响应对象
   */
  static success<T>(data?: T, message = '操作成功'): ApiResponseDto<T> {
    return new ApiResponseDto<T>({
      code: 200,
      message,
      data,
    });
  }

  /**
   * 创建创建成功响应
   * @param data 创建的数据
   * @param message 响应消息
   * @returns 统一响应对象
   */
  static created<T>(data?: T, message = '创建成功'): ApiResponseDto<T> {
    return new ApiResponseDto<T>({
      code: 201,
      message,
      data,
    });
  }

  /**
   * 创建错误响应
   * @param code 错误码
   * @param message 错误消息
   * @param error 错误详情
   * @returns 统一响应对象
   */
  static error(
    code: number,
    message: string,
    error?: { code: string; message: string; details?: any }
  ): ApiResponseDto<null> {
    return new ApiResponseDto<null>({
      code,
      message,
      error: error || { code: 'UNKNOWN_ERROR', message },
    });
  }

  /**
   * 创建参数错误响应
   * @param message 错误消息
   * @param details 错误详情
   * @returns 统一响应对象
   */
  static badRequest(message = '参数错误', details?: any): ApiResponseDto<null> {
    return this.error(400, message, {
      code: 'BAD_REQUEST',
      message,
      details,
    });
  }

  /**
   * 创建未授权响应
   * @param message 错误消息
   * @returns 统一响应对象
   */
  static unauthorized(message = '未授权访问'): ApiResponseDto<null> {
    return this.error(401, message, {
      code: 'UNAUTHORIZED',
      message,
    });
  }

  /**
   * 创建禁止访问响应
   * @param message 错误消息
   * @returns 统一响应对象
   */
  static forbidden(message = '禁止访问'): ApiResponseDto<null> {
    return this.error(403, message, {
      code: 'FORBIDDEN',
      message,
    });
  }

  /**
   * 创建资源不存在响应
   * @param message 错误消息
   * @returns 统一响应对象
   */
  static notFound(message = '资源不存在'): ApiResponseDto<null> {
    return this.error(404, message, {
      code: 'NOT_FOUND',
      message,
    });
  }

  /**
   * 创建冲突响应
   * @param message 错误消息
   * @returns 统一响应对象
   */
  static conflict(message = '资源冲突'): ApiResponseDto<null> {
    return this.error(409, message, {
      code: 'CONFLICT',
      message,
    });
  }

  /**
   * 创建服务器错误响应
   * @param message 错误消息
   * @returns 统一响应对象
   */
  static internalError(message = '服务器内部错误'): ApiResponseDto<null> {
    return this.error(500, message, {
      code: 'INTERNAL_ERROR',
      message,
    });
  }
}

/**
 * 分页响应DTO
 */
export class PaginatedResponseDto<T = any> extends ApiResponseDto<{
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  @ApiProperty({ description: '分页数据' })
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  constructor(
    items: T[],
    total: number,
    page: number,
    limit: number,
    message = '操作成功'
  ) {
    super({
      code: 200,
      message,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
}

/**
 * 分页查询参数DTO
 */
export class PaginationQueryDto {
  @ApiProperty({ description: '页码', required: false, minimum: 1, default: 1 })
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false, minimum: 1, maximum: 100, default: 10 })
  limit?: number = 10;

  @ApiProperty({ description: '排序字段', required: false })
  sortBy?: string;

  @ApiProperty({ description: '排序方式', required: false, enum: ['asc', 'desc'], default: 'desc' })
  order?: 'asc' | 'desc' = 'desc';

  getSkip(): number {
    return (this.page! - 1) * this.limit!;
  }

  getTake(): number {
    return this.limit!;
  }

  constructor(options?: {page?: number, limit?: number}){
    this.page = options?.page ?? 1;
    this.limit = options?.limit ?? 10;
  }
}