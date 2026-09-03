/**
 * 集成模块（P0-3 B-2/B-3/B-4・IF-01/IF-02）
 * 提供外部系统（Salesforce）集成命令受理与投影送信能力
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationCommandsService } from './integration-commands.service';
import { IntegrationCommandsController } from './integration-commands.controller';
import { ProjectionSenderService } from './projection-sender.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    // B-4 投影送信（IF-01）：HttpService 来源；JwtService 由 app.module JwtModule global:true 提供，无需重复注册
    HttpModule,
  ],
  controllers: [IntegrationCommandsController],
  providers: [IntegrationCommandsService, ProjectionSenderService],
  exports: [IntegrationCommandsService, ProjectionSenderService],
})
export class IntegrationsModule {}
