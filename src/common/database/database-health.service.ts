/**
 * 数据库健康检查服务
 * 监控数据库连接状态和性能
 * @author Booking System
 * @since 2024
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DatabaseConfigService } from './database-config.service';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  details: {
    connection: {
      status: boolean;
      latency: number;
      lastCheck: Date;
    };
    pool: {
      totalConnections: number;
      idleConnections: number;
      activeConnections: number;
      waitingRequests: number;
    };
    performance: {
      slowQueries: number;
      averageQueryTime: number;
      maxQueryTime: number;
    };
    errors: string[];
  };
}

@Injectable()
export class DatabaseHealthService {
  private readonly logger = new Logger(DatabaseHealthService.name);
  private healthStatus: DatabaseHealthStatus;
  private lastHealthCheck: Date;

  constructor(
    private prisma: PrismaService,
    private configService: DatabaseConfigService,
  ) {
    this.initializeHealthStatus();
  }

  /**
   * 初始化健康状态
   */
  private initializeHealthStatus() {
    this.healthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      details: {
        connection: {
          status: true,
          latency: 0,
          lastCheck: new Date(),
        },
        pool: {
          totalConnections: 0,
          idleConnections: 0,
          activeConnections: 0,
          waitingRequests: 0,
        },
        performance: {
          slowQueries: 0,
          averageQueryTime: 0,
          maxQueryTime: 0,
        },
        errors: [],
      },
    };
    this.lastHealthCheck = new Date();
  }

  /**
   * 执行健康检查
   */
  async checkHealth(): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // 1. 检查数据库连接
      const connectionStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const connectionLatency = Date.now() - connectionStart;

      // 2. 检查连接池状态（模拟数据，实际项目中需要集成连接池监控）
      const poolStatus = await this.getPoolStatus();

      // 3. 检查查询性能
      const performanceStatus = await this.getPerformanceStatus();

      // 4. 综合评估健康状态
      const overallStatus = this.calculateOverallStatus(
        connectionLatency,
        poolStatus,
        performanceStatus,
        errors,
      );

      this.healthStatus = {
        status: overallStatus,
        timestamp: new Date(),
        details: {
          connection: {
            status: connectionLatency < 5000, // 5秒内认为正常
            latency: connectionLatency,
            lastCheck: new Date(),
          },
          pool: poolStatus,
          performance: performanceStatus,
          errors,
        },
      };

      this.lastHealthCheck = new Date();

      this.logger.log(
        `Database health check completed: ${overallStatus}, latency: ${connectionLatency}ms`,
      );

      return this.healthStatus;
    } catch (error) {
      errors.push(`Database connection failed: ${error.message}`);
      
      this.healthStatus = {
        status: 'unhealthy',
        timestamp: new Date(),
        details: {
          connection: {
            status: false,
            latency: Date.now() - startTime,
            lastCheck: new Date(),
          },
          pool: this.healthStatus.details.pool,
          performance: this.healthStatus.details.performance,
          errors,
        },
      };

      this.logger.error('Database health check failed', error.stack);
      return this.healthStatus;
    }
  }

  /**
   * 获取连接池状态
   */
  private async getPoolStatus() {
    // 这里应该集成实际的连接池监控
    // 由于Prisma的连接池是内部的，这里提供模拟数据
    return {
      totalConnections: Math.floor(Math.random() * 20) + 5,
      idleConnections: Math.floor(Math.random() * 10) + 2,
      activeConnections: Math.floor(Math.random() * 15) + 3,
      waitingRequests: Math.floor(Math.random() * 5),
    };
  }

  /**
   * 获取性能状态
   */
  private async getPerformanceStatus() {
    // 这里应该集成实际的查询性能监控
    // 提供模拟数据
    return {
      slowQueries: Math.floor(Math.random() * 10),
      averageQueryTime: Math.floor(Math.random() * 100) + 50,
      maxQueryTime: Math.floor(Math.random() * 500) + 200,
    };
  }

  /**
   * 计算整体健康状态
   */
  private calculateOverallStatus(
    connectionLatency: number,
    poolStatus: any,
    performanceStatus: any,
    errors: string[],
  ): 'healthy' | 'unhealthy' | 'degraded' {
    if (errors.length > 0) {
      return 'unhealthy';
    }

    if (connectionLatency > 3000) {
      return 'degraded';
    }

    if (poolStatus.waitingRequests > 10) {
      return 'degraded';
    }

    if (performanceStatus.slowQueries > 20) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * 获取当前健康状态
   */
  getCurrentHealth(): DatabaseHealthStatus {
    return this.healthStatus;
  }

  /**
   * 获取最后检查时间
   */
  getLastHealthCheck(): Date {
    return this.lastHealthCheck;
  }

  /**
   * 是否需要重新检查
   */
  shouldRecheck(): boolean {
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - this.lastHealthCheck.getTime();
    const recheckInterval = 30000; // 30秒

    return timeSinceLastCheck > recheckInterval;
  }

  /**
   * 获取健康状态报告
   */
  getHealthReport(): string {
    const status = this.healthStatus;
    const pool = status.details.pool;
    const perf = status.details.performance;
    const conn = status.details.connection;

    return `
数据库健康状态报告:
===================
整体状态: ${status.status}
检查时间: ${status.timestamp.toISOString()}

连接状态:
- 连接状态: ${conn.status ? '正常' : '异常'}
- 连接延迟: ${conn.latency}ms
- 最后检查: ${conn.lastCheck.toISOString()}

连接池状态:
- 总连接数: ${pool.totalConnections}
- 空闲连接: ${pool.idleConnections}
- 活跃连接: ${pool.activeConnections}
- 等待请求: ${pool.waitingRequests}

性能状态:
- 慢查询数: ${perf.slowQueries}
- 平均查询时间: ${perf.averageQueryTime}ms
- 最大查询时间: ${perf.maxQueryTime}ms

错误信息:
${status.details.errors.length > 0 ? status.details.errors.map(err => `- ${err}`).join('\n') : '无错误'}
    `.trim();
  }
}