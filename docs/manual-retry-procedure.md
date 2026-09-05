# 予約取消系 手動リトライ手順書（B-7）

## ドキュメント情報

- **タイトル**: 予約取消系 手動リトライ手順書（B-7）
- **目的**: Salesforce 側からの予約取消コマンド（IF-02）および予約投影（IF-01）が失敗・滞留した際に、運用担当者が安全かつ冪等に手動リトライを実施するための手順を定める。
- **生成日**: 2026-09-04
- **出典**: CHK-02 B-7・BIZ-15・REQ-028・RULE-03/09/10・C-2修订/C-5・DD-02 §2.3/§2.4・handoff :83
- **拍板記録（2026-09-04 ユーザー拍板）**:
  - ① 投影リトライは実装上の到達不能を「既知偏差」として文書化し、記録方式で管理する
  - ② token ローテーションは実態（単値）を正直に記載し、C-2修订との矛盾を記録方式で対応する
  - ③ 本文書は日本語で作成する
  - ④ 第5章・第6章は「運用手順拡張章」として本文書に収録する

---

## 第1章 目的・適用範囲

### 1.1 目的

本手順書は、以下の 2 系統の手動リトライ手順を提供する。

- **IF-02 コマンド系**: Salesforce 側 `Booking_Command__c` が失敗・滞留した取消コマンドを、Salesforce 側から再 enqueue により回収する手順。
- **IF-01 投影系**: Booking 側から Salesforce 側への予約投影（`appointments` → SF 投影）が失敗した際のリカバリ手順。ただし現実装では「原 eventId での再実行」は到達不能であり、**既知偏差として記録**した上での代替手順（第4章参照）。

### 1.2 対象状態

手動リトライの対象となる状態は以下のとおり。

| 対象状態 | 系統 | 性質 |
| --- | --- | --- |
| `FAILED` | IF-02 コマンド | 終態（再 enqueue で回収可能） |
| `QUEUED` 滞留 | IF-02 コマンド | 非終態・滞留（進まず滞る） |
| `RUNNING` 滞留 | IF-02 コマンド | 非終態・滞留（連鎖断裂により進行しない） |
| `syncStatus=ERROR` | IF-01 投影 | 送信系失敗（正本側の状態） |
| `syncStatus=PENDING` 滞留 | IF-01 投影 | 非終態・滞留（VERSION_CONFLICT 等による滞留） |

---

## 第2章 状態機械と失敗判定基準

### 2.1 SF 側 `Booking_Command__c` の状態機械

```
QUEUED ──▶ RUNNING ──▶ SUCCEEDED
            │  ├──▶ CONFLICT
            │  └──▶ FAILED
```

- **MAX_ATTEMPTS = 3**（初回 + 即時連鎖リトライ 2 回・遅延なし）。

#### 4xx 非終態挙動（400/401/403/404）

- **Status は不変**（`QUEUED` のまま）。
- `HttpStatus` / `ResultCode` / `LastError` のみ記録される（ソース実測: `BookingCommandQueueable.cls:236-243`）。
- 結果として **401/403 は滞留**する（自動再試行されない）。滞留時の Status は状況により異なる：**初回試行**で発生した場合は `QUEUED` のまま、**連鎖中**（以前の一時障害で `RUNNING` になった後）に発生した場合は `RUNNING + AUTH_ERROR` のまま。これは第2.3節の症状表における「マッピング未登録/不一致・token 不一致」の第一症状となる。

#### 一時的障害（429/503/timeout/予期しない 500）

- `AttemptCount+1`。
- 上限内（3 回未満）なら**即時再 enqueue（連鎖リトライ）**。
- 上限到達で `FAILED`（`TRANSIENT` / `SYSTEM_ERROR`）（`BookingCommandQueueable.cls:250-268`）。

#### scheduleRetry の握り潰し（連鎖断裂）

- `scheduleRetry` は enqueue 異常を**握り潰す**（`BookingCommandQueueable.cls:290-305`・本番コメント「手動確認対象」）。
- この結果、**`RUNNING` + 長時間未更新の `NextAttemptAt` = 連鎖断裂**（自動では復帰しない）となり、手動介入対象となる。

### 2.2 Booking 側 `appointments.syncStatus` の状態機械

```
PENDING ──▶ SYNCED
   │
   └──▶ ERROR
```

- **VERSION_CONFLICT（409）分類は `syncStatus` を書き換えない**（ソース実測: `projection-sender.service.ts:329-342`）。ログのみ記録し、`updateSyncStatus` は呼ばれないため **PENDING 滞留**となる。
- 旧バージョンの投影拒否は**恒久的な正解**（DD-02 §2.4）。新版に追い越された長時間未更新の `ERROR` は対応不要。

### 2.3 症状対照表

| 症状（SF 側 Status / ResultCode / LastError） | 症状（Booking 側 syncStatus） | 原因候補 | 対応章 |
| --- | --- | --- | --- |
| `QUEUED` + `AUTH_ERROR`（初回試行の 401/403） | 変化なし（コマンド未到達） | マッピング未登録/不一致・token 不一致（第一症状） | 第3章・第5章・第6章 |
| `RUNNING` + `AUTH_ERROR`（連鎖中の 401/403） | 変化なし（コマンド未到達） | マッピング未登録/不一致・token 不一致（連鎖中に発生） | 第3章 |
| `RUNNING` + `NextAttemptAt` 長時間未更新 | 変化なし | 連鎖断裂（scheduleRetry 握り潰し） | 第3章 |
| `FAILED`（`TRANSIENT`/`SYSTEM_ERROR`） | 変化なし | 一時的障害の上限（3 回）到達 | 第3章 |
| `SUCCEEDED` 済みなのに再実行したい | `SYNCED` / `CANCELLED` | 再実行は冪等で無害（RULE-03） | 第3章 安全性論証 |
| — | `syncStatus=ERROR` | 送信系失敗（SF 側設定/ネットワーク/認証） | 第4章 |
| — | `syncStatus=PENDING` 滞留 | VERSION_CONFLICT（実同期済みの参考値）/ 送信中 | 第4章 |

---

## 第3章 IF-02 コマンド手動リトライ手順（手順ベース・原 commandId 維持・Retry UI は実施しない）

### 3.1 前提確認

再 enqueue の前に、元チェーンの残留（`RUNNING` の同時実行）の有無を確認する。

- 二重実行は冪等（RULE-03）により無害だが、回避が望ましい。
- 対象コマンドの Status が `RUNNING` のままの場合は、まず連鎖断裂の確認（第2.1節）を行い、残留実行がないことを確認してから進める。

### 3.2 対象状態

- `FAILED`（終態）
- `QUEUED` 滞留（非終態）
- `RUNNING` 滞留（連鎖断裂）

### 3.3 RESET DML 完全リスト

SOQL / Developer Console / Anonymous Apex のいずれかで、対象コマンドに対して以下を実行する。

| 項目 | 設定値 | 備考 |
| --- | --- | --- |
| `Status__c` | `'QUEUED'` | 必須 |
| `AttemptCount__c` | `0` | 必須（null も 0 扱い） |
| `NextAttemptAt__c` | `null` | 必須（長時間未更新の解消） |
| `LastError__c` | 任意 | 200 到達時に自己クリアされるため（挙動根拠: 成功時はエラー情報が上書きされる） |
| `ResponseBodyRedacted__c` | 触る必要なし | Queueable は使用しないフィールド |

### 3.4 再 enqueue スニペット（Anonymous Apex）

実測の 6 パラメータ順に従う。`cmd` は 3.3 の RESET DML **実施後**に取得する。

```apex
// === 前提（RESET DML 実施後に実行）===
Booking_Command__c cmd = [SELECT Id, CommandId__c, BookingExternalId__c, ExpectedVersion__c,
    RequestedBySalesforceUserId__c, CorrelationId__c
    FROM Booking_Command__c
    WHERE CommandId__c = '<対象commandId>' LIMIT 1];

// === 再 enqueue（cmd = リセット済みレコード・実測 6 パラメータ順）===
System.enqueueJob(new BookingCommandQueueable(
    cmd.Id,
    cmd.CommandId__c,
    cmd.BookingExternalId__c,
    Integer.valueOf(cmd.ExpectedVersion__c), // 第4実引数は Integer expectedVersion（BookingCommandQueueable.cls:125）
    //    ExpectedVersion__c は Number フィールド（SObject 数値=Decimal）のため Decimal→Integer の暗黙代入は不可。
    //    ExpectedVersion__c はコントローラの空値拒否により非空が保証される（BookingSiteController.cls:89）。
    //    ただし RESET 前に対象レコードの ExpectedVersion__c が非空であることを確認することを推奨。
    cmd.RequestedBySalesforceUserId__c,
    cmd.CorrelationId__c
));
```

### 3.5 安全性論証（必須）

- **① 同一 commandId で再実行** → Booking 側 RULE-03 冪等により `integration_commands` 命中 → **初回結果をそのまま返す・正本への副作用ゼロ**。
- **② 初回成功後に commandId を変えて再実行** → 状態遷移門（RULE-07）およびバージョンゲート（RULE-02）により **409 CONFLICT**（正本は変更されない）。
- **③ 初回失敗後（正本未変更・コマンド行なし）に commandId を変える** → 新規実行として受理され得る（この場合は新たな副作用が発生する＝別コマンド扱い）。
- **結論**: いずれの経路でも**正本への副作用は高々 1 回**（重複副作用なしは常に成立。BIZ-15・RULE-10 の要求を充足）。

### 3.6 注意（監査）

- `AttemptCount` のリセットは**失敗履歴の消去**を伴う。
- 監査上、事前に `LastError` 等の失敗履歴を記録・保存してから実施すること。

---

## 第4章 IF-01 投影の手動リトライ手順【既知偏差の記録】

### 4.1 偏差事実（実測根拠付き）

- Booking 側 `projectBooking` は**呼出ごとに新 eventId を生成**する（`projection-sender.service.ts:87`）。
- **eventId は永続化しない**（`updateSyncStatus` は `syncStatus` のみ書き込む: `projection-sender.service.ts:377-392`）。
- したがって、checklist B-7 / REQ-028 の「投影を原 eventId で再実行」は**現実装では到達不能**。

> **拍板（2026-09-04）**: 上記を「既知偏差」として文書化・記録する。P1 としての eventId 永続化は候補として別枠管理（本手順書の対象外）。

### 4.2 リカバリ手順（代替手順）

1. **根因修復**: SF 側設定・ネットワーク・認証を復旧する。
2. **正本の再保存**: 既存の更新系 API 等により正本を再保存する。
   - これにより**新 eventId・version+1 で再投影が発火**する。
3. **重複副作用なしの根拠**:
   - SF 側 RULE-04（`LastEventId` による eventId 冪等: `BookingProjectionRest.cls:241` / `:330`）。
   - RULE-01 / RULE-02（バージョンゲート: `BookingProjectionRest.cls:251`）。
   - 旧投影が実は済んでいた場合でも、新版は受理され同データ上書きで**業務無害**。

### 4.3 VERSION_CONFLICT 時の扱い

- Booking 側 `syncStatus` は **PENDING のまま**（書き換えない）。
- 「PENDING 滞留」症状として観測される。
- 実同期済みの参考値（SF 側に同一 version が既に反映済み）であれば**原則対応不要**。次回の正本変更で自然解消する。

---

## 第5章【運用手順拡張章】INTEGRATION_TOKEN ローテーション

### 5.1 実態（正直に記載）

- 両側とも**単値**で運用している。
  - Booking 側: env `INTEGRATION_TOKEN` の 1 値。`IntegrationGuard` は単一値との定数時間比較（`integration.guard.ts:40-50`）。
  - SF 側: EC `guardSecret` の 1 値。
- **C-2修订の「2 値重複ローテーション」は現実装では成立しない**。切替時（旧値→新値の間）に**401 ウィンドウ（切替不一致期間）は不可避**。
- **拍板（2026-09-04）**: 実態記載 + 矛盾の記録で対応する。真の重複（Guard 双値対応）はコード変更であり**未実施**。C-2修订との矛盾として CHK-02 D 系回写時に記録予定。

### 5.2 手順（推奨順序）

1. **SF 側サイト操作を静止**する（新規コマンド発生を止める）。
2. **Booking 側 env を新値へ更新**し、**プロセスを再起動**する。
   - 注意: env 未設定のまま起動すると **fail-closed で 500** になる（`integration.guard.ts` の `INTEGRATION_TOKEN 未配置` 例外）。
3. 切替不一致期間中に旧値で送信されたコマンドは **401 AUTH_ERROR** となる。滞留 Status は初回試行なら `QUEUED`・連鎖中なら `RUNNING` のまま（第2.3節症状表参照）。
4. **SF 側 EC `guardSecret` を新値へ更新**する。
5. 滞留コマンドは**第3章の手順で回収**する。

- **推奨順序の理由**: 事前静止によりウィンドウ（切替不一致期間）中の新規コマンド発生を防ぎ、手順を連続で短期間に完了するため。なお単値制約により、どちらの順序でも 401 ウィンドウ（切替不一致期間）自体は不可避である（§5.1 実態）。
- 手順の順序（静止 → Booking 側切替 → SF 側切替 → 滞留回収）は上記のとおり実施する。

### 5.3 初回設定

- `.env` への項目追加手順:
  - `INTEGRATION_TOKEN=<ランダム値>` を `.env` に追記する（例: `openssl rand -hex 32`）。
- **dev 環境は 2026-09-04 に設定済み**であることを実測事実として記録する（本番・他環境は未設定のため、起動前に必ず設定すること）。

---

## 第6章【運用手順拡張章】StaticOperatorMapping 登録手順

### 6.1 ベース SQL（冪等 upsert・プレースホルダ版）

```sql
INSERT INTO static_operator_mappings (id, salesforce_user_id, booking_user_id, active, created_at, updated_at)
VALUES (gen_random_uuid(), '<salesforceUserId>', '<bookingUserId>', true, now(), now())
ON CONFLICT (salesforce_user_id) DO UPDATE
SET booking_user_id = EXCLUDED.booking_user_id,
    active = EXCLUDED.active,
    updated_at = now();
```

### 6.2 dev 実績値（2026-09-04 登録）

| 項目 | 値 |
| --- | --- |
| salesforceUserId | `005g500000C8LhuAAF`（18 桁） |
| bookingUserId | `5d8f812f-3bc9-4a72-bd5a-bc146fdc87da`（システム管理者） |
| active | `true` |
| 登録日 | 2026-09-04 |

### 6.3 18 桁 case-safe 規約（重要）

- 登録値は**ランタイム実測値**を使用する（例: SF 側 `System.debug(UserInfo.getUserId())`、またはコマンドレコードの `RequestedBySalesforceUserId__c` 実値）。
- **ブラウザ URL からのコピーは 15 桁となり、精密一致で失敗（403）するため禁止**。
- 登録対象 = **実際に submitCancel を実行するユーザー**（実運用パス = Site コミュニティユーザーの `UserInfo.getUserId()`: `BookingSiteController.cls:121` / `:133`）。

### 6.4 org 移行後は必ず再登録

- SF レコード ID は**org 固有**。移行/新 org では**全件再発行**されるため、再登録必須。
- 同一 org 内では削除/復元でも不変（再登録不要）。

### 6.5 症状連動

- `QUEUED + AUTH_ERROR(403)` 滞留 = **マッピング未登録/ミスマッチの第一症状**（第2.3節の症状表と相互参照）。

---

## 第7章 動作確認（BIZ-15・手順ベース）

### 7.1 ローカルセグメント（2026-09-04 実施記録・実測値）

**実施条件**: dev 環境・`SF_PROJECTION_ENABLED=false`（投影 no-op）・B-5 マッピング登録済・`INTEGRATION_TOKEN` 設定済。

**実施内容**: 同一 commandId の二重 POST による冪等リトライ再現。

- 対象予約: `395f31cb-38ca-46aa-adf2-1a1ecabd2ece`（`AP-20260817-0002`・変更前の読取値 `version=0`・`status=PENDING`）
- リクエスト（6 フィールド）:
  - `commandType=CANCEL_BOOKING`
  - `commandId=f9006b49-4834-428a-bae6-713aa2d66cd9`
  - `bookingExternalId=395f31cb-38ca-46aa-adf2-1a1ecabd2ece`
  - `requestedBySalesforceUserId=005g500000C8LhuAAF`
  - `correlationId=7a291e46-ed66-4144-a2b7-1b4a0ff0aa38`
  - `expectedVersion=0`

**結果（実測値）**:

| 確認項目 | 期待 | 実測 |
| --- | --- | --- |
| POST #1 HTTP ステータス | 200 | 200 |
| POST #1 canonicalVersion | version+1 = 1 | 1 |
| POST #2（同一 body）HTTP ステータス | 200 | 200 |
| POST #2 canonicalVersion | POST #1 と同一 | 1（同一） |
| `appointments.version` | 変更前の読取値+1 のみ | 0 → 1（+1 のみ） |
| `appointments.status` | CANCELLED | CANCELLED |
| `integration_commands` 行数（同 commandId） | ちょうど 1 行 | 1 行 |
| `integration_commands` 内容 | — | `id=cf3d49ad-6bd2-4921-8a5e-72b3f0fbb7be` / `http_status=200` / `result_code=SUCCESS` / `canonical_version=1` / `correlation_id=7a291e46-ed66-4144-a2b7-1b4a0ff0aa38` |
| 負例（誤 token） | 401 | 401（`AUTHENTICATION_ERROR`・副作用行なし） |

**結論**: RULE-03 冪等リトライが動作確認できた（二重 POST でも正本への副作用は 1 回分のみ・コマンド行は 1 行）。

### 7.2 実機セグメント（実施済・2026-09-05・前提チェックリスト＋実施記録）

本番相当での実施前に、以下を確認・実施すること。

- [x] SF NC URL を実 URL 化する（現 placeholder: `https://booking.example.com`） **【実施 2026-09-05・拍板 β 偏差注記】**＝一次性 cloudflared 隧道 URL（Setup UI で NC `Booking_Integration_API` に当日 URL を設定。NC metadata は Url 値を含まないため版庫漂移なし・公網化＝P0-5 繰越）
- [x] EC `guardSecret` と Booking 側 `INTEGRATION_TOKEN` を同値化する **【実施・実証済 2026-09-05】**＝MV-08 で IntegrationGuard 通過（401 なし）により同値性を実機実証
- [x] `SF_PROJECTION_ENABLED=true` に設定する **【実施済 2026-09-05】**（`.env.development`）
- [x] B-5 マッピング（StaticOperatorMapping）登録済であること **【登録済 2026-09-04・6.2 参照】**
- [x] `.env` 変更後、プロセスを再起動すること（fail-closed 500 回避） **【実施済 2026-09-05】**

**実施内容（想定）**: 第3章の Apex 再 enqueue の全流程。

**証拠取得方法**:

- SF 側: 対象コマンドの SOQL による変更前後の読取値（`Status__c` / `AttemptCount__c` / `NextAttemptAt__c` / `ResultCode__c` / `LastError__c`）。
- Booking 側: psql による変更前後の読取値（`appointments.status` / `version` / `syncStatus`、`integration_commands` 行数・内容）。

### 7.2.1 実施記録（2026-09-05）

**FAILED 誘発**（隧道中断→HTTP 530×3）:

- 対象コマンド: `CMD-00002`（commandId `7c9e6679-…`）
- 結果: HTTP 530 ×3 → **FAILED / SYSTEM_ERROR / AttemptCount=3**（`72-failed-induction.json`・chogeer `.tmp-p04-evidence/`）

**手動 Retry 成功**（第3章手順どおり・RESET DML＋再 enqueue）:

| 確認項目 | 期待 | 実測 |
| --- | --- | --- |
| 第 3 章手順実行後のコマンド終态 | SUCCEEDED | SUCCEEDED |
| HttpStatus / LastError | 200 / null（自己消滅） | 200 / null（自己消滅実証） |
| 正本（B-00001） | CANCELLED / version 1 / SYNCED | CANCELLED / v1 / SYNCED |
| `integration_commands` 行数（同 commandId） | ちょうど 1 行 | 1 行 |
| correlation_id | 同値維持 | 同値 |

（証拠: `72-manual-retry-success.json`）

**86② 観察（既知乖離・CHK-02:86②）**:

- 取消コマンド本体・正本・コマンド記録は**全成功**につき、Booking 側再投影（`projectBooking`）の `appointments.syncStatus=ERROR` のみ観測（SF 行 owner=admin に integration user 不可視で再投影 update 不可・SF 側新行なし）。
- **ユーザー拍板（2026-09-05）＝C 方案「デモ予約 ID 分離＋記録方式」**：乖離データは修復せず既知偏差として文書化・demo 用予約 ID を分離管理（CHK-02 S-3 登記②に処置記録済・CHK-03 §6 参照）。
