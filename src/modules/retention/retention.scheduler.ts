import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { RetentionService } from './retention.service';

@Injectable()
export class RetentionScheduler implements OnModuleInit {
  private readonly logger = new Logger(RetentionScheduler.name);
  private cronExpression: string;

  constructor(
    private readonly retentionService: RetentionService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    // 在构造函数中初始化cron表达式，但实际注册在onModuleInit中完成
    this.cronExpression = this.configService.get<string>('RETENTION_CRON', '0 30 2 * * *');
  }

  onModuleInit() {
    this.registerCronJob();
  }

  private registerCronJob() {
    const jobName = 'retentionCleanupJob';
    
    // 如果已经存在同名的cron任务，先删除
    if (this.schedulerRegistry.doesExist('cron', jobName)) {
      this.schedulerRegistry.deleteCronJob(jobName);
      this.logger.debug(`Removed existing cron job: ${jobName}`);
    }

    // 创建新的cron任务
    const callback = this.handleDailyRetention.bind(this);
    const cronJob = new CronJob(this.cronExpression, callback);
    
    this.schedulerRegistry.addCronJob(jobName, cronJob);
    cronJob.start();
    
    this.logger.log(`Retention cleanup scheduled with cron: ${this.cronExpression}`);
  }

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
