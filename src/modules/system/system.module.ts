/**
 * 系统模块
 * 提供系统配置、通知管理和日志记录等系统级功能
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemController } from './controllers';
import { SettingsService, ReportsService } from './services';

@Module({
  imports: [PrismaModule],
  controllers: [SystemController],
  providers: [SettingsService, ReportsService],
  exports: [SettingsService, ReportsService],
})
export class SystemModule {}