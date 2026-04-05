import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-redis-store';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ServicesModule } from './modules/services/services.module';
import { TimeSlotsModule } from './modules/time-slots/time-slots.module';
import { EmailModule } from './modules/email/email.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { DatabaseModule } from './common/database/database.module';
import { FileUploadModule } from './common/file-upload/file-upload.module';
import { WebsocketModule } from './common/websocket/websocket.module';
import { HealthModule } from './common/health/health.module';
import { RetentionModule } from './modules/retention/retention.module';

/**
 * 主应用模块
 * 使用PostgreSQL + Prisma + Redis缓存配置
 */
@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env.production', '.env'],
    }),
    ScheduleModule.forRoot(),
    
    // 数据库模块（包含连接池优化）
    DatabaseModule,
    
    // Prisma模块
    PrismaModule,
    
    // Redis缓存配置
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore as any,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD', ''),
        ttl: Number(configService.get('REDIS_TTL', 3600)), // 默认缓存1小时
        max: 1000, // 最大缓存项数
      }),
      inject: [ConfigService],
    }),
    
    // 文件上传模块
    FileUploadModule,
    HealthModule,
    
    // WebSocket模块（实时通知）
    WebsocketModule,
    
    // 业务模块
    AuthModule,
    UsersModule,
    BookingsModule,
    ServicesModule,
    TimeSlotsModule,
    EmailModule,
    RetentionModule,
  ],
})
export class AppModule {}
