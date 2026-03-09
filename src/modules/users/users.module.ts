/**
 * 用户模块
 * 提供用户相关功能的依赖注入配置
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserAvatarController } from './controllers/user-avatar.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FileUploadModule } from '../../common/file-upload/file-upload.module';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    FileUploadModule,
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
  controllers: [UsersController, UserAvatarController],
  providers: [UsersService],
  exports: [UsersService], // 导出服务，供其他模块使用
})
export class UsersModule {}