/**
 * 用户模块
 * 提供用户相关功能的依赖注入配置
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { resolveJwtExpiresIn } from '../../common/utils/jwt-expires.util';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserAvatarController } from './controllers/user-avatar.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FileUploadModule } from '../../common/file-upload/file-upload.module';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    FileUploadModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: resolveJwtExpiresIn(configService.get('JWT_EXPIRES_IN')),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UsersController, UserAvatarController],
  providers: [
    UsersService,
    JwtService,
  ],
  exports: [UsersService], // 导出服务，供其他模块使用
})
export class UsersModule {}