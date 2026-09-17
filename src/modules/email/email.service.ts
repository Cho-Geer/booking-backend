
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { MaskingUtil } from '../../common/utils/masking.util';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Send verification code email
   *
   * 予約通知系（sendBookingConfirmation など）と異なり、送信失敗時に例外を投げる。
   * 認証コードはメール到達が前提のため、呼び出し側（AuthService）が失敗を検知して
   * 途中中断（Redis へコードを保存しない）できるようにする。
   *
   * @param to Recipient email
   * @param code 6-digit verification code
   * @param expiresMinutes Validity period in minutes
   */
  async sendVerificationCode(to: string, code: string, expiresMinutes: number): Promise<void> {
    try {
      this.logger.log(`Sending verification code email to ${MaskingUtil.maskEmail(to)}`);
      await this.mailerService.sendMail({
        to,
        subject: `验证码 ${code}（${expiresMinutes}分钟内有效） - Booking System`,
        template: './verification-code',
        context: {
          code,
          expiresMinutes,
        },
      });
      this.logger.log(`Verification code email sent to ${MaskingUtil.maskEmail(to)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification code email to ${MaskingUtil.maskEmail(to)}`,
        error.stack,
      );
      // 認証フローを中断させるため、ここでは例外的に throw する（既存3メソッドは仕様固定で握りつぶし）
      throw error;
    }
  }

  /**
   * Send booking confirmation email
   * @param to Recipient email
   * @param bookingDetails Booking details
   */
  async sendBookingConfirmation(to: string, bookingDetails: any) {
    try {
      this.logger.log(`Sending booking confirmation email to ${to}`);
      await this.mailerService.sendMail({
        to,
        subject: 'Booking Confirmation - Booking System',
        template: './confirmation', // name of the template file without extension
        context: {
          name: bookingDetails.customerName,
          date: bookingDetails.appointmentDate,
          time: bookingDetails.timeSlot,
          service: bookingDetails.serviceName,
          bookingId: bookingDetails.appointmentNumber,
          notes: bookingDetails.notes || 'None',
        },
      });
      this.logger.log(`Booking confirmation email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send booking confirmation email to ${to}`, error.stack);
      // We don't throw here to avoid failing the booking transaction if email fails
      // In a production system, we might want to queue this for retry
    }
  }

  /**
   * Send booking cancellation email
   * @param to Recipient email
   * @param bookingDetails Booking details
   */
  async sendBookingCancellation(to: string, bookingDetails: any) {
    try {
      this.logger.log(`Sending booking cancellation email to ${to}`);
      await this.mailerService.sendMail({
        to,
        subject: 'Booking Cancelled - Booking System',
        template: './cancellation',
        context: {
          name: bookingDetails.customerName,
          date: bookingDetails.appointmentDate,
          time: bookingDetails.timeSlot,
          service: bookingDetails.serviceName,
          bookingId: bookingDetails.appointmentNumber,
          notes: bookingDetails.notes || 'None',
        },
      });
      this.logger.log(`Booking cancellation email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send booking cancellation email to ${to}`, error.stack);
    }
  }

  /**
   * Send booking update email
   * @param to Recipient email
   * @param bookingDetails Booking details
   */
  async sendBookingUpdate(to: string, bookingDetails: any) {
    try {
      this.logger.log(`Sending booking update email to ${to}`);
      await this.mailerService.sendMail({
        to,
        subject: 'Booking Updated - Booking System',
        template: './updated',
        context: {
          name: bookingDetails.customerName,
          date: bookingDetails.appointmentDate,
          time: bookingDetails.timeSlot,
          service: bookingDetails.serviceName,
          bookingId: bookingDetails.appointmentNumber,
          notes: bookingDetails.notes || 'None',
        },
      });
      this.logger.log(`Booking update email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send booking update email to ${to}`, error.stack);
    }
  }
}
