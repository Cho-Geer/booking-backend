/**
 * WebSocket模块
 * 提供实时通知和消息推送功能
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationController],
  providers: [WebsocketGateway, WebsocketService],
  exports: [WebsocketGateway, WebsocketService], // 导出供其他模块使用
})
export class WebsocketModule {}