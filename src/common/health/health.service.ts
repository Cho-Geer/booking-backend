import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { DatabaseHealthService } from '../database/database-health.service';

type DependencyState = 'up' | 'down';
type OverallState = 'healthy' | 'degraded' | 'unhealthy';

@Injectable()
export class HealthService {
  constructor(
    private readonly databaseHealthService: DatabaseHealthService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async check() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const overallStatus = this.getOverallStatus(database.status, redis.status);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
      service: 'booking-backend',
      checks: {
        database,
        redis,
      },
      httpStatus:
        overallStatus === 'healthy'
          ? HttpStatus.OK
          : HttpStatus.SERVICE_UNAVAILABLE,
    };
  }

  private async checkDatabase() {
    const health = await this.databaseHealthService.checkHealth();
    const status: DependencyState =
      health.status === 'healthy' ? 'up' : 'down';

    return {
      status,
      latencyMs: health.details.connection.latency,
      checkedAt: health.details.connection.lastCheck.toISOString(),
      errors: health.details.errors,
    };
  }

  private async checkRedis() {
    const key = `health:redis:${Date.now()}`;
    const startedAt = Date.now();

    try {
      await this.cacheManager.set(key, 'ok', 5_000);
      const value = await this.cacheManager.get<string>(key);
      const latencyMs = Date.now() - startedAt;

      if (value !== 'ok') {
        throw new Error('Redis round-trip verification failed');
      }

      return {
        status: 'up' as const,
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'down' as const,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  private getOverallStatus(
    databaseStatus: DependencyState,
    redisStatus: DependencyState,
  ): OverallState {
    if (databaseStatus === 'up' && redisStatus === 'up') {
      return 'healthy';
    }

    return 'unhealthy';
  }
}
