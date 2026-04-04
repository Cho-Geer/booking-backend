/**
 * Prisma服务
 * 封装Prisma客户端，提供数据库访问功能
 * @author Booking System
 * @since 2024-01-01
 */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DatabaseConfigService } from '../database/database-config.service';
import { writeStructuredLog } from '../logging/structured-log.util';

/**
 * Prisma服务类
 * 负责Prisma客户端的初始化和销毁
 * 提供数据库连接管理和查询功能
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  
  constructor() {
    // 直接使用环境变量初始化Prisma客户端
    super({
      log: ['query', 'info', 'warn', 'error'],
      errorFormat: 'colorless' as const,
    });
  }
  
  /**
   * 模块初始化时建立数据库连接
   * 配置连接池参数和日志级别
   */
  async onModuleInit() {
    try {
      // 建立数据库连接
      await this.$connect();
      writeStructuredLog('log', 'database_connected', PrismaService.name, {
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      });
      
      // 配置连接池参数（PostgreSQL优化）
      if (process.env.NODE_ENV === 'production') {
        // 生产环境连接池配置
        await this.$queryRaw`SET statement_timeout = '30000ms'`;
        await this.$queryRaw`SET lock_timeout = '10s'`;
        await this.$queryRaw`SET idle_in_transaction_session_timeout = '5s'`;
        
        writeStructuredLog('log', 'database_prod_config_applied', PrismaService.name);
      }
      
      // 设置查询超时
      await this.$queryRaw`SET statement_timeout = '30000ms'`;
      
      writeStructuredLog('log', 'database_pool_configured', PrismaService.name, {
        nodeEnv: process.env.NODE_ENV ?? 'development',
      });
    } catch (error) {
      writeStructuredLog('error', 'database_connection_failed', PrismaService.name, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 模块销毁时断开数据库连接
   * 清理资源和连接池
   */
  async onModuleDestroy() {
    try {
      await this.$disconnect();
      writeStructuredLog('log', 'database_disconnected', PrismaService.name);
    } catch (error) {
      writeStructuredLog('error', 'database_disconnect_failed', PrismaService.name, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 数据库健康检查
   * 检查数据库连接状态和基本功能
   * @returns 是否健康
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      writeStructuredLog('error', 'database_health_check_failed', PrismaService.name, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 清理数据库（仅用于测试环境）
   * 删除所有测试数据
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('清理数据库操作仅允许在测试环境中执行');
    }

    // 按依赖关系顺序删除数据
    const tableNames = ['Appointment', 'User', 'TimeSlot', 'SystemSetting'];
    
    for (const tableName of tableNames) {
      await this.$queryRawUnsafe(`DELETE FROM "${tableName}"`);
    }
  }
}
