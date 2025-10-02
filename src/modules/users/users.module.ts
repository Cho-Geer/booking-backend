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

@Module({
  imports: [
    PrismaModule,
    FileUploadModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      },
    }),
  ],
  controllers: [UsersController, UserAvatarController],
  providers: [UsersService],
  exports: [UsersService], // 导出服务，供其他模块使用
})
export class UsersModule {}