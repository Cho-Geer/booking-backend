/**
 * Prisma数据库服务
 * 提供数据库连接管理和基础操作
 * @author Booking System
 * @since 2024
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // 配置Prisma客户端
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    // 设置查询日志
    this.$on('query' as any, (e: any) => {
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`Query: ${e.query}`);
        this.logger.log(`Params: ${e.params}`);
        this.logger.log(`Duration: ${e.duration}ms`);
      }
    });

    // 设置错误日志
    this.$on('error' as any, (e: any) => {
      this.logger.error(`Prisma Error: ${e.message}`);
    });
  }

  /**
   * 模块初始化时连接数据库
   */
  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL database');
    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * 模块销毁时断开数据库连接
   */
  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Successfully disconnected from PostgreSQL database');
    } catch (error) {
      this.logger.error('Error disconnecting from database:', error);
    }
  }

  /**
   * 健康检查 - 验证数据库连接状态
   * @returns 连接状态
   */
  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }

  /**
   * 清空所有表数据（仅用于测试环境）
   * @警告 此操作会删除所有数据，请谨慎使用！
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database cleaning is not allowed in production environment');
    }

    const tableNames = [
      'appointment_history',
      'notifications',
      'blocked_time_slots',
      'appointments',
      'user_sessions',
      'time_slots',
      'system_settings',
      'appointment_statistics',
      'activity_logs',
      'users',
    ];

    try {
      // 使用事务确保数据一致性
      await this.$transaction(async (tx) => {
        // 禁用外键约束
        await tx.$executeRaw`SET session_replication_role = 'replica';`;
        
        // 清空所有表
        for (const tableName of tableNames) {
          await tx.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`);
        }
        
        // 重新启用外键约束
        await tx.$executeRaw`SET session_replication_role = 'origin';`;
      });

      this.logger.warn('Database has been cleaned successfully');
    } catch (error) {
      this.logger.error('Error cleaning database:', error);
      throw error;
    }
  }

  /**
   * 执行原始SQL查询
   * @param sql SQL查询语句
   * @param params 查询参数
   * @returns 查询结果
   */
  async rawQuery<T = any>(sql: string, params: any[] = []): Promise<T> {
    try {
      const result = await this.$queryRawUnsafe(sql, ...params);
      return result as T;
    } catch (error) {
      this.logger.error(`Raw query failed: ${sql}`, error);
      throw error;
    }
  }

  /**
   * 获取数据库统计信息
   * @returns 统计信息
   */
  async getDatabaseStats(): Promise<{
    tableStats: Array<{ tableName: string; rowCount: number }>;
    databaseSize: string;
    connectionCount: number;
  }> {
    try {
      // 获取表统计信息
      const tableStats = await this.$queryRaw<Array<{ tableName: string; rowCount: number }>>`
        SELECT 
          schemaname || '.' || tablename as "tableName",
          n_live_tup as "rowCount"
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC;
      `;

      // 获取数据库大小
      const databaseSizeResult = await this.$queryRaw<Array<{ size: string }>>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size;
      `;

      // 获取连接数
      const connectionCountResult = await this.$queryRaw<Array<{ count: number }>>`
        SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database();
      `;

      return {
        tableStats: tableStats || [],
        databaseSize: databaseSizeResult?.[0]?.size || '0 bytes',
        connectionCount: connectionCountResult?.[0]?.count || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get database statistics:', error);
      throw error;
    }
  }
}
