import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { RetentionScheduler } from './retention.scheduler';
import { RetentionService } from './retention.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), PrismaModule],
  providers: [RetentionService, RetentionScheduler],
  exports: [RetentionService],
})
export class RetentionModule {}
