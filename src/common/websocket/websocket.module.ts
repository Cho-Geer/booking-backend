/**
 * WebSocket模块
 * 提供实时通知和消息推送功能
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [NotificationController],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketGateway, WebsocketService], // 导出供其他模块使用
})
export class WebsocketModule {}