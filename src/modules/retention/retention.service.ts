import { Injectable, Logger } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RetentionRunSummary {
  mode: 'dry-run' | 'execute';
  cutoff: string;
  days: number;
  batchSize: number;
  matchedAppointments: number;
  deletedAppointments: number;
  durationMs: number;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  getRetentionDays(): number {
    const value = Number(process.env.RETENTION_DAYS ?? 30);
    if (!Number.isFinite(value) || value <= 0) {
      return 30;
    }
    return Math.floor(value);
  }

  getBatchSize(): number {
    const value = Number(process.env.RETENTION_BATCH_SIZE ?? 500);
    if (!Number.isFinite(value) || value <= 0) {
      return 500;
    }
    return Math.floor(value);
  }

  getBatchSleepMs(): number {
    const value = Number(process.env.RETENTION_BATCH_SLEEP_MS ?? 200);
    if (!Number.isFinite(value) || value < 0) {
      return 200;
    }
    return Math.floor(value);
  }

  isEnabled(): boolean {
    const raw = (process.env.RETENTION_ENABLED ?? 'true').toLowerCase();
    return !['0', 'false', 'off', 'no'].includes(raw);
  }

  isDryRunEnabled(): boolean {
    const raw = (process.env.RETENTION_DRY_RUN ?? 'false').toLowerCase();
    return ['1', 'true', 'on', 'yes'].includes(raw);
  }

  private getCutoff(days: number): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
  }

  private buildWhere(cutoff: Date): Prisma.AppointmentWhereInput {
    return {
      OR: [
        {
          status: AppointmentStatus.CANCELLED,
          OR: [{ cancelledAt: { lt: cutoff } }, { cancelledAt: null, updatedAt: { lt: cutoff } }],
        },
        {
          status: AppointmentStatus.COMPLETED,
          OR: [{ completedAt: { lt: cutoff } }, { completedAt: null, updatedAt: { lt: cutoff } }],
        },
      ],
    };
  }

  async runRetention(): Promise<RetentionRunSummary> {
    const dryRun = this.isDryRunEnabled();
    if (dryRun) {
      return this.runDry();
    }
    return this.runExecute();
  }

  async runDry(): Promise<RetentionRunSummary> {
    const startedAt = Date.now();
    const days = this.getRetentionDays();
    const batchSize = this.getBatchSize();
    const cutoff = this.getCutoff(days);
    const where = this.buildWhere(cutoff);
    const matchedAppointments = await this.prisma.appointment.count({ where });
    const durationMs = Date.now() - startedAt;
    const summary: RetentionRunSummary = {
      mode: 'dry-run',
      cutoff: cutoff.toISOString(),
      days,
      batchSize,
      matchedAppointments,
      deletedAppointments: 0,
      durationMs,
    };
    this.logger.log(`Retention dry-run summary: ${JSON.stringify(summary)}`);
    return summary;
  }

  async runExecute(): Promise<RetentionRunSummary> {
    const startedAt = Date.now();
    const days = this.getRetentionDays();
    const batchSize = this.getBatchSize();
    const batchSleepMs = this.getBatchSleepMs();
    const cutoff = this.getCutoff(days);
    const where = this.buildWhere(cutoff);
    const matchedAppointments = await this.prisma.appointment.count({ where });

    let deletedAppointments = 0;
    while (true) {
      const batch = await this.prisma.appointment.findMany({
        where,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) {
        break;
      }

      const ids = batch.map((item) => item.id);
      const result = await this.prisma.appointment.deleteMany({
        where: { id: { in: ids } },
      });
      deletedAppointments += result.count;

      if (batchSleepMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, batchSleepMs));
      }
    }

    const durationMs = Date.now() - startedAt;
    const summary: RetentionRunSummary = {
      mode: 'execute',
      cutoff: cutoff.toISOString(),
      days,
      batchSize,
      matchedAppointments,
      deletedAppointments,
      durationMs,
    };
    this.logger.log(`Retention execute summary: ${JSON.stringify(summary)}`);
    return summary;
  }
}
