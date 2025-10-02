/**
 * 验证管道配置
 * 提供全局验证配置
 * @author Booking System
 * @since 2024
 */

import { ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ValidationException } from '../exceptions/business.exceptions';

/**
 * 创建验证管道实例
 * @returns ValidationPipe实例
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // 启用自动转换（将传入数据转换为DTO类型）
    transform: true,
    
    // 启用验证白名单（只允许DTO中定义的属性）
    whitelist: true,
    
    // 禁止非白名单属性（自动删除未在DTO中定义的属性）
    forbidNonWhitelisted: true,
    
    // 在错误中显示被禁止的属性
    forbidUnknownValues: true,
    
    // 遇到第一个错误就停止验证
    stopAtFirstError: false,
    
    // 自定义验证错误处理
    exceptionFactory: (errors: ValidationError[]) => {
      const errorMessages = formatValidationErrors(errors);
      return new ValidationException('参数验证失败', errorMessages);
    },
  });
}

/**
 * 格式化验证错误信息
 * @param errors 验证错误数组
 * @returns 格式化后的错误信息
 */
function formatValidationErrors(errors: ValidationError[]): any {
  const result: any = {};

  errors.forEach((error) => {
    if (error.constraints) {
      // 如果有直接约束错误，添加属性错误
      result[error.property] = Object.values(error.constraints);
    }

    if (error.children && error.children.length > 0) {
      // 如果有嵌套错误，递归处理
      result[error.property] = formatValidationErrors(error.children);
    }
  });

  return result;
}

/**
 * 手机号验证管道
 * 验证手机号格式并格式化
 */
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class PhoneNumberValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value || metadata.type !== 'body') {
      return value;
    }

    // 如果是手机号字段，进行格式化和验证
    if (metadata.data === 'phoneNumber' || metadata.data === 'phone') {
      const phoneNumber = this.normalizePhoneNumber(value);
      if (!this.validatePhoneNumber(phoneNumber)) {
        throw new ValidationException('手机号格式不正确');
      }
      return phoneNumber;
    }

    return value;
  }

  /**
   * 标准化手机号格式
   * @param phoneNumber 原始手机号
   * @returns 标准化的手机号
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // 移除所有非数字字符
    return phoneNumber.replace(/\D/g, '');
  }

  /**
   * 验证手机号格式
   * @param phoneNumber 手机号
   * @returns 是否有效
   */
  private validatePhoneNumber(phoneNumber: string): boolean {
    // 中国手机号验证：11位数字，以1开头
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phoneNumber);
  }
}