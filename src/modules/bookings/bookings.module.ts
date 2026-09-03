/**
 * 预约模块
 * 提供预约相关功能的依赖注入配置
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    IntegrationsModule, // B-4 投影送信（IF-01・ProjectionSenderService）
  ],
  controllers: [BookingsController],
  providers: [BookingsService, TimeSlotsService],
  exports: [BookingsService, TimeSlotsService], // 导出服务，供其他模块使用
})
export class BookingsModule {}