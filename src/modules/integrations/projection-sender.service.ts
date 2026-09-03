/**
 * 投影送信服务（P0-3 B-4・IF-01・DD-02 §2.4・C-4・3000ms）
 *
 * 职责：bookings 正本三条变更流（create/update/cancel・RULE-08）与命令/级联取消
 * 在正本写入（version 递增 + syncStatus=PENDING）完成后，将投影载荷同步发送至
 * Salesforce 侧 Apex REST 端点（IF-01），成功回写 syncStatus=SYNCED。
 *
 * 契约要点：
 * - 入口方法 projectBooking 整体 try/catch，任何失败仅记分类日志 + syncStatus=ERROR，
 *   绝不 throw（双层防御：正本钩子处另有 try/catch，C-4 投影失败不影响正本应答）。
 * - OAuth 2.0 JWT Bearer（A2）：RS256 断言 → /services/oauth2/token → access_token
 *   内存缓存至到期前 60s（并发下重复获取可接受，不加锁）。
 * - 白名单 9 键载荷，PII（customerName/customerPhone/customerEmail/customerWechat/notes）
 *   与 userId/ipAddress/userAgent 结构性不出现。
 * - 投影 POST 与 token POST 均 3000ms 超时。
 * - SF_PROJECTION_ENABLED !== 'true' 时为 no-op（dev 用，不做任何 HTTP 与 syncStatus 更新）；
 *   正本钩子（version/PENDING）不受开关影响（调用方已写）。
 * @author Booking System
 * @since 2024
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';

/** 投影结果（DD-02 §2.4）：syncStatus 仅 SYNCED / ERROR 两态（禁止自创第三状态） */
export interface ProjectionResult {
  eventId: string;
  acceptedVersion?: number;
  syncStatus: 'SYNCED' | 'ERROR';
}

/** 白名单载荷：键名大小写按 Apex ProjectionRequest/validateRequest 冻结，严格直送 */
interface ProjectionPayload {
  BookingExternalId: string;
  AppointmentNumber: string;
  AppointmentDate: string;
  TimeSlot: string | null;
  ServiceName: string;
  Status: string;
  version: number;
  eventId: string;
  correlationId: string;
}

/** 投影 Apex REST 端点（固定路径） */
const PROJECTION_ENDPOINT_PATH = '/services/apexrest/integrations/bookings/projection';
/** OAuth2 token 端点（相对 SF_LOGIN_URL） */
const TOKEN_ENDPOINT_PATH = '/services/oauth2/token';
/** 投影 POST 与 token POST 超时（C-4・3000ms） */
const REQUEST_TIMEOUT_MS = 3000;
/** access_token 到期前提前刷新窗口（秒） */
const TOKEN_REFRESH_LEAD_SECONDS = 60;
/** JWT 断言有效期（秒） */
const ASSERTION_TTL_SECONDS = 180;
/** token 默认有效期（秒），响应未给 expires_in 时使用 */
const DEFAULT_TOKEN_TTL_SECONDS = 3600;

