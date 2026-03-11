/**
 * 预约模块
 * 提供预约相关功能的依赖注入配置
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BookingsService } from './bookings.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: Number(configService.get('JWT_EXPIRES_IN') || 3600),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, TimeSlotsService],
  exports: [BookingsService, TimeSlotsService], // 导出服务，供其他模块使用
})
export class BookingsModule {}