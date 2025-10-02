/**
 * Prisma模块
 * 提供Prisma客户端的依赖注入和生命周期管理
 * @author Booking System
 * @since 2024-01-01
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Prisma模块
 * 全局提供Prisma数据库访问服务
 */
@Global() // 全局模块，其他模块无需导入即可使用
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 导出PrismaService供其他模块使用
})
export class PrismaModule {}