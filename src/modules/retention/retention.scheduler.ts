import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RetentionService } from './retention.service';

@Injectable()
export class RetentionScheduler {
  private readonly logger = new Logger(RetentionScheduler.name);

  constructor(private readonly retentionService: RetentionService) {}

  @Cron(process.env.RETENTION_CRON || '0 30 2 * * *')
  async handleDailyRetention(): Promise<void> {
    if (!this.retentionService.isEnabled()) {
      this.logger.log('Retention cleanup skipped because RETENTION_ENABLED=false');
      return;
    }

    try {
      const summary = await this.retentionService.runRetention();
      this.logger.log(`Retention cleanup completed: ${JSON.stringify(summary)}`);
    } catch (error) {
      this.logger.error('Retention cleanup failed', error.stack);
    }
  }
}
