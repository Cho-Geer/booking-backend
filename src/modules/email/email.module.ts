
import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { join } from 'path';
import { createRequire } from 'module';
import { parseBooleanConfig } from '../../common/utils/config.util';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        const templatesDisabled = parseBooleanConfig(
          config.get('MAIL_DISABLE_TEMPLATES') ?? process.env.MAIL_DISABLE_TEMPLATES,
          false,
        );

        const baseConfig = {
          transport: {
            host: config.get('MAIL_HOST', 'smtp.example.com'),
            port: Number(config.get('MAIL_PORT', 587)),
            secure: parseBooleanConfig(config.get('MAIL_SECURE'), false),
            auth: {
              user: config.get('MAIL_USERNAME') || config.get('MAIL_USER') || 'user@example.com',
              pass: config.get('MAIL_PASSWORD', 'topsecret'),
            },
          },
          defaults: {
            from: `"No Reply" <${config.get('MAIL_FROM', 'noreply@example.com')}>`,
          },
        };

        if (templatesDisabled) {
          return baseConfig;
        }

        // Resolve the installed adapter file directly so Jest does not block private package subpath imports.
        const adapterPath = join(
          process.cwd(),
          'node_modules',
          '@nestjs-modules',
          'mailer',
          'dist',
          'adapters',
          'handlebars.adapter.js',
        );
        const requireFromModule = createRequire(__filename);
        const { HandlebarsAdapter } = requireFromModule(adapterPath) as {
          HandlebarsAdapter: new () => unknown;
        };

        return {
          ...baseConfig,
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
