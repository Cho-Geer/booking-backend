/**
 * 数据库配置服务
 * 提供数据库连接池优化配置
 * @author Booking System
 * @since 2024
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DatabasePoolConfig {
  min: number; // 最小连接数
  max: number; // 最大连接数
  idleTimeoutMillis: number; // 空闲连接超时时间（毫秒）
  connectionTimeoutMillis: number; // 连接超时时间（毫秒）
  acquireTimeoutMillis: number; // 获取连接超时时间（毫秒）
  reapIntervalMillis: number; // 清理间隔时间（毫秒）
  createTimeoutMillis: number; // 创建连接超时时间（毫秒）
  destroyTimeoutMillis: number; // 销毁连接超时时间（毫秒）
  createRetryIntervalMillis: number; // 创建重试间隔时间（毫秒）
}

export interface DatabasePerformanceConfig {
  statementTimeout: number; // 查询超时时间（毫秒）
  queryTimeout: number; // 查询超时时间（毫秒）
  poolSize: number; // 连接池大小
  maxUses: number; // 连接最大使用次数
}

@Injectable()
export class DatabaseConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * 获取数据库连接池配置
   */
  getPoolConfig(): DatabasePoolConfig {
    const env = this.configService.get('NODE_ENV', 'development');
    
    // 根据环境配置不同的连接池参数
    const poolConfigMap = {
      development: {
        min: 2, // 最小连接数
        max: 10, // 最大连接数
        idleTimeoutMillis: 30000, // 30秒
        connectionTimeoutMillis: 2000, // 2秒
        acquireTimeoutMillis: 30000, // 30秒
        reapIntervalMillis: 1000, // 1秒
        createTimeoutMillis: 5000, // 5秒
        destroyTimeoutMillis: 5000, // 5秒
        createRetryIntervalMillis: 200, // 200毫秒
      },
      production: {
        min: 5, // 最小连接数
        max: 50, // 最大连接数
        idleTimeoutMillis: 60000, // 60秒
        connectionTimeoutMillis: 5000, // 5秒
        acquireTimeoutMillis: 60000, // 60秒
        reapIntervalMillis: 1000, // 1秒
        createTimeoutMillis: 10000, // 10秒
        destroyTimeoutMillis: 5000, // 5秒
        createRetryIntervalMillis: 500, // 500毫秒
      },
      test: {
        min: 1, // 最小连接数
        max: 5, // 最大连接数
        idleTimeoutMillis: 10000, // 10秒
        connectionTimeoutMillis: 1000, // 1秒
        acquireTimeoutMillis: 10000, // 10秒
        reapIntervalMillis: 500, // 500毫秒
        createTimeoutMillis: 2000, // 2秒
        destroyTimeoutMillis: 2000, // 2秒
        createRetryIntervalMillis: 100, // 100毫秒
      },
    };

    return poolConfigMap[env] || poolConfigMap.development;
  }

  /**
   * 获取数据库性能配置
   */
  getPerformanceConfig(): DatabasePerformanceConfig {
    const env = this.configService.get('NODE_ENV', 'development');
    
    const performanceConfigMap = {
      development: {
        statementTimeout: 30000, // 30秒
        queryTimeout: 30000, // 30秒
        poolSize: 10,
        maxUses: 7500, // 连接最大使用次数
      },
      production: {
        statementTimeout: 60000, // 60秒
        queryTimeout: 60000, // 60秒
        poolSize: 50,
        maxUses: 5000, // 连接最大使用次数
      },
      test: {
        statementTimeout: 10000, // 10秒
        queryTimeout: 10000, // 10秒
        poolSize: 5,
        maxUses: 10000, // 连接最大使用次数
      },
    };

    return performanceConfigMap[env] || performanceConfigMap.development;
  }

  /**
   * 获取数据库URL
   */
  getDatabaseUrl(): string {
    return this.configService.get('DATABASE_URL');
  }

  /**
   * 获取数据库连接配置
   */
  getConnectionConfig() {
    const poolConfig = this.getPoolConfig();
    const performanceConfig = this.getPerformanceConfig();

    return {
      datasources: {
        db: {
          url: this.getDatabaseUrl(),
        },
      },
      // Prisma连接池配置
      prisma: {
        log: this.getLogLevel(),
        errorFormat: 'colorless',
        __internal: {
          engine: {
            enableEngineDebugMode: this.configService.get('NODE_ENV') === 'development',
          },
        },
      },
      // PostgreSQL原生连接池配置（用于扩展场景）
      pg: {
        connectionString: this.getDatabaseUrl(),
        ...poolConfig,
        statement_timeout: performanceConfig.statementTimeout,
        query_timeout: performanceConfig.queryTimeout,
        maxUses: performanceConfig.maxUses,
        // 连接健康检查
        healthCheck: {
          enabled: true,
          interval: 30000, // 30秒检查一次
          timeout: 5000, // 5秒超时
          retries: 3, // 重试3次
        },
        // SSL配置（生产环境）
        ssl: this.getSslConfig(),
      },
    };
  }

  /**
   * 获取日志级别
   */
  private getLogLevel() {
    const env = this.configService.get('NODE_ENV', 'development');
    const logLevels = {
      development: ['query', 'error', 'warn', 'info'],
      production: ['error', 'warn'],
      test: ['error'],
    };
    return logLevels[env] || logLevels.development;
  }

  /**
   * 获取SSL配置
   */
  private getSslConfig() {
    const env = this.configService.get('NODE_ENV', 'development');
    
    if (env === 'production') {
      return {
        rejectUnauthorized: true,
        // 生产环境可以配置CA证书等
      };
    }
    
    return false; // 开发环境不使用SSL
  }

  /**
   * 获取数据库监控配置
   */
  getMonitoringConfig() {
    return {
      // 慢查询阈值（毫秒）
      slowQueryThreshold: this.configService.get('SLOW_QUERY_THRESHOLD', 1000),
      
      // 连接池监控
      poolMonitoring: {
        enabled: true,
        interval: 60000, // 1分钟
        metrics: {
          totalConnections: true,
          idleConnections: true,
          activeConnections: true,
          waitingRequests: true,
        },
      },
      
      // 查询性能监控
      queryMonitoring: {
        enabled: true,
        logSlowQueries: true,
        logQueryPlans: this.configService.get('NODE_ENV') === 'development',
      },
    };
  }
}