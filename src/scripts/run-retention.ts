import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RetentionService } from '../modules/retention/retention.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    const retentionService = app.get(RetentionService);
    const mode = process.argv[2] || 'execute';
    const summary = mode === 'dry-run' ? await retentionService.runDry() : await retentionService.runExecute();
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
