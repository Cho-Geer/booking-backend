/**
 * 通用工具类测试
 * @author Booking System
 * @since 2024
 */

import { MaskingUtil } from './masking.util';

describe('MaskingUtil', () => {
  describe('maskPhoneNumber', () => {
    it('应该正确脱敏11位中国大陆手机号', () => {
      const result = MaskingUtil.maskPhoneNumber('13800138000');
      expect(result).toBe('138****8000');
    });

    it('应该正确脱敏其他长度号码', () => {
      const result = MaskingUtil.maskPhoneNumber('1234567');
      expect(result).toBe('123***67');
    });

    it('应该处理空值', () => {
      const result = MaskingUtil.maskPhoneNumber('');
      expect(result).toBe('');
    });

    it('应该处理null值', () => {
      const result = MaskingUtil.maskPhoneNumber(null as any);
      expect(result).toBe('');
    });

    it('应该处理短号码', () => {
      const result = MaskingUtil.maskPhoneNumber('123');
      expect(result).toBe('123');
    });

    it('应该移除非数字字符', () => {
      const result = MaskingUtil.maskPhoneNumber('138-0013-8000');
      expect(result).toBe('138****8000');
    });
  });

  describe('maskEmail', () => {
    it('应该正确脱敏邮箱地址', () => {
      const result = MaskingUtil.maskEmail('test@example.com');
      expect(result).toContain('@');
      expect(result).toContain('*');
    });

    it('应该处理短用户名', () => {
      const result = MaskingUtil.maskEmail('ab@example.com');
      expect(result).toBe('ab@e**********');
    });

    it('应该处理空值', () => {
      const result = MaskingUtil.maskEmail(null);
      expect(result).toBeNull();
    });

    it('应该处理无效邮箱格式', () => {
      const result = MaskingUtil.maskEmail('invalid-email');
      expect(result).toBe('invalid-email');
    });

    it('应该处理中等长度用户名', () => {
      const result = MaskingUtil.maskEmail('abcde@example.com');
      expect(result).toBe('ab***@e**********');
    });

    it('应该处理长用户名', () => {
      const result = MaskingUtil.maskEmail('testuser123@example.com');
      expect(result).toBe('tes********@e**********');
    });
  });
});
