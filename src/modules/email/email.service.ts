
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

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
        },
      });
      this.logger.log(`Booking cancellation email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send booking cancellation email to ${to}`, error.stack);
    }
  }
}