@Injectable()
export class ProjectionSenderService {
  private readonly logger = new Logger(ProjectionSenderService.name);
  /** access_token 内存缓存（expiresAt 为过期时间戳毫秒） */
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 投影送信入口：正本写入完成后调用（同步呼出・C-4）。
   * - SF_PROJECTION_ENABLED !== 'true' 时为 no-op（dev 用）：直接返回
   *   { eventId: '', syncStatus: 'SYNCED' }，不做任何 HTTP 与 syncStatus 更新。
   * - 整体 try/catch，任何失败仅记分类日志 + syncStatus=ERROR，绝不 throw。
   * @param appointmentId 正本预约 id
   * @returns 投影结果（eventId / acceptedVersion / syncStatus）
   */
  async projectBooking(appointmentId: string): Promise<ProjectionResult> {
    const eventId = randomUUID();

    try {
      // 开关语义（已钉死）：关闭 = 跳过发送且不改 syncStatus（no-op・dev 用）
      const enabled = this.configService.get<string>('SF_PROJECTION_ENABLED');
      if (enabled !== 'true') {
        this.logger.debug(
          `投影送信已禁用（SF_PROJECTION_ENABLED=${enabled ?? '(未设置)'}），跳过发送（no-op・dev 用）appointmentId=${appointmentId}`,
        );
        return { eventId: '', syncStatus: 'SYNCED' };
      }

      // 配置缺失（如无 SF_CLIENT_ID）→ ERROR（AUTH 类日志）+ syncStatus=ERROR，不 throw
      const clientId = this.configService.get<string>('SF_CLIENT_ID');
      const username = this.configService.get<string>('SF_USERNAME');
      const loginUrl = this.configService.get<string>('SF_LOGIN_URL');
      const restBaseUrl = this.configService.get<string>('SF_REST_BASE_URL');
      const privateKeyPath = this.configService.get<string>('SF_PRIVATE_KEY_PATH');
      if (!clientId || !username || !loginUrl || !restBaseUrl || !privateKeyPath) {
        this.logger.error(
          `投影送信配置缺失（SF_CLIENT_ID=${clientId ? 'set' : 'MISSING'}, SF_USERNAME=${username ? 'set' : 'MISSING'}, SF_LOGIN_URL=${loginUrl ? 'set' : 'MISSING'}, SF_REST_BASE_URL=${restBaseUrl ? 'set' : 'MISSING'}, SF_PRIVATE_KEY_PATH=${privateKeyPath ? 'set' : 'MISSING'}）`,
          { category: 'AUTH', eventId, appointmentId },
        );
        await this.updateSyncStatus(appointmentId, 'ERROR');
        return { eventId, syncStatus: 'ERROR' };
      }

      // 正本读取（含投影所需关联）
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { timeSlot: true, service: true },
      });
      if (!appointment) {
        // 理论不可达：正本钩子在正本写入完成后才调用
        this.logger.warn(`投影送信：预约不存在（理论不可达）appointmentId=${appointmentId}`, {
          category: 'UNKNOWN',
          eventId,
        });
        await this.updateSyncStatus(appointmentId, 'ERROR');
        return { eventId, syncStatus: 'ERROR' };
      }

      const correlationId = randomUUID();
      const payload = this.buildPayload(appointment, eventId, correlationId);

      // OAuth JWT Bearer 获取 access_token（失败 → AUTH 类 ERROR）
      // 既定取舍（HP 认可）：token 一切失败（读钥/签名/网络/token 端点非 2xx）统一记 AUTH——本路径失败根因
      // 均为凭据/密钥/端点配置问题（与投影 POST 的四类分类无关），不按 AxiosError.response?.status 细分 TMP。
      let accessToken: string;
      try {
        accessToken = await this.getAccessToken();
      } catch (tokenError) {
        this.logger.error(
          `投影送信：获取 access_token 失败 appointmentId=${appointmentId}`,
          {
            category: 'AUTH',
            eventId,
            error: tokenError instanceof Error ? tokenError.message : String(tokenError),
          },
        );
        await this.updateSyncStatus(appointmentId, 'ERROR');
        return { eventId, syncStatus: 'ERROR' };
      }

      // 投影 POST（3000ms 超时）
      try {
        const response = await firstValueFrom(
          this.httpService.post(`${restBaseUrl}${PROJECTION_ENDPOINT_PATH}`, payload, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: REQUEST_TIMEOUT_MS,
          }),
        );

        const body = response.data;
        // 受理判定（HP 契约）：HTTP 200 且 envelope success=true && statusCode=200
        if (
          response.status === 200 &&
          body &&
          body.success === true &&
          body.statusCode === 200
        ) {
          const acceptedVersion = body.data?.currentVersion;
          this.logger.log(
            `投影送信成功 appointmentId=${appointmentId} eventId=${eventId} acceptedVersion=${acceptedVersion ?? 'N/A'}`,
          );
          await this.updateSyncStatus(appointmentId, 'SYNCED');
          return { eventId, acceptedVersion, syncStatus: 'SYNCED' };
        }

        // HTTP 200 但 envelope 不满足 → 未知响应 → ERROR
        this.logger.error(
          `投影送信：HTTP 200 但响应 envelope 异常（success/statusCode 不符）appointmentId=${appointmentId}`,
          { category: 'UNKNOWN', eventId, appointmentId },
        );
        await this.updateSyncStatus(appointmentId, 'ERROR');
        return { eventId, syncStatus: 'ERROR' };
      } catch (projectionError) {
        return await this.classifyProjectionError(projectionError, appointmentId, eventId);
      }
    } catch (error) {
      // 兜底：任何未分类失败 → ERROR + syncStatus=ERROR，绝不 throw
      this.logger.error(`投影送信失败（未分类）appointmentId=${appointmentId}`, {
        category: 'UNKNOWN',
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.updateSyncStatus(appointmentId, 'ERROR');
      return { eventId, syncStatus: 'ERROR' };
    }
  }

  /**
   * 白名单 9 键载荷（键名大小写按 Apex ProjectionRequest/validateRequest 冻结）：
   * BookingExternalId / AppointmentNumber / AppointmentDate(YYYY-MM-DD・UTC) / TimeSlot /
   * ServiceName / Status / version / eventId / correlationId。
   * PII 5 项（customerName/customerPhone/customerEmail/customerWechat/notes）+
   * userId/ipAddress/userAgent 结构性不出现。
   */
  private buildPayload(
    appointment: {
      id: string;
      appointmentNumber: string;
      appointmentDate: Date;
      status: string;
      version: number;
      timeSlot?: { slotTime: string } | null;
      service?: { name: string } | null;
    },
    eventId: string,
    correlationId: string,
  ): ProjectionPayload {
    return {
      BookingExternalId: appointment.id,
      AppointmentNumber: appointment.appointmentNumber,
      AppointmentDate: appointment.appointmentDate.toISOString().slice(0, 10),
      TimeSlot: appointment.timeSlot ? appointment.timeSlot.slotTime : null,
      ServiceName: appointment.service?.name ?? '',
      Status: appointment.status,
      version: appointment.version,
      eventId,
      correlationId,
    };
  }

  /**
   * OAuth 2.0 JWT Bearer（A2）获取 access_token：
   * 读 SF_PRIVATE_KEY_PATH（fs/promises readFile，相对 launch 目录解析）→ RS256 断言签名 →
   * POST ${SF_LOGIN_URL}/services/oauth2/token（form，3000ms）→ 内存缓存至到期前 60s。
   * 任何失败抛错（由调用方归类 AUTH 处理）；并发下重复获取可接受（不加锁）。
   */
  private async getAccessToken(): Promise<string> {
    // 缓存命中（到期前 60s 内有效）
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - TOKEN_REFRESH_LEAD_SECONDS * 1000) {
      return this.tokenCache.token;
    }

    const loginUrl = this.configService.get<string>('SF_LOGIN_URL') as string;
    const clientId = this.configService.get<string>('SF_CLIENT_ID') as string;
    const username = this.configService.get<string>('SF_USERNAME') as string;
    const privateKeyPath = this.configService.get<string>('SF_PRIVATE_KEY_PATH') as string;

    // 私钥读取（相对 launch 目录解析失败即 ERROR）
    let privateKey: string;
    try {
      privateKey = await readFile(privateKeyPath, 'utf8');
    } catch (readError) {
      throw new Error(
        `SF_PRIVATE_KEY_PATH 读取失败：${readError instanceof Error ? readError.message : String(readError)}`,
      );
    }

    // RS256 断言（iss/sub/aud；exp 由 expiresIn 生成 = iat+180，与冻结语义"exp+180"等价）
    // 注意（HP 双因子 probe 实证）：payload 不得放 exp（与 options.expiresIn 并存直接抛 "Bad options.expiresIn"）；
    // 必须用 options.secret 而非 privateKey——@nestjs/jwt getSecretKey 解析序 options.secret > 全局 secret > privateKey，
    // app.module 全局 JwtModule 已注入 JWT_SECRET（恒真值），privateKey 永远轮不到且 RS256 下必抛；
    // 必须显式 expiresIn 覆盖全局 '15m'（expiresIn: undefined 会被 @nestjs/jwt 自身校验拒绝）。
    const assertion = await this.jwtService.signAsync(
      {
        iss: clientId,
        sub: username,
        aud: loginUrl,
      },
      {
        algorithm: 'RS256',
        secret: privateKey,
        expiresIn: ASSERTION_TTL_SECONDS,
      },
    );

    // token 端点（form 请求）
    const formBody = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString();

    const response = await firstValueFrom(
      this.httpService.post(`${loginUrl}${TOKEN_ENDPOINT_PATH}`, formBody, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: REQUEST_TIMEOUT_MS,
      }),
    );

    const accessToken = response.data?.access_token;
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new Error('OAuth token 响应缺少 access_token');
    }

    const expiresIn =
      typeof response.data?.expires_in === 'number' && response.data.expires_in > 0
        ? response.data.expires_in
        : DEFAULT_TOKEN_TTL_SECONDS;
    this.tokenCache = { token: accessToken, expiresAt: Date.now() + expiresIn * 1000 };

    return accessToken;
  }

  /**
   * 投影 POST 失败分类（四类）：
   * - VERSION（409 + errors[0].code === 'VERSION_CONFLICT'）：实已同步参考，不改 syncStatus
   * - AUTH（401/403）
   * - TMP（503 / 超时 ECONNABORTED / 网络错误无响应）
   * - UNKNOWN（其余一切：400/404/500/未知 JSON 等）
   * 除 VERSION 外均回写 syncStatus=ERROR。绝不 throw。
   */
  private async classifyProjectionError(
    error: unknown,
    appointmentId: string,
    eventId: string,
  ): Promise<ProjectionResult> {
    const axiosError = error as AxiosError;
    const status = axiosError?.response?.status;
    const body = axiosError?.response?.data as
      | {
          errors?: Array<{ code?: string; details?: { currentVersion?: number; incomingVersion?: number } }>;
          data?: { currentVersion?: number };
        }
      | undefined;

    // VERSION_CONFLICT（409）：判定"实已同步"参考，不改状态
    if (status === 409 && body?.errors?.[0]?.code === 'VERSION_CONFLICT') {
      this.logger.error(`投影送信：版本冲突（VERSION_CONFLICT・409）appointmentId=${appointmentId}`, {
        category: 'VERSION',
        eventId,
        appointmentId,
        details: {
          currentVersion:
            body.data?.currentVersion ?? body.errors?.[0]?.details?.currentVersion ?? null,
          incomingVersion: body.errors?.[0]?.details?.incomingVersion ?? null,
          eventId,
        },
      });
      return { eventId, syncStatus: 'ERROR' };
    }

    if (status === 401 || status === 403) {
      this.logger.error(`投影送信：认证失败（AUTH・${status}）appointmentId=${appointmentId}`, {
        category: 'AUTH',
        eventId,
        appointmentId,
        status,
      });
    } else if (status === 503 || status === undefined) {
      // TMP：503 / 超时（ECONNABORTED）/ 网络错误（无 HTTP 响应）
      this.logger.error(`投影送信：临时失败（TMP・${status ?? '无响应'}）appointmentId=${appointmentId}`, {
        category: 'TMP',
        eventId,
        appointmentId,
        status,
        code: axiosError?.code ?? null,
      });
    } else {
      this.logger.error(`投影送信：未知失败（UNKNOWN・${status}）appointmentId=${appointmentId}`, {
        category: 'UNKNOWN',
        eventId,
        appointmentId,
        status,
      });
    }

    await this.updateSyncStatus(appointmentId, 'ERROR');
    return { eventId, syncStatus: 'ERROR' };
  }

  /**
   * 独立回写 syncStatus（自身 try/catch，绝不抛）。
   * 仅更新 syncStatus 字段，不触碰 version 等正本字段（"正本无其他写"）。
   */
  private async updateSyncStatus(
    appointmentId: string,
    syncStatus: 'SYNCED' | 'ERROR',
  ): Promise<void> {
    try {
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { syncStatus },
      });
    } catch (error) {
      this.logger.error(
        `投影送信：syncStatus 写回失败 appointmentId=${appointmentId} syncStatus=${syncStatus}`,
        error,
      );
    }
  }
}
