/**
 * 时间段模块
 * 提供时间段相关功能的依赖注入配置
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { TimeSlotsService } from './time-slots.service';
import { TimeSlotsController } from './time-slots.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TimeSlotsController],
  providers: [TimeSlotsService],
  exports: [TimeSlotsService], // 导出服务，供其他模块使用
})
export class TimeSlotsModule {}