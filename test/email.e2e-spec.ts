
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../src/modules/email/email.module';
import { EmailService } from '../src/modules/email/email.service';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

interface MailHogMessage {
  Content: {
    Headers: {
      To: string[];
      Subject: string[];
    };
    Body: string;
  };
}

interface MailHogResponse {
  items: MailHogMessage[];
}

describe('Email Service (E2E) with TestContainers', () => {
  let module: TestingModule;
  let emailService: EmailService;
  let mailhogContainer: StartedTestContainer;
  let smtpPort: number;
  let apiPort: number;

  // Increase timeout for container startup
  jest.setTimeout(60000);

  beforeAll(async () => {
    // Start Mailhog container
    mailhogContainer = await new GenericContainer('mailhog/mailhog')
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forLogMessage('Serving under http://0.0.0.0:8025/'))
      .start();

    smtpPort = mailhogContainer.getMappedPort(1025);
    apiPort = mailhogContainer.getMappedPort(8025);
    const host = mailhogContainer.getHost();

    console.log(`Mailhog started on ${host} SMTP:${smtpPort} API:${apiPort}`);

    // Set environment variables for EmailModule
    process.env.MAIL_HOST = host;
    process.env.MAIL_PORT = smtpPort.toString();
    process.env.MAIL_USERNAME = 'test@example.com';
    process.env.MAIL_PASSWORD = 'password';
    process.env.MAIL_FROM = 'noreply@test.com';
    
    // Ensure MAIL_USER is unset to verify the fix
    delete process.env.MAIL_USER;
    delete process.env.MAIL_SECURE; // Ensure it uses default false (boolean)
    delete process.env.MAIL_DISABLE_TEMPLATES;

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true, // Ignore .env file to use process.env
        }),
        EmailModule,
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
    if (mailhogContainer) {
      await mailhogContainer.stop();
    }
    
    // Clean up dynamically loaded HandlebarsAdapter module to prevent open handle warning
    try {
      const { join } = await import('path');
      const adapterPath = join(
        process.cwd(),
        'node_modules',
        '@nestjs-modules',
        'mailer',
        'dist',
        'adapters',
        'handlebars.adapter.js'
      );
      
      // Delete from require cache if it exists
      if (require.cache[adapterPath]) {
        delete require.cache[adapterPath];
      }
      
      // Also clean up any related cached modules
      const cacheKeys = Object.keys(require.cache);
      for (const key of cacheKeys) {
        if (key.includes('handlebars.adapter') || key.includes('@nestjs-modules/mailer')) {
          delete require.cache[key];
        }
      }
    } catch (error) {
      // Ignore errors during cleanup
      console.warn('Failed to clean up HandlebarsAdapter cache:', error.message);
    }
    
    // Reset Jest modules to clean up any remaining open handles
    jest.resetModules();
    
    // Force garbage collection to clean up any remaining handles
    if (global.gc) {
      global.gc();
    }
  });

  it('should send a booking confirmation email', async () => {
    const to = 'customer@example.com';
    const bookingDetails = {
      customerName: 'Test Customer',
      appointmentDate: '2026-03-12',
      timeSlot: '10:00',
      serviceName: 'Haircut',
      appointmentNumber: 'BK-123',
    };

    await emailService.sendBookingConfirmation(to, bookingDetails);

    // Verify email received in Mailhog via API
    const response = await fetch(`http://${mailhogContainer.getHost()}:${apiPort}/api/v2/messages`);
    const data = (await response.json()) as MailHogResponse;
    const messages = data.items;

    expect(messages.length).toBeGreaterThan(0);
    const latestMessage = messages[0];
    
    expect(latestMessage.Content.Headers.To[0]).toBe(to);
    expect(latestMessage.Content.Headers.Subject[0]).toContain('Booking Confirmation');
    
    // Verify content
    const body = latestMessage.Content.Body;
    expect(body).toContain('Test Customer');
    expect(body).toContain('BK-123');
  });
});
