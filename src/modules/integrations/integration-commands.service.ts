/**
 * 集成命令服务（P0-3 B-2/B-3・IF-02・DD-02 §2.3）
 * 受理 Salesforce 侧下发的预约取消命令（CANCEL_BOOKING）：
 * 幂等先行（RULE-03）→ 静态映射校验（RULE-12）→ 预约定位 → 状态迁移门（RULE-05/07）→
 * 版本门（RULE-02・C-10 无 0 特例）→ 同一事务内正本更新 + 命令行写入（RULE-08）。
 * 本路径不引入 P2034 重试：version 门即并发控制。
 * @author Booking System
 * @since 2024
 */

import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingCommandRequestDto } from './dto/booking-command-request.dto';
import { BookingCommandResult } from './dto/booking-command-result.dto';
import {
  AuthorizationException,
  ResourceNotFoundException,
  ResourceConflictException,
  BusinessRuleException,
} from '../../common/exceptions/business.exceptions';
import { ProjectionSenderService } from './projection-sender.service';
import { EmailService } from '../email/email.service';

/**
 * 集成命令服务类
 * 处理外部系统（Salesforce）下发的预约命令
 */
@Injectable()
export class IntegrationCommandsService {
  private readonly logger = new Logger(IntegrationCommandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionSenderService: ProjectionSenderService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * 执行预约取消命令
   * 严格按 DD-02 §2.3 顺序执行：
   * 1. 幂等先行：commandId 命中即原样返回初回结果，不做任何后续校验/副作用（RULE-03）
   * 2. 静态映射：Salesforce 操作员 → Booking 用户（active=true 且用户为 ADMIN/ACTIVE，否则 403・RULE-12）
   * 3. 预约定位：bookingExternalId（appointments.id）不存在 → 404
   * 4. 状态迁移：status ∉ {PENDING, CONFIRMED} → 409（RULE-05/07・TC-23）
   * 5. 版本门：expectedVersion !== 正本 version → 409（RULE-02・C-10 无 0 特例）
   * 6. 同一事务：正本更新（CANCELLED + version+1 + syncStatus=PENDING + cancelledAt）+ 命令行写入（RULE-08）
   * 7. 返回受理结果（200 + canonicalVersion + SUCCESS）
   * @param dto 取消命令请求 DTO
   * @returns 受理结果（含 canonicalVersion）
   */
  async executeCancelCommand(dto: BookingCommandRequestDto): Promise<BookingCommandResult> {
    // 1. 幂等先行（RULE-03）：命中即返回，不做任何后续校验/副作用
    const existingCommand = await this.prisma.integrationCommand.findUnique({
      where: { commandId: dto.commandId },
    });
    if (existingCommand) {
      return {
        httpStatus: existingCommand.httpStatus,
        canonicalVersion: existingCommand.canonicalVersion,
        resultCode: existingCommand.resultCode,
      };
    }

    // 2. 静态映射（RULE-12）：Salesforce 操作员 → Booking 内部用户
    const mapping = await this.prisma.staticOperatorMapping.findFirst({
      where: {
        salesforceUserId: dto.requestedBySalesforceUserId,
        active: true,
      },
    });
    if (!mapping) {
      throw new AuthorizationException('Salesforce 操作员未映射或映射未启用', {
        requestedBySalesforceUserId: dto.requestedBySalesforceUserId,
        correlationId: dto.correlationId,
      });
    }

    const mappedUser = await this.prisma.user.findUnique({
      where: { id: mapping.bookingUserId },
    });
    if (!mappedUser || mappedUser.userType !== 'ADMIN' || mappedUser.status !== 'ACTIVE') {
      throw new AuthorizationException('映射用户无效（非管理员或未激活）', {
        bookingUserId: mapping.bookingUserId,
        correlationId: dto.correlationId,
      });
    }

    // 3. 预约定位（uuid id 定位・2026-09-01 拍板）
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.bookingExternalId },
    });
    if (!appointment) {
      throw new ResourceNotFoundException('预约', {
        bookingExternalId: dto.bookingExternalId,
        correlationId: dto.correlationId,
      });
    }

    // 4. 状态迁移（RULE-05/07）：仅 PENDING/CONFIRMED 可取消
    if (appointment.status !== 'PENDING' && appointment.status !== 'CONFIRMED') {
      throw new BusinessRuleException(
        `当前预约状态（${appointment.status}）不可取消，仅 PENDING/CONFIRMED 可取消`,
        {
          currentVersion: appointment.version,
          correlationId: dto.correlationId,
        },
        HttpStatus.CONFLICT
      );
    }

    // 5. 版本门（RULE-02・C-10 无 0 特例）
    if (dto.expectedVersion !== appointment.version) {
      throw new ResourceConflictException('预约版本不一致，请刷新后重试', {
        currentVersion: appointment.version,
        correlationId: dto.correlationId,
      });
    }

    // 6. 同一事务（RULE-08）：正本更新 + 命令行写入（命令行只存 200・schema 注释明文）
    // updated（含 include 关联）一并带出 tx 作用域，供事务后的キャンセル通知メール使用
    const { canonicalVersion, updated } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id: dto.bookingExternalId },
        data: {
          status: 'CANCELLED',
          version: { increment: 1 },
          syncStatus: 'PENDING',
          cancelledAt: new Date(),
        },
        include: { timeSlot: true, service: true },
      });

      await tx.integrationCommand.create({
        data: {
          commandId: dto.commandId,
          commandType: dto.commandType,
          appointmentId: dto.bookingExternalId,
          httpStatus: 200,
          resultCode: 'SUCCESS',
          canonicalVersion: updated.version,
          correlationId: dto.correlationId,
        },
      });

      return { canonicalVersion: updated.version, updated };
    });

    // B-4 投影送信（RULE-08・IF-01）：命令取消事务 resolve 后同步呼出（tx 内已含 version 递增 + syncStatus=PENDING，
    // 无需改动）；失败不影响正本応答（同期呼出・C-4）。
    // 已知行为：与 SF 侧 F-26 写回同 version 双写必有一方 409（F-26 侧 skip 设计，非缺陷）
    try {
      await this.projectionSenderService.projectBooking(dto.bookingExternalId);
    } catch {
      // 投影失敗不影响正本応答（同期呼出・C-4）
    }

    // キャンセル通知メール（UI 経路 bookings.service.ts cancelBooking と同一形状・同一順序：投影→メール）。
    // customerEmail が存在する場合のみ fire-and-forget 送信（.catch ログのみ）で、
    // メール失敗が 200 応答に影響しない（C-4）。べき等リプレイと門失敗経路はここに到達しない。
    if (updated.customerEmail) {
      this.emailService.sendBookingCancellation(updated.customerEmail, {
        customerName: updated.customerName,
        appointmentDate: updated.appointmentDate.toLocaleDateString(),
        timeSlot: updated.timeSlot ? updated.timeSlot.slotTime.toString() : '',
        serviceName: updated.service ? updated.service.name : 'Standard Service',
        appointmentNumber: updated.appointmentNumber,
        notes: updated.notes,
      }).catch(err => this.logger.error('Error triggering email cancellation', err));
    }

    // 7. 返回受理结果
    return {
      httpStatus: 200,
      canonicalVersion,
      resultCode: 'SUCCESS',
    };
  }
}
