/**
 * Prisma服务
 * 封装Prisma客户端，提供数据库访问功能
 * @author Booking System
 * @since 2024-01-01
 */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DatabaseConfigService } from '../database/database-config.service';

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
      console.log('✅ 数据库连接成功');
      
      // 配置连接池参数（PostgreSQL优化）
      if (process.env.NODE_ENV === 'production') {
        // 生产环境连接池配置
        await this.$queryRaw`SET statement_timeout = '30000ms'`;
        await this.$queryRaw`SET lock_timeout = '10s'`;
        await this.$queryRaw`SET idle_in_transaction_session_timeout = '5s'`;
        
        console.log('🔧 生产环境数据库配置已应用');
      }
      
      // 设置查询超时
      await this.$queryRaw`SET statement_timeout = '30000ms'`;
      
      console.log('🔧 数据库连接池配置完成');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error);
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
      console.log('✅ 数据库连接已断开');
    } catch (error) {
      console.error('❌ 数据库断开连接失败:', error);
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
      console.error('数据库健康检查失败:', error);
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