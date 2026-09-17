# Redis の使い方と格納スキーマ（booking-backend）

## ドキュメント情報

- **タイトル**: Redis の使い方と格納スキーマ（接続方法・用途・キースキーマ・コード根拠）
- **目的**: booking-backend における Redis の接続方法・実際に使われているキー schema・用途ごとの詳細（トークンブラックリスト / メール認証コード / ヘルスチェック）を、コード根拠付きで整理する。
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

実際に使われているキーは**以下の 5 種類（6 パターン）のみ**。

| キー | 値 | TTL | 用途 | コード根拠 |
|---|---|---|---|---|
| `blacklist:{sha256(accessToken)}` | `1` | トークン残り有効期限 | **ログアウトしたアクセストークンの失効** | set: `auth.service.ts` L418 / get: `jwt-auth.guard.ts` L111 |
| `blacklist:{sha256(refreshToken)}` | `1` | トークン残り有効期限 | **リフレッシュトークンの失効** | set: `auth.service.ts` L387 / `users.service.ts` L303 / get: `auth.service.ts` L190 |
| `verification_code:{type}:{phoneNumber}` | 6桁コード（素の文字列） | **300 秒（5分）** | **メール認証コード**（使い捨て・type スコープ） | set: `auth.service.ts` L675 / get+del: `auth.service.ts` L620, L646 |
| `verification_code:attempts:{type}:{phoneNumber}` | 误输入回数（数値） | **300 秒（5分）** | **認証コードの総当たり抑止カウンタ**（上限 5 回でコードを失効） | set: `auth.service.ts` L641 / get: `auth.service.ts` L628 / del: `auth.service.ts` L634, L647 |
| `verification_code:cooldown:{type}:{phoneNumber}` | `1` | **60 秒** | **宛先別の再送クールダウン**（連投抑止） | set: `auth.service.ts` L297 / get: `auth.service.ts` L247 |
| `health:redis:{Date.now()}` | `'ok'` | 5 秒 | **ヘルスチェックの疎通確認** | `health.service.ts` L55-L64 |

---

## 3. 用途ごとの詳細

### ① トークンブラックリスト（ログアウト失効）※主要用途

JWT はステートレスなので「ログアウトしてもトークンは使えてしまう」問題を、**トークンの SHA-256 ハッシュを Redis に載せて失効扱い**にする方式。

```typescript
// ログアウト時（auth.service.ts L418）
const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
await this.cacheManager.set(`blacklist:${tokenHash}`, 1, ttl * 1000);
//                                     ↑キー          ↑値 ↑TTL=トークン残り有効期限

// 認証時（jwt-auth.guard.ts L111-L114）
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const isBlacklisted = await this.cacheManager.get(`blacklist:${tokenHash}`);
if (isBlacklisted) throw new AuthenticationException('访问令牌已被吊销');
```

TTL を**トークンの残り有効期限**に合わせることで、有効期限が切れたら自動削除され、Redis が膨張しない。

#### ブラックリストとのやり取りタイミング（全 4 箇所）

| # | タイミング | 操作 | トリガー | コード根拠 |
|---|---|---|---|---|
| 1 | **ログアウト実行時** | `set` ×2（refresh + access） | `POST /v1/auth/logout` → `AuthService.logout()` | [auth.service.ts L349-L354](../src/modules/auth/auth.service.ts)（logout → addRefreshTokenToBlacklist L368 / addAccessTokenToBlacklist L399） |
| 2 | **ユーザー無効化時（ADMIN 操作）** | `set` ×N（そのユーザーの全アクティブセッションの refresh トークン） | `PATCH /v1/users/:id/status` で ACTIVE→非 ACTIVE へ変更 → `UsersService.toggleUserStatus()` のトランザクション内 | [users.service.ts L257 / L287-L311](../src/modules/users/users.service.ts)（`tx.userSession.findMany` L287 → 各 `blacklist:${refreshTokenHash}` を set L303 → セッションを `isActive: false` に L311） |
| 3 | **アクセストークン検証時（毎リクエスト）** | `get` | 全ルート共通のグローバル Guard で `verifyToken()` 実行時 | [jwt-auth.guard.ts L110-L114](../src/common/guards/jwt-auth.guard.ts)（`blacklist:${tokenHash}` を get L111 → ヒットなら `AuthenticationException` L114） |
| 4 | **リフレッシュトークン使用時** | `get` | `POST /v1/auth/refresh` → `AuthService.refreshToken()` 冒頭 | [auth.service.ts L189-L193](../src/modules/auth/auth.service.ts)（`blacklist:${tokenHash}` を get L190 → ヒットなら `AuthenticationException('刷新令牌已被吊销')` L193） |

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

### ② メール認証コード（5分で期限切れ・使い捨て・type スコープ）

認証コードは**メール送信**で配送される（旧 SMS 想定は廃止）。キーは用途（`login` / `register`）ごとに
分離するため `verification_code:{type}:{phoneNumber}` の形式をとる。値は**素の 6 桁文字列**。

```typescript
// 発码（auth.service.ts L273-L297）: コード生成 → メール送信 → Redis 保存 → クールダウン
//   メール送信に失敗した場合は throw して中断（Redis には保存されない）L280-L291
const key = `verification_code:${type}:${phoneNumber}`;
await this.cacheManager.set(key, verificationCode, VERIFICATION_CODE_TTL_MS);  // 5分 (L675)
// 送信成功時のみクールダウン（60秒）を設定 (L297)
await this.cacheManager.set(`verification_code:cooldown:${type}:${phoneNumber}`, 1, 60 * 1000);

// 検証（L613-L650）: get → 一致確認 → del（使い捨て）
const storedCode = await this.cacheManager.get<string>(key);
if (storedCode !== verificationCode) {
  // 误输入回数を get→set の read-modify-write で加算（上限 5 回でコードを削除）
  ...
}
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

**実際に Redis を使っているのは「ブラックリスト」「検証コード」「ヘルスチェック」の 3 用途のみ**で、規約のキャッシュ設計（セッション・時間枠キャッシュ）は未導入。検証コードは用途（type）スコープ・再送クールダウン・誤入力カウンタを含めると 3 種類のキーを占める（キー総数は 5 種類）。

---

## 5. 参照コード（ファイル）

| ファイル | 役割 |
|---|---|
| `src/app.module.ts` | Redis（CacheModule）接続設定（L44-L56） |
| `src/modules/auth/auth.service.ts` | ブラックリスト書込・メール認証コード保存/検証（type スコープ・クールダウン・誤入力カウンタ）・リフレッシュ時ブラックリスト確認 |
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
src/modules/auth/auth.service.ts:190:      const isBlacklisted = await this.cacheManager.get(`blacklist:${tokenHash}`);
src/modules/auth/auth.service.ts:387:        await this.cacheManager.set(`blacklist:${tokenHash}`, 1, ttl * 1000);
src/modules/auth/auth.service.ts:418:        await this.cacheManager.set(`blacklist:${tokenHash}`, 1, ttl * 1000);
src/common/guards/jwt-auth.guard.ts:111:      const isBlacklisted = await this.cacheManager.get(`blacklist:${tokenHash}`);
src/modules/users/users.service.ts:303:              await this.cacheManager.set(`blacklist:${refreshTokenHash}`, 1, refreshTtl);
検証コマンド: grep -n "verification_code:\|VERIFICATION_CODE_TTL_MS\|getVerificationCodeKey\|getVerificationCodeAttemptsKey\|getVerificationCodeCooldownKey\|VERIFICATION_CODE_COOLDOWN_MS\|VERIFICATION_CODE_MAX_ATTEMPTS" src/modules/auth/auth.service.ts
37:const VERIFICATION_CODE_TTL_MS = 5 * 60 * 1000;
41:const VERIFICATION_CODE_MAX_ATTEMPTS = 5;
43:const VERIFICATION_CODE_COOLDOWN_MS = 60 * 1000;
246:      const cooldownKey = this.getVerificationCodeCooldownKey(type, phoneNumber);
297:      await this.cacheManager.set(cooldownKey, 1, VERIFICATION_CODE_COOLDOWN_MS);
588:    return `verification_code:${type}:${phoneNumber}`;
595:    return `verification_code:attempts:${type}:${phoneNumber}`;
602:    return `verification_code:cooldown:${type}:${phoneNumber}`;
618:    const key = this.getVerificationCodeKey(type, phoneNumber);
619:    const attemptsKey = this.getVerificationCodeAttemptsKey(type, phoneNumber);
631:      if (attempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
641:      await this.cacheManager.set(attemptsKey, attempts, VERIFICATION_CODE_TTL_MS);
675:    await this.cacheManager.set(key, verificationCode, VERIFICATION_CODE_TTL_MS);
検証コマンド: grep -n "health:redis\|cacheManager.set(key, 'ok'\|cacheManager.get<string>(key)\|Redis round-trip" src/common/health/health.service.ts
55:    const key = `health:redis:${Date.now()}`;
59:      await this.cacheManager.set(key, 'ok', 5_000);
60:      const value = await this.cacheManager.get<string>(key);
64:        throw new Error('Redis round-trip verification failed');
検証コマンド: grep -n "sha256\|createHash" src/modules/auth/auth.service.ts src/common/guards/jwt-auth.guard.ts | head -8
src/modules/auth/auth.service.ts:189:      const tokenHash = crypto.createHash('sha256').update(refreshTokenDto.refreshToken).digest('hex');
src/modules/auth/auth.service.ts:386:        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
src/modules/auth/auth.service.ts:417:        const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
src/common/guards/jwt-auth.guard.ts:110:      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
検証コマンド: grep -n "toggleUserStatus\|userSession.findMany\|isActive: false\|refreshTtl" src/modules/users/users.service.ts | head -6
257:  async toggleUserStatus(id: string, status: UserStatus): Promise<UserResponseDto> {
287:        const activeSessions = await tx.userSession.findMany({
300:            const refreshTtl = session.refreshExpiresAt.getTime() - Date.now();
301:            if (refreshTtl > 0) {
303:              await this.cacheManager.set(`blacklist:${refreshTokenHash}`, 1, refreshTtl);
311:            data: { isActive: false },
検証コマンド: grep -n "private async checkRedis\|async logout\|addRefreshTokenToBlacklist(refreshToken)\|addAccessTokenToBlacklist(accessToken)" src/common/health/health.service.ts src/modules/auth/auth.service.ts
src/common/health/health.service.ts:54:  private async checkRedis() {
src/modules/auth/auth.service.ts:349:  async logout(userId: string, refreshToken: string, accessToken: string): Promise<ApiResponseDto<void>> {
src/modules/auth/auth.service.ts:352:      await this.addRefreshTokenToBlacklist(refreshToken);
src/modules/auth/auth.service.ts:354:      await this.addAccessTokenToBlacklist(accessToken);
```
