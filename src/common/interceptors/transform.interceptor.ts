/**
 * 统一响应格式拦截器
 * 将所有响应包装成统一格式
 * @author Booking System
 * @since 2024
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dto/api-response.dto';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponseDto<T>> {
  private readonly logger = new Logger(TransformInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponseDto<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // 获取请求开始时间，用于计算处理时间
    const startTime = Date.now();
    
    return next.handle().pipe(
      map((data) => {
        const processingTime = Date.now() - startTime;
        
        // 如果数据已经是ApiResponseDto格式，直接返回
        if (data && typeof data === 'object' && ('code' in data) && ('message' in data)) {
          // 添加处理时间信息到响应头
          response.setHeader('X-Response-Time', `${processingTime}ms`);
          return data;
        }

        // 创建统一响应格式
        const responseData = ApiResponseDto.success(data);
        
        // 添加处理时间信息到响应头
        response.setHeader('X-Response-Time', `${processingTime}ms`);
        
        // 记录响应日志
        this.logger.log(
          `${request.method} ${request.url} - ${response.statusCode} - ${processingTime}ms`
        );
        
        return responseData;
      })
    );
  }
}