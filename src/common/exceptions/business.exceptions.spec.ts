/**
 * 业务异常测试
 * @author Booking System
 * @since 2024
 */

import {
  BusinessException,
  ValidationException,
  AuthenticationException,
  AuthorizationException,
  ResourceNotFoundException,
  ResourceConflictException,
  BusinessRuleException,
  AppointmentException,
  TimeSlotConflictException,
  UserException,
  PhoneNumberExistsException,
  InvalidPhoneNumberException,
  EmailExistsException,
  InvalidEmailException,
  VerificationCodeException,
  SystemConfigException,
  DatabaseException,
  ExternalServiceException,
  UserNotActiveException,
} from './business.exceptions';
import { HttpStatus } from '@nestjs/common';

describe('BusinessExceptions', () => {
  describe('BusinessException', () => {
    it('应该创建基本业务异常', () => {
      const exception = new BusinessException('TEST_ERROR', '测试错误');

      expect(exception.errorCode).toBe('TEST_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('应该支持自定义状态码', () => {
      const exception = new BusinessException(
        'TEST_ERROR',
        '测试错误',
        HttpStatus.NOT_FOUND
      );

      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('应该支持详细信息', () => {
      const exception = new BusinessException(
        'TEST_ERROR',
        '测试错误',
        HttpStatus.BAD_REQUEST,
        { field: 'name' }
      );

      expect(exception.details).toEqual({ field: 'name' });
    });
  });

  describe('ValidationException', () => {
    it('应该创建验证异常', () => {
      const exception = new ValidationException('参数验证失败');

      expect(exception.errorCode).toBe('VALIDATION_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('AuthenticationException', () => {
    it('应该创建认证异常', () => {
      const exception = new AuthenticationException('认证失败');

      expect(exception.errorCode).toBe('AUTHENTICATION_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('AuthorizationException', () => {
    it('应该创建授权异常', () => {
      const exception = new AuthorizationException('权限不足');

      expect(exception.errorCode).toBe('AUTHORIZATION_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('ResourceNotFoundException', () => {
    it('应该创建资源不存在异常', () => {
      const exception = new ResourceNotFoundException('用户');

      expect(exception.errorCode).toBe('RESOURCE_NOT_FOUND');
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('ResourceConflictException', () => {
    it('应该创建资源冲突异常', () => {
      const exception = new ResourceConflictException('资源冲突');

      expect(exception.errorCode).toBe('RESOURCE_CONFLICT');
      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    });
  });

  describe('BusinessRuleException', () => {
    it('应该创建业务规则异常', () => {
      const exception = new BusinessRuleException('业务规则违反');

      expect(exception.errorCode).toBe('BUSINESS_RULE_VIOLATION');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('AppointmentException', () => {
    it('应该创建预约异常', () => {
      const exception = new AppointmentException('预约操作失败');

      expect(exception.errorCode).toBe('APPOINTMENT_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('TimeSlotConflictException', () => {
    it('应该创建时间段冲突异常', () => {
      const exception = new TimeSlotConflictException('时间段已被占用');

      expect(exception.errorCode).toBe('TIME_SLOT_CONFLICT');
      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    });
  });

  describe('UserException', () => {
    it('应该创建用户异常', () => {
      const exception = new UserException('用户操作失败');

      expect(exception.errorCode).toBe('USER_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('PhoneNumberExistsException', () => {
    it('应该创建手机号已存在异常', () => {
      const exception = new PhoneNumberExistsException('13800138000');

      expect(exception.errorCode).toBe('PHONE_NUMBER_EXISTS');
      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    });
  });

  describe('InvalidPhoneNumberException', () => {
    it('应该创建无效手机号异常', () => {
      const exception = new InvalidPhoneNumberException('123');

      expect(exception.errorCode).toBe('INVALID_PHONE_NUMBER');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('EmailExistsException', () => {
    it('应该创建邮箱已存在异常', () => {
      const exception = new EmailExistsException('test@example.com');

      expect(exception.errorCode).toBe('EMAIL_EXISTS');
      expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    });
  });

  describe('InvalidEmailException', () => {
    it('应该创建无效邮箱异常', () => {
      const exception = new InvalidEmailException('invalid');

      expect(exception.errorCode).toBe('INVALID_EMAIL');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('VerificationCodeException', () => {
    it('应该创建验证码异常', () => {
      const exception = new VerificationCodeException('验证码错误');

      expect(exception.errorCode).toBe('VERIFICATION_CODE_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('SystemConfigException', () => {
    it('应该创建系统配置异常', () => {
      const exception = new SystemConfigException('系统配置错误');

      expect(exception.errorCode).toBe('SYSTEM_CONFIG_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('DatabaseException', () => {
    it('应该创建数据库异常', () => {
      const exception = new DatabaseException('数据库操作失败');

      expect(exception.errorCode).toBe('DATABASE_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('ExternalServiceException', () => {
    it('应该创建外部服务异常', () => {
      const exception = new ExternalServiceException('SMS', '发送失败');

      expect(exception.errorCode).toBe('EXTERNAL_SERVICE_ERROR');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    });
  });

  describe('UserNotActiveException', () => {
    it('应该创建用户未激活异常', () => {
      const exception = new UserNotActiveException('用户不存在或已被禁用');

      expect(exception.errorCode).toBe('USER_NOT_ACTIVE');
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
