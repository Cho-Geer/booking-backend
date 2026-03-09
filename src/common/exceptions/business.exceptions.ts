/**
 * 自定义异常类
 * 提供业务相关的异常处理
 * @author Booking System
 * @since 2024
 */

import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 业务异常基类
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    public readonly statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: any
  ) {
    super(
      {
        code: statusCode,
        message,
        error: {
          code: errorCode,
          message,
          details,
        },
        timestamp: new Date().toISOString(),
      },
      statusCode
    );
  }
}

/**
 * 验证异常
 */
export class ValidationException extends BusinessException {
  constructor(message = '参数验证失败', details?: any) {
    super('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * 认证异常
 */
export class AuthenticationException extends BusinessException {
  constructor(message = '认证失败', details?: any) {
    super('AUTHENTICATION_ERROR', message, HttpStatus.UNAUTHORIZED, details);
  }
}

/**
 * 授权异常
 */
export class AuthorizationException extends BusinessException {
  constructor(message = '权限不足', details?: any) {
    super('AUTHORIZATION_ERROR', message, HttpStatus.FORBIDDEN, details);
  }
}

/**
 * 资源不存在异常
 */
export class ResourceNotFoundException extends BusinessException {
  constructor(resource = '资源', details?: any) {
    super('RESOURCE_NOT_FOUND', `${resource}`, HttpStatus.NOT_FOUND, details);
  }
}

/**
 * 资源冲突异常
 */
export class ResourceConflictException extends BusinessException {
  constructor(message = '资源冲突', details?: any) {
    super('RESOURCE_CONFLICT', message, HttpStatus.CONFLICT, details);
  }
}

/**
 * 业务规则异常
 */
export class BusinessRuleException extends BusinessException {
  constructor(message = '业务规则违反', details?: any) {
    super('BUSINESS_RULE_VIOLATION', message, HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * 预约相关异常
 */
export class AppointmentException extends BusinessException {
  constructor(message = '预约操作失败', details?: any) {
    super('APPOINTMENT_ERROR', message, HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * 时间段冲突异常
 */
export class TimeSlotConflictException extends BusinessException {
  constructor(message = '时间段已被占用', details?: any) {
    super('TIME_SLOT_CONFLICT', message, HttpStatus.CONFLICT, details);
  }
}

/**
 * 用户相关异常
 */
export class UserException extends BusinessException {
  constructor(message = '用户操作失败', details?: any) {
    super('USER_ERROR', message, HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * 手机号已存在异常
 */
export class PhoneNumberExistsException extends BusinessException {
  constructor(phoneNumber: string) {
    super('PHONE_NUMBER_EXISTS', `手机号 ${phoneNumber} 已存在`, HttpStatus.CONFLICT);
  }
}

/**
 * 手机号格式无效异常
 */
export class InvalidPhoneNumberException extends BusinessException {
  constructor(phoneNumber: string) {
    super('INVALID_PHONE_NUMBER', `手机号 ${phoneNumber} 格式无效`, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 验证码异常
 */
export class VerificationCodeException extends BusinessException {
  constructor(message = '验证码错误', details?: any) {
    super('VERIFICATION_CODE_ERROR', message, HttpStatus.BAD_REQUEST, details);
  }
}

/**
 * 系统配置异常
 */
export class SystemConfigException extends BusinessException {
  constructor(message = '系统配置错误', details?: any) {
    super('SYSTEM_CONFIG_ERROR', message, HttpStatus.INTERNAL_SERVER_ERROR, details);
  }
}

/**
 * 数据库异常
 */
export class DatabaseException extends BusinessException {
  constructor(message = '数据库操作失败', details?: any) {
    super('DATABASE_ERROR', message, HttpStatus.INTERNAL_SERVER_ERROR, details);
  }
}

/**
 * 外部服务异常
 */
export class ExternalServiceException extends BusinessException {
  constructor(service: string, message = '外部服务调用失败') {
    super('EXTERNAL_SERVICE_ERROR', `${service}: ${message}`, HttpStatus.BAD_GATEWAY);
  }
}