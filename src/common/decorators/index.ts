/**
 * 自定义装饰器
 * 提供常用的装饰器功能
 * @author Booking System
 * @since 2024
 */

import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Request } from 'express';

/**
 * 获取当前用户装饰器
 * 从请求中获取当前登录用户信息
 */
export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user;

    // 如果指定了字段名，返回对应字段值
    return data ? user?.[data] : user;
  }
);

/**
 * 获取请求IP地址装饰器
 */
export const IpAddress = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    
    // 获取真实IP地址（考虑代理）
    return request.ip || 
           request.headers['x-forwarded-for'] as string || 
           request.connection.remoteAddress ||
           '';
  }
);

/**
 * 获取请求ID装饰器
 */
export const RequestId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.headers['x-request-id'] || '';
  }
);

/**
 * 获取请求时间戳装饰器
 */
export const RequestTimestamp = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return Date.now();
  }
);

/**
 * 角色装饰器
 * 用于设置和获取角色权限
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

/**
 * 权限装饰器
 * 用于设置和获取具体权限
 */
export const Permissions = (...permissions: string[]) => SetMetadata('permissions', permissions);

/**
 * 跳过JWT认证装饰器
 * 用于标记不需要认证的接口
 */
export const SkipJwtAuth = () => SetMetadata('skipJwtAuth', true);

/**
 * 跳过响应转换装饰器
 * 用于标记不需要统一响应格式的接口
 */
export const SkipTransform = () => SetMetadata('skipTransform', true);

/**
 * 缓存装饰器
 * 用于设置接口缓存策略
 */
export const Cache = (ttl: number, key?: string) => SetMetadata('cache', { ttl, key });

/**
 * 日志装饰器
 * 用于设置接口日志级别
 */
export const LogLevel = (level: 'debug' | 'info' | 'warn' | 'error') => SetMetadata('logLevel', level);

/**
 * 响应消息装饰器
 * 用于自定义成功响应消息
 */
export const ResponseMessage = (message: string) => SetMetadata('responseMessage', message);

/**
 * 分页装饰器
 * 用于标记需要分页的接口
 */
export const Paginated = () => SetMetadata('paginated', true);

/**
 * 表单数据装饰器
 * 用于标记接收表单数据的接口
 */
export const FormData = () => SetMetadata('formData', true);

/**
 * 文件上传装饰器
 * 用于标记文件上传接口
 */
export const FileUpload = (options?: { 
  maxCount?: number; 
  fieldName?: string;
  fileTypes?: string[];
  maxSize?: number;
}) => SetMetadata('fileUpload', options || {});

/**
 * API版本装饰器
 * 用于标记API版本
 */
export const ApiVersion = (version: string) => SetMetadata('apiVersion', version);