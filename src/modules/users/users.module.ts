/**
 * 用户模块
 * 提供用户相关功能的依赖注入配置
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserAvatarController } from './controllers/user-avatar.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FileUploadModule } from '../../common/file-upload/file-upload.module';
import { EmailModule } from '../email/email.module';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    FileUploadModule,
    EmailModule,
  ],
  controllers: [UsersController, UserAvatarController],
  providers: [
    UsersService,
    JwtService,
  ],
  exports: [UsersService], // 导出服务，供其他模块使用
})
export class UsersModule {}