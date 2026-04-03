
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { join } from 'path';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get('MAIL_HOST', 'smtp.example.com'),
          port: config.get('MAIL_PORT', 587),
          secure: config.get('MAIL_SECURE', false),
          auth: {
            user: config.get('MAIL_USERNAME') || config.get('MAIL_USER') || 'user@example.com',
            pass: config.get('MAIL_PASSWORD', 'topsecret'),
          },
        },
        defaults: {
          from: `"No Reply" <${config.get('MAIL_FROM', 'noreply@example.com')}>`,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
