/**
 * 邮件服务测试
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { MailerService } from '@nestjs-modules/mailer';

const mockMailerService = {
  sendMail: jest.fn().mockResolvedValue(undefined),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: MailerService, useValue: mockMailerService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    jest.clearAllMocks();
  });

  describe('sendBookingConfirmation', () => {
    it('应该成功发送预约确认邮件', async () => {
      const bookingDetails = {
        customerName: '测试用户',
        appointmentDate: '2024-01-15',
        timeSlot: '09:00',
        serviceName: '测试服务',
        appointmentNumber: 'AP-001',
        notes: '测试备注',
      };

      await service.sendBookingConfirmation('test@example.com', bookingDetails);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Booking Confirmation - Booking System',
        template: './confirmation',
        context: expect.objectContaining({
          name: '测试用户',
          date: '2024-01-15',
          time: '09:00',
          service: '测试服务',
          bookingId: 'AP-001',
          notes: '测试备注',
        }),
      });
    });

    it('应该处理发送失败', async () => {
      mockMailerService.sendMail.mockRejectedValueOnce(new Error('SMTP Error'));

      // 不应该抛出异常
      await expect(
        service.sendBookingConfirmation('test@example.com', {})
      ).resolves.not.toThrow();
    });
  });

  describe('sendBookingCancellation', () => {
    it('应该成功发送预约取消邮件', async () => {
      const bookingDetails = {
        customerName: '测试用户',
        appointmentDate: '2024-01-15',
        timeSlot: '09:00',
        serviceName: '测试服务',
        appointmentNumber: 'AP-001',
        notes: '测试备注',
      };

      await service.sendBookingCancellation('test@example.com', bookingDetails);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Booking Cancelled - Booking System',
        template: './cancellation',
        context: expect.objectContaining({
          name: '测试用户',
          date: '2024-01-15',
        }),
      });
    });
  });

  describe('sendBookingUpdate', () => {
    it('应该成功发送预约更新邮件', async () => {
      const bookingDetails = {
        customerName: '测试用户',
        appointmentDate: '2024-01-15',
        timeSlot: '10:00',
        serviceName: '测试服务',
        appointmentNumber: 'AP-001',
        notes: '更新备注',
      };

      await service.sendBookingUpdate('test@example.com', bookingDetails);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Booking Updated - Booking System',
        template: './updated',
        context: expect.objectContaining({
          name: '测试用户',
          date: '2024-01-15',
        }),
      });
    });

    it('应该处理没有备注的情况', async () => {
      const bookingDetails = {
        customerName: '测试用户',
        appointmentDate: '2024-01-15',
        timeSlot: '10:00',
        serviceName: '测试服务',
        appointmentNumber: 'AP-001',
      };

      await service.sendBookingUpdate('test@example.com', bookingDetails);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            notes: 'None',
          }),
        })
      );
    });
  });

  describe('sendVerificationCode', () => {
    it('应该成功发送验证码邮件（本文含代码・件名不含代码）', async () => {
      await service.sendVerificationCode('user@example.com', '123456', 5);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'user@example.com',
        // 件名は平文コードを含まない（メール一覧プレビュー等からの漏洩防止）
        subject: expect.not.stringContaining('123456'),
        template: './verification-code',
        context: {
          code: '123456',
          expiresMinutes: 5,
        },
      });
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('邮箱验证码'),
        }),
      );
    });

    it('发送失败时应该抛出异常（認証フロー中断用・握りつぶし禁止）', async () => {
      mockMailerService.sendMail.mockRejectedValueOnce(new Error('SMTP Error'));

      await expect(
        service.sendVerificationCode('user@example.com', '123456', 5)
      ).rejects.toThrow('SMTP Error');
    });
  });
});
