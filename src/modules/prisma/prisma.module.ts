/**
 * Prisma模块
 * 提供数据库连接和基础服务
 * @author Booking System
 * @since 2024
 */

import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // 标记为全局模块，可以在整个应用中注入
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 导出PrismaService供其他模块使用
})
export class PrismaModule {}
