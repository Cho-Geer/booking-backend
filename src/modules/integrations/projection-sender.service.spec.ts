/**
 * 投影送信服务单元测试（P0-3 B-4・IF-01・DD-02 §2.4・TC-27/TC-28）
 * - TC-27 受理 200 envelope（success=true && statusCode=200）→ SYNCED + acceptedVersion=data.currentVersion
 *   + syncStatus 回写 'SYNCED'；payload 精确 9 键（键集断言）+ PII/userId/ipAddress/userAgent 零出现；
 *   AppointmentDate=YYYY-MM-DD（UTC）；timeout=3000ms；JWT Bearer 断言（RS256・iss/sub/aud/exp）
 * - TC-28 503 / 超时（ECONNABORTED）/ 401 → 各自 ERROR 且不 throw、syncStatus 回写 'ERROR'，正本无其他写
 * - 409 VERSION_CONFLICT → ERROR 且不改 syncStatus（"实已同步"参考）
 * - token 缓存：连续两次投影仅一次 token 请求（缓存生效）
 * - SF_PROJECTION_ENABLED=false → 无任何 HTTP、返回 no-op（{ eventId:'', syncStatus:'SYNCED' }）
 * - 配置缺失（SF_CLIENT_ID 空）→ ERROR 不 throw
 * @author Booking System
 * @since 2024
 */

import { ProjectionSenderService } from './projection-sender.service';
import { JwtService } from '@nestjs/jwt';
import { of } from 'rxjs';
import { generateKeyPairSync, randomUUID } from 'crypto';

// 私钥读取 mock（A2・JWT Bearer 断言用）
// ts-jest 会提升 jest.mock 至模块顶部（先于 import 执行），工厂内不得引用外层 const/import（TDZ/未定义）；
// 且 resetModules 每次测试重置注册表会重跑工厂。故在工厂内经 globalThis 存留：
// ①同一 jest.fn() 实例（跨 reset 稳定）②模块加载时真生成的 RSA 私钥 PEM（无假 PEM 字面量・L3）。
// restoreMocks 会清 mock 实现，故 beforeEach 重置默认值；globalThis 不受模块注册表重置影响。
jest.mock('fs/promises', () => {
  if (!(globalThis as any).__projectionSpecFsReadFile) {
    // 工厂执行早于 import 绑定，此处用 require（CJS 全局）取 crypto；2048 位仅生成一次并缓存于 globalThis
    const { generateKeyPairSync: genRsaKeyPair } = require('crypto') as typeof import('crypto');
    const privateKeyPem = genRsaKeyPair('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString();
    (globalThis as any).__projectionSpecRsaPrivateKeyPem = privateKeyPem;
    (globalThis as any).__projectionSpecFsReadFile = jest.fn().mockResolvedValue(privateKeyPem);
  }
  return { readFile: (globalThis as any).__projectionSpecFsReadFile };
});

/** 跨 reset 稳定的 fs/promises.readFile mock（工厂存留于 globalThis） */
const getMockFsReadFile = () => (globalThis as any).__projectionSpecFsReadFile as jest.Mock;

/** 模块加载时真生成的 RSA 私钥 PEM（工厂缓存于 globalThis・L3 无假凭据字面量） */
const getMockRsaPrivateKeyPem = () => (globalThis as any).__projectionSpecRsaPrivateKeyPem as string;

const DEFAULT_CONFIG: Record<string, string> = {
  SF_PROJECTION_ENABLED: 'true',
  SF_LOGIN_URL: 'https://login.salesforce.com',
  SF_REST_BASE_URL: 'https://org.my.salesforce.com',
  SF_CLIENT_ID: '3MVG9MOCKCLIENTID',
  SF_USERNAME: 'integration@example.com',
  SF_PRIVATE_KEY_PATH: 'certs/sf-integration-key.pem',
};

/** 模拟 AxiosError 形状（response 存在/不存在两种） */
function axiosLikeError(status: number | undefined, data: unknown, code?: string): Error {
  const err = new Error(`Request failed with status code ${status ?? 'timeout'}`) as Error & {
    response?: { status: number | undefined; data: unknown };
    code?: string;
  };
  if (status !== undefined) {
    err.response = { status, data };
  }
  if (code) {
    err.code = code;
  }
  return err;
}

describe('ProjectionSenderService', () => {
  let config: Record<string, string>;
  const mockConfigService = { get: jest.fn() };
  const mockHttpService = { post: jest.fn() };
  const mockJwtService = { signAsync: jest.fn() };
  const mockPrismaService = {
    appointment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  let service: ProjectionSenderService;

  // 正本数据（含投影所需关联：timeSlot/service）
  const APPOINTMENT = {
    id: 'appt-001',
    appointmentNumber: 'AP-20240115-0001',
    appointmentDate: new Date('2024-01-15T10:00:00.000Z'),
    status: 'PENDING',
    version: 1,
    timeSlot: { slotTime: '09:00:00' },
    service: { name: '标准服务' },
  };

  const TOKEN_RESPONSE = {
    data: { access_token: 'tok-001', expires_in: 3600 },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  };

  const PROJECTION_SUCCESS_RESPONSE = {
    data: { success: true, statusCode: 200, data: { currentVersion: 2 } },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  };

  const PROJECTION_URL = 'https://org.my.salesforce.com/services/apexrest/integrations/bookings/projection';
  const TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';

  const tokenPostCalls = () =>
    mockHttpService.post.mock.calls.filter((c) => (c[0] as string).includes('/services/oauth2/token'));
  const projectionPostCalls = () =>
    mockHttpService.post.mock.calls.filter((c) => (c[0] as string).includes('/services/apexrest/integrations/bookings/projection'));

  beforeEach(() => {
    config = { ...DEFAULT_CONFIG };
    mockConfigService.get.mockImplementation((key: string) => config[key]);
    mockJwtService.signAsync.mockResolvedValue('mock-assertion');
    getMockFsReadFile().mockResolvedValue(getMockRsaPrivateKeyPem()); // restoreMocks 已清实现，此处重置默认值（真生成 PEM）
    mockPrismaService.appointment.findUnique.mockResolvedValue(APPOINTMENT);
    mockPrismaService.appointment.update.mockResolvedValue({ id: 'appt-001' });
    // 默认：token 请求成功 + 投影请求成功（各用例按需覆盖）
    mockHttpService.post.mockImplementation((url: string) => {
      if (url.includes('/services/oauth2/token')) {
        return of(TOKEN_RESPONSE);
      }
      return of(PROJECTION_SUCCESS_RESPONSE);
    });

    service = new ProjectionSenderService(
      mockConfigService as any,
      mockHttpService as any,
      mockJwtService as any,
      mockPrismaService as any,
    );
  });

  describe('TC-27 受理 200 envelope → SYNCED', () => {
    it('HTTP 200 且 success=true/statusCode=200 → SYNCED + acceptedVersion + syncStatus 回写 SYNCED', async () => {
      const result = await service.projectBooking('appt-001');

      expect(result.syncStatus).toBe('SYNCED');
      expect(result.acceptedVersion).toBe(2);
      expect(typeof result.eventId).toBe('string');

      // 投影 POST 一次，URL/headers/timeout 锁死
      expect(projectionPostCalls()).toHaveLength(1);
      const [url, payload, requestConfig] = projectionPostCalls()[0] as [
        string,
        Record<string, unknown>,
        { headers: Record<string, string>; timeout: number },
      ];
      expect(url).toBe(PROJECTION_URL);
      expect(requestConfig.headers).toEqual({
        Authorization: 'Bearer tok-001',
        'Content-Type': 'application/json',
      });
      expect(requestConfig.timeout).toBe(3000);

      // payload 精确 9 键（键集断言，键名大小写按 Apex 冻结）
      expect(Object.keys(payload).sort()).toEqual(
        [
          'AppointmentDate',
          'AppointmentNumber',
          'BookingExternalId',
          'ServiceName',
          'Status',
          'TimeSlot',
          'correlationId',
          'eventId',
          'version',
        ].sort(),
      );

      // PII 5 项 + userId/ipAddress/userAgent 结构性零出现
      for (const forbiddenKey of [
        'customerName',
        'customerPhone',
        'customerEmail',
        'customerWechat',
        'notes',
        'userId',
        'ipAddress',
        'userAgent',
      ]) {
        expect(payload).not.toHaveProperty(forbiddenKey);
      }

      // 字段值：AppointmentDate=YYYY-MM-DD（UTC）、TimeSlot 直送、version 直送
      expect(payload).toEqual({
        BookingExternalId: 'appt-001',
        AppointmentNumber: 'AP-20240115-0001',
        AppointmentDate: '2024-01-15',
        TimeSlot: '09:00:00',
        ServiceName: '标准服务',
        Status: 'PENDING',
        version: 1,
        eventId: result.eventId,
        correlationId: expect.any(String),
      });

      // syncStatus 回写 SYNCED；正本无其他写（findUnique 1 次・update 仅 syncStatus）
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-001' },
        data: { syncStatus: 'SYNCED' },
      });
      expect(mockPrismaService.appointment.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.appointment.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.appointment.findUnique).toHaveBeenCalledWith({
        where: { id: 'appt-001' },
        include: { timeSlot: true, service: true },
      });
    });

    it('JWT Bearer 断言（A2）：RS256・iss/sub/aud（无 exp・由 expiresIn 生成）・secret 私钥・token POST form（grant_type/assertion）', async () => {
      await service.projectBooking('appt-001');

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        {
          iss: '3MVG9MOCKCLIENTID',
          sub: 'integration@example.com',
          aud: 'https://login.salesforce.com',
        },
        {
          algorithm: 'RS256',
          secret: expect.any(String),
          expiresIn: 180,
        },
      );

      const [tokenUrl, formBody] = tokenPostCalls()[0] as [string, string];
      expect(tokenUrl).toBe(TOKEN_URL);
      expect(formBody).toBe(
        'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=mock-assertion',
      );
    });
  });

  describe('TC-28 失败分类 → ERROR 且不 throw', () => {
    it('HTTP 503 → ERROR、不 throw、syncStatus 回写 ERROR', async () => {
      mockHttpService.post.mockImplementation((url: string) => {
        if (url.includes('/services/oauth2/token')) {
          return of(TOKEN_RESPONSE);
        }
        throw axiosLikeError(503, {});
      });

      const result = await service.projectBooking('appt-001');

      expect(result.syncStatus).toBe('ERROR');
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-001' },
        data: { syncStatus: 'ERROR' },
      });
      // 正本无其他写
      expect(mockPrismaService.appointment.update).toHaveBeenCalledTimes(1);
    });

    it('超时（axios rejects ECONNABORTED・无响应）→ ERROR、不 throw、syncStatus 回写 ERROR', async () => {
      mockHttpService.post.mockImplementation((url: string) => {
        if (url.includes('/services/oauth2/token')) {
          return of(TOKEN_RESPONSE);
        }
        throw axiosLikeError(undefined, undefined, 'ECONNABORTED');
      });

      const result = await service.projectBooking('appt-001');

      expect(result.syncStatus).toBe('ERROR');
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-001' },
        data: { syncStatus: 'ERROR' },
      });
    });

    it('HTTP 401 → ERROR、不 throw、syncStatus 回写 ERROR', async () => {
      mockHttpService.post.mockImplementation((url: string) => {
        if (url.includes('/services/oauth2/token')) {
          return of(TOKEN_RESPONSE);
        }
        throw axiosLikeError(401, { message: 'Unauthorized' });
      });

      const result = await service.projectBooking('appt-001');

      expect(result.syncStatus).toBe('ERROR');
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-001' },
        data: { syncStatus: 'ERROR' },
      });
    });

    it('HTTP 200 但 envelope 不合法（success=false）→ ERROR、不 throw、syncStatus 回写 ERROR', async () => {
      mockHttpService.post.mockImplementation((url: string) => {
        if (url.includes('/services/oauth2/token')) {
          return of(TOKEN_RESPONSE);
        }
        return of({
          data: { success: false, statusCode: 400, errors: [{ code: 'BAD_REQUEST' }] },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        });
      });

      const result = await service.projectBooking('appt-001');

      expect(result.syncStatus).toBe('ERROR');
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-001' },
        data: { syncStatus: 'ERROR' },
      });
    });
  });

  describe('409 VERSION_CONFLICT → ERROR 且不改状态', () => {
    it('HTTP 409 + errors[0].code=VERSION_CONFLICT → ERROR、不 throw、syncStatus 不变（无更新调用）', async () => {
      mockHttpService.post.mockImplementation((url: string) => {
        if (url.includes('/services/oauth2/token')) {
          return of(TOKEN_RESPONSE);
        }
        throw axiosLikeError(409, {
          errors: [
            {
              code: 'VERSION_CONFLICT',
              details: { currentVersion: 3, incomingVersion: 2 },
            },
          ],
        });
      });

      const result = await service.projectBooking('appt-001');

      expect(result.syncStatus).toBe('ERROR');
      // 状态不改：无任何 appointment.update（判"实已同步"参考）
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });
  });

  describe('token 缓存', () => {
    it('连续两次投影仅一次 token 请求（缓存生效）', async () => {
      await service.projectBooking('appt-001');
      await service.projectBooking('appt-001');

      expect(tokenPostCalls()).toHaveLength(1);
      expect(projectionPostCalls()).toHaveLength(2);
      // 两次均成功受理
      expect(mockPrismaService.appointment.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('开关与配置', () => {
    it('SF_PROJECTION_ENABLED=false → 无任何 HTTP、返回 no-op（不改 syncStatus）', async () => {
      config.SF_PROJECTION_ENABLED = 'false';

      const result = await service.projectBooking('appt-001');

      expect(result).toEqual({ eventId: '', syncStatus: 'SYNCED' });
      expect(mockHttpService.post).not.toHaveBeenCalled();
      expect(mockPrismaService.appointment.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });

    it('配置缺失（SF_CLIENT_ID 空）→ ERROR 不 throw、无 HTTP、syncStatus 回写 ERROR', async () => {
      config.SF_CLIENT_ID = '';

      const result = await service.projectBooking('appt-001');

      expect(result.syncStatus).toBe('ERROR');
      expect(mockHttpService.post).not.toHaveBeenCalled();
      expect(mockPrismaService.appointment.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-001' },
        data: { syncStatus: 'ERROR' },
      });
    });
  });

  describe('回归：真实 JwtService（不 mock・D-1 缺陷防逃逸）', () => {
    it('真实 signAsync 生成 RS256 断言：公钥可验证、payload 无显式 exp、exp - iat === 180（覆盖全局 15m）', async () => {
      // 测试内生成 RSA 密钥对（PEM）
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // fs/promises readFile 返回生成的私钥（投影服务经 SF_PRIVATE_KEY_PATH 读取；globalThis 存留同一 mock 实例）
      getMockFsReadFile().mockResolvedValue(privateKey);

      // 真实 JwtService，模拟 app.module 全局注册形态（模块级 secret + signOptions.expiresIn '15m'）
      // 若实装误用 privateKey 选项/漏 expiresIn，此测试即红（D-1 无法再逃逸）
      // secret 语义仅需"非空且不等于 RSA 私钥"以模拟全局 HS secret（值无意义），用运行期随机避免硬编码凭据（L3）
      const realJwtService = new JwtService({
        secret: randomUUID(),
        signOptions: { expiresIn: '15m' },
      });

      let capturedFormBody = '';
      const captureHttp = {
        post: jest.fn((url: string, data: unknown) => {
          if (url.includes('/services/oauth2/token')) {
            capturedFormBody = data as string;
            return of(TOKEN_RESPONSE);
          }
          return of(PROJECTION_SUCCESS_RESPONSE);
        }),
      };

      const realService = new ProjectionSenderService(
        mockConfigService as any,
        captureHttp as any,
        realJwtService as any,
        mockPrismaService as any,
      );

      const result = await realService.projectBooking('appt-001');
      expect(result.syncStatus).toBe('SYNCED');

      // token POST 携带的 assertion
      const assertion = new URLSearchParams(capturedFormBody).get('assertion') ?? '';
      expect(assertion).not.toBe('');

      // 用公钥验证：证明断言确实用私钥 RS256 签名（而非模块级 HS secret 或全局 15m 期限）
      const verified = await realJwtService.verifyAsync(assertion, {
        secret: publicKey,
        algorithms: ['RS256'],
      });
      expect(verified.iss).toBe('3MVG9MOCKCLIENTID');
      expect(verified.sub).toBe('integration@example.com');
      expect(verified.aud).toBe('https://login.salesforce.com');

      // payload 无显式 exp（由 expiresIn 生成），且 exp - iat === 180（等价冻结语义"exp+180"）
      const decoded = realJwtService.decode(assertion) as {
        iss: string;
        sub: string;
        aud: string;
        iat: number;
        exp: number;
      };
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp - decoded.iat).toBe(180);
    });
  });
});
