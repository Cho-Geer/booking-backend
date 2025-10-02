/**
 * 预约模块
 * 提供预约相关功能的依赖注入配置
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      },
    }),
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService], // 导出服务，供其他模块使用
})
export class BookingsModule {}