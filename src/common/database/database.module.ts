/**
 * 数据库模块
 * 提供数据库连接池优化和健康监控
 * @author Booking System
 * @since 2024
 */

import { Module, Global } from '@nestjs/common';
import { DatabaseConfigService } from './database-config.service';
import { DatabaseHealthService } from './database-health.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    DatabaseConfigService,
    DatabaseHealthService,
  ],
  exports: [
    DatabaseConfigService,
    DatabaseHealthService,
  ],
})
export class DatabaseModule {}