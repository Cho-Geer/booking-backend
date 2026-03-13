import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RetentionScheduler } from './retention.scheduler';
import { RetentionService } from './retention.service';

@Module({
  imports: [PrismaModule],
  providers: [RetentionService, RetentionScheduler],
  exports: [RetentionService],
})
export class RetentionModule {}
