/**
 * 集成模块（P0-3 B-2/B-3・IF-02）
 * 提供外部系统（Salesforce）集成命令受理能力
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { IntegrationCommandsService } from './integration-commands.service';
import { IntegrationCommandsController } from './integration-commands.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [IntegrationCommandsController],
  providers: [IntegrationCommandsService],
  exports: [IntegrationCommandsService],
})
export class IntegrationsModule {}
