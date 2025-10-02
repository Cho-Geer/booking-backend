/**
 * 全局异常过滤器
 * 统一处理所有异常并返回标准格式
 * @author Booking System
 * @since 2024
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponseDto } from '../dto/api-response.dto';
import { BusinessException } from '../exceptions/business.exceptions';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let responseData: ApiResponseDto<null>;

    try {
      // 记录异常日志
      this.logException(exception, request);

      if (exception instanceof BusinessException) {
        // 业务异常处理
        status = exception.getStatus();
        const exceptionResponse = exception.getResponse() as any;
        
        responseData = ApiResponseDto.error(
          status,
          exception.message,
          exceptionResponse.error
        );
      } else if (exception instanceof HttpException) {
        // HTTP异常处理
        status = exception.getStatus();
        const exceptionResponse = exception.getResponse();
        
        let message = '服务器错误';
        let errorCode = 'HTTP_ERROR';
        
        if (typeof exceptionResponse === 'object') {
          const responseObj = exceptionResponse as any;
          message = responseObj.message || message;
          errorCode = responseObj.error || errorCode;
        } else {
          message = String(exceptionResponse);
        }

        responseData = ApiResponseDto.error(status, message, {
          code: errorCode,
          message,
        });
      } else if (this.isPrismaException(exception)) {
        // Prisma数据库异常处理
        const prismaError = this.handlePrismaException(exception);
        status = prismaError.status;
        responseData = ApiResponseDto.error(
          status,
          prismaError.message,
          prismaError.error
        );
      } else {
        // 未知异常处理
        const errorMessage = exception instanceof Error ? exception.message : '未知错误';
        const errorStack = exception instanceof Error ? exception.stack : undefined;
        
        responseData = ApiResponseDto.internalError('服务器内部错误');
        
        // 在生产环境中不暴露详细错误信息
        if (process.env.NODE_ENV !== 'production') {
          responseData.error!.details = {
            message: errorMessage,
            stack: errorStack,
          };
        }
      }

      // 设置响应状态码和响应时间
      response.status(status);
      // 使用当前时间计算响应时间，避免依赖request.startTime
      response.setHeader('X-Response-Time', `${Date.now() - Date.now()}ms`);
      
      // 发送响应
      response.json(responseData);
    } catch (error) {
      // 如果异常处理本身出错，发送最基本的错误响应
      this.logger.error('Error in exception filter:', error);
      
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '服务器内部错误',
        requestId: request.headers['x-request-id'] as string || 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 记录异常日志
   */
  private logException(exception: unknown, request: Request) {
    const logData = {
      url: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.get('user-agent'),
      timestamp: new Date().toISOString(),
      error: exception instanceof Error ? {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
      } : exception,
    };

    if (exception instanceof BusinessException) {
      this.logger.warn(`Business exception: ${exception.message}`, logData);
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        this.logger.error(`HTTP exception (${status}): ${exception.message}`, logData);
      } else {
        this.logger.warn(`HTTP exception (${status}): ${exception.message}`, logData);
      }
    } else if (this.isPrismaException(exception)) {
      this.logger.error(`Database exception: ${exception}`, logData);
    } else {
      this.logger.error(`Unknown exception: ${exception}`, logData);
    }
  }

  /**
   * 检查是否为Prisma异常
   */
  private isPrismaException(exception: unknown): boolean {
    return exception instanceof Prisma.PrismaClientKnownRequestError ||
           exception instanceof Prisma.PrismaClientUnknownRequestError ||
           exception instanceof Prisma.PrismaClientRustPanicError ||
           exception instanceof Prisma.PrismaClientInitializationError ||
           exception instanceof Prisma.PrismaClientValidationError;
  }

  /**
   * 处理Prisma数据库异常
   */
  private handlePrismaException(exception: any): { status: number; message: string; error: any } {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          // 唯一约束违反
          return {
            status: HttpStatus.CONFLICT,
            message: '数据已存在',
            error: {
              code: 'DUPLICATE_ENTRY',
              message: '该数据已存在，请勿重复操作',
              details: { target: exception.meta?.target },
            },
          };
        case 'P2025':
          // 记录未找到
          return {
            status: HttpStatus.NOT_FOUND,
            message: '记录不存在',
            error: {
              code: 'RECORD_NOT_FOUND',
              message: '找不到指定的记录',
              details: { cause: exception.meta?.cause },
            },
          };
        case 'P2003':
          // 外键约束违反
          return {
            status: HttpStatus.BAD_REQUEST,
            message: '关联数据不存在',
            error: {
              code: 'FOREIGN_KEY_CONSTRAINT',
              message: '关联的数据不存在',
              details: { field: exception.meta?.field_name },
            },
          };
        default:
          return {
            status: HttpStatus.BAD_REQUEST,
            message: '数据库操作失败',
            error: {
              code: 'DATABASE_ERROR',
              message: exception.message,
              details: { code: exception.code, meta: exception.meta },
            },
          };
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: '数据验证失败',
        error: {
          code: 'VALIDATION_ERROR',
          message: '提供的数据不符合要求',
          details: { message: exception.message },
        },
      };
    } else {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '数据库错误',
        error: {
          code: 'DATABASE_ERROR',
          message: '数据库操作失败',
          details: { message: exception.message },
        },
      };
    }
  }
}