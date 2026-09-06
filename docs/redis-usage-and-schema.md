# Redis の使い方と格納スキーマ（booking-backend）

## ドキュメント情報

- **タイトル**: Redis の使い方と格納スキーマ（接続方法・用途・キースキーマ・コード根拠）
- **目的**: booking-backend における Redis の接続方法・実際に使われているキー schema・用途ごとの詳細（トークンブラックリスト / SMS 検証コード / ヘルスチェック）を、コード根拠付きで整理する。
- **関連文書**: [README.md](./README.md)（ドキュメント一覧）

---

## 1. Redis への接続方法

`app.module.ts` で `@nestjs/cache-manager` の `CacheModule` を `redisStore`（`cache-manager-redis-store`）でグローバル登録している。

```typescript
// src/app.module.ts L44-L56
CacheModule.registerAsync({
  isGlobal: true,
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    store: redisStore as any,
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get('REDIS_PORT', 6379),
    password: configService.get('REDIS_PASSWORD', ''),
    ttl: Number(configService.get('REDIS_TTL', 3600)), // デフォルト TTL（1時間）
    max: 1000, // 最大キャッシュ件数
  }),
  inject: [ConfigService],
})
```

各クラスは `@Inject(CACHE_MANAGER)` で `Cache` を注入して使う。

---

## 2. 格納スキーマ（実装ベース）

実際に使われているキーは**以下の 3 種類（4 パターン）のみ**。

| キー | 値 | TTL | 用途 | コード根拠 |
|---|---|---|---|---|
| `blacklist:{sha256(accessToken)}` | `1` | トークン残り有効期限 | **ログアウトしたアクセストークンの失効** | set: `auth.service.ts` L341-L342 / get: `jwt-auth.guard.ts` L110-L115 |
| `blacklist:{sha256(refreshToken)}` | `1` | トークン残り有効期限 | **リフレッシュトークンの失効** | set: `auth.service.ts` L310-L311 / `users.service.ts` L286 / get: `auth.service.ts` L173 |
| `verification_code:{phoneNumber}` | 6桁コード（文字列） | **300 秒（5分）** | **SMS 認証コード**（使い捨て） | set: `auth.service.ts` L552 / get+del: `auth.service.ts` L518, L529 |
| `health:redis:{Date.now()}` | `'ok'` | 5 秒 | **ヘルスチェックの疎通確認** | `health.service.ts` L55-L64 |

---

## 3. 用途ごとの詳細

### ① トークンブラックリスト（ログアウト失効）※主要用途

JWT はステートレスなので「ログアウトしてもトークンは使えてしまう」問題を、**トークンの SHA-256 ハッシュを Redis に載せて失効扱い**にする方式。

```typescript
// ログアウト時（auth.service.ts L341-L342）
const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
await this.cacheManager.set(`blacklist:${tokenHash}`, 1, ttl * 1000);
//                                     ↑キー          ↑値 ↑TTL=トークン残り有効期限

// 認証時（jwt-auth.guard.ts L110-L115）
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const isBlacklisted = await this.cacheManager.get(`blacklist:${tokenHash}`);
if (isBlacklisted) throw new AuthenticationException('访问令牌已被吊销');
```

TTL を**トークンの残り有効期限**に合わせることで、有効期限が切れたら自動削除され、Redis が膨張しない。

#### ブラックリストとのやり取りタイミング（全 4 箇所）

| # | タイミング | 操作 | トリガー | コード根拠 |
|---|---|---|---|---|
| 1 | **ログアウト実行時** | `set` ×2（refresh + access） | `POST /v1/auth/logout` → `AuthService.logout()` | [auth.service.ts L273-L278](../src/modules/auth/auth.service.ts)（logout → addRefreshTokenToBlacklist L292 / addAccessTokenToBlacklist L323） |
| 2 | **ユーザー無効化時（ADMIN 操作）** | `set` ×N（そのユーザーの全アクティブセッションの refresh トークン） | `PATCH /v1/users/:id/status` で ACTIVE→非 ACTIVE へ変更 → `UsersService.toggleUserStatus()` のトランザクション内 | [users.service.ts L240 / L266-L296](../src/modules/users/users.service.ts)（`tx.userSession.findMany` L270 → 各 `blacklist:${refreshTokenHash}` を set L286 → セッションを `isActive: false` に L292-L295） |
| 3 | **アクセストークン検証時（毎リクエスト）** | `get` | 全ルート共通のグローバル Guard で `verifyToken()` 実行時 | [jwt-auth.guard.ts L107-L115](../src/common/guards/jwt-auth.guard.ts)（`blacklist:${tokenHash}` を get L111 → ヒットなら `AuthenticationException` L115） |
| 4 | **リフレッシュトークン使用時** | `get` | `POST /v1/auth/refresh` → `AuthService.refreshToken()` 冒頭 | [auth.service.ts L169-L177](../src/modules/auth/auth.service.ts)（`blacklist:${tokenHash}` を get L173 → ヒットなら `AuthenticationException('刷新令牌已被吊销')` L176） |

**ライフサイクルの流れ**:

```
[ログイン] → トークン発行（Redis 未使用）
     │
[ログアウト ①] ──set──▶ blacklist:{hash} = 1（TTL=残り有効期限）
     │                      │
[以降のリクエスト ③] ──get──▶ ヒット → 401 拒否
[トークン再発行 ④]  ──get──▶ ヒット → 401 拒否（リフレッシュ不可）
     │
[TTL 到達] → Redis が自動削除（期限切れトークンのブラックリストは自然に消える）
```

※ 管理者によるユーザー無効化 ② では、対象ユーザーの**全アクティブセッションのリフレッシュトークン**を一括でブラックリスト化し、DB 側も `userSession.isActive = false` に更新（二重の無効化）。

### ② SMS 検証コード（5分で期限切れ・使い捨て）

```typescript
// 保存（auth.service.ts L547-L552）
const key = `verification_code:${phoneNumber}`;
await this.cacheManager.set(key, verificationCode, 300 * 1000);  // 5分

// 検証（L513-L529）: get → 一致確認 → del（使い捨て）
const storedCode = await this.cacheManager.get<string>(key);
if (storedCode !== verificationCode) throw ...;
await this.cacheManager.del(key);  // 再使用防止
```

### ③ ヘルスチェックプローブ

```typescript
// health.service.ts L54-L64: set → get の往復で疎通確認
const key = `health:redis:${Date.now()}`;
await this.cacheManager.set(key, 'ok', 5_000);
const value = await this.cacheManager.get<string>(key);
if (value !== 'ok') throw new Error('Redis round-trip verification failed');
```

---

## 4. 注意：規約（プロジェクト内コーディング規約・リポジトリ外管理）との乖離

かつて参照していたプロジェクト内コーディング規約（リポジトリ外管理のため本リポジトリには存在しない）には、以下のキャッシュ設計が記載されていたが、**実装には存在しない**。

| 規約記載のキー | TTL | 実装状況 |
|---|---|---|
| `session:{userId}`（JWT セッション） | 7 日 | ❌ 未実装 |
| `slot:availability:{slotId}`（時間枠可用性） | 30 分 | ❌ 未実装 |
| `slot:{slotId}:remaining`（残枠カウンタ） | 動的 | ❌ 未実装 |

**実際に Redis を使っているのは「ブラックリスト」「検証コード」「ヘルスチェック」の 3 用途のみ**で、規約のキャッシュ設計（セッション・時間枠キャッシュ）は未導入。

---

## 5. 参照コード（ファイル）

| ファイル | 役割 |
|---|---|
| `src/app.module.ts` | Redis（CacheModule）接続設定（L44-L56） |
| `src/modules/auth/auth.service.ts` | ブラックリスト書込・検証コード保存/検証・リフレッシュ時ブラックリスト確認 |
| `src/common/guards/jwt-auth.guard.ts` | 認証時のブラックリスト確認 |
| `src/modules/users/users.service.ts` | 全セッション無効化時のリフレッシュトークンブラックリスト追加 |
| `src/common/health/health.service.ts` | Redis 疎通確認（ヘルスチェック） |

## 検証コマンド（実行済みコマンドと実出力）

実行ディレクトリ: `booking-backend` リポジトリルート。

```
検証コマンド: grep -n "CacheModule.registerAsync\|redisStore\|isGlobal: true" src/app.module.ts
7:import { redisStore } from 'cache-manager-redis-store';
32:      isGlobal: true,
44:    CacheModule.registerAsync({
45:      isGlobal: true,
48:        store: redisStore as any,
検証コマンド: grep -n "blacklist:\|cacheManager.set(\`blacklist\|cacheManager.get(\`blacklist" src/common/guards/jwt-auth.guard.ts src/modules/auth/auth.service.ts src/modules/users/users.service.ts
src/common/guards/jwt-auth.guard.ts:111:      const isBlacklisted = await this.cacheManager.get(`blacklist:${tokenHash}`);
src/modules/auth/auth.service.ts:173:      const isBlacklisted = await this.cacheManager.get(`blacklist:${tokenHash}`);
src/modules/auth/auth.service.ts:311:        await this.cacheManager.set(`blacklist:${tokenHash}`, 1, ttl * 1000);
src/modules/auth/auth.service.ts:342:        await this.cacheManager.set(`blacklist:${tokenHash}`, 1, ttl * 1000);
src/modules/users/users.service.ts:286:              await this.cacheManager.set(`blacklist:${refreshTokenHash}`, 1, refreshTtl);
検証コマンド: grep -n "verification_code:\|300 \* 1000\|cacheManager.set(key\|cacheManager.get<string>(key)\|cacheManager.del(key)" src/modules/auth/auth.service.ts
517:    const key = `verification_code:${phoneNumber}`;
518:    const storedCode = await this.cacheManager.get<string>(key);
529:    await this.cacheManager.del(key);
548:    const key = `verification_code:${phoneNumber}`;
552:    await this.cacheManager.set(key, verificationCode, 300 * 1000);
検証コマンド: grep -n "health:redis\|cacheManager.set(key, 'ok'\|cacheManager.get<string>(key)\|Redis round-trip" src/common/health/health.service.ts
55:    const key = `health:redis:${Date.now()}`;
59:      await this.cacheManager.set(key, 'ok', 5_000);
60:      const value = await this.cacheManager.get<string>(key);
64:        throw new Error('Redis round-trip verification failed');
検証コマンド: grep -n "sha256\|createHash" src/modules/auth/auth.service.ts src/common/guards/jwt-auth.guard.ts | head -8
src/modules/auth/auth.service.ts:172:      const tokenHash = crypto.createHash('sha256').update(refreshTokenDto.refreshToken).digest('hex');
src/modules/auth/auth.service.ts:310:        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
src/modules/auth/auth.service.ts:341:        const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
src/common/guards/jwt-auth.guard.ts:110:      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
検証コマンド: grep -n "toggleUserStatus\|userSession.findMany\|isActive: false\|refreshTtl" src/modules/users/users.service.ts | head -6
240:  async toggleUserStatus(id: string, status: UserStatus): Promise<UserResponseDto> {
270:        const activeSessions = await tx.userSession.findMany({
283:            const refreshTtl = session.refreshExpiresAt.getTime() - Date.now();
284:            if (refreshTtl > 0) {
286:              await this.cacheManager.set(`blacklist:${refreshTokenHash}`, 1, refreshTtl);
294:            data: { isActive: false },
検証コマンド: grep -n "private async checkRedis\|async logout\|addRefreshTokenToBlacklist(refreshToken)\|addAccessTokenToBlacklist(accessToken)" src/common/health/health.service.ts src/modules/auth/auth.service.ts
src/common/health/health.service.ts:54:  private async checkRedis() {
src/modules/auth/auth.service.ts:273:  async logout(userId: string, refreshToken: string, accessToken: string): Promise<ApiResponseDto<void>> {
src/modules/auth/auth.service.ts:276:      await this.addRefreshTokenToBlacklist(refreshToken);
src/modules/auth/auth.service.ts:278:      await this.addAccessTokenToBlacklist(accessToken);
```
