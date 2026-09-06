# API 契約（api-contract）

> 本ドキュメントは `docs/api-contract.md`（基準コミット `b4bac5d1d8d21017278fd197eaf3be4c1079e4e2`）の日本語版である。

本ドキュメントはこのブランチの詳細な API 契約である。

このファイルをフロントエンド/バックエンド統合の詳細に関する single source of truth として使用すること。README は意図的に短く保たれており、エンドポイント単位の挙動については本ドキュメントに従うこと。

> サーバー間連携エンドポイント（IF-01/IF-02、IntegrationGuard）はここでは対象外である — Salesforce リポジトリの設計ドキュメント（interface-design.md BD-09 / module-design.md DD-02）および docs/manual-retry-procedure.md を参照すること。

ローカル開発時のベース URL:

```text
http://localhost:3001
```

グローバル API プレフィックス:

```text
/v1
```

## 共通規約

### 認証トランスポート

- バックエンドは `access_token` と `refresh_token` に HttpOnly Cookie を使用する。
- CSRF 保護が有効な場合、変更系リクエストには `csrf_token` Cookie も使用される。

### レスポンスエンベロープ

ほとんどのエンドポイントは、成功時にバックエンドの `ApiResponseDto` エンベロープを使用する:

```json
{
  "code": 200,
  "message": "Operation succeeded",
  "data": {},
  "requestId": "req_xxx",
  "timestamp": "2026-03-30T00:00:00.000Z"
}
```

予約リスト系の一部のフローでは、`data` でラップされる代わりに controller/service 経路からリストペイロードを直接返す。これは現在のブランチ契約の一部であり、以下でエンドポイントごとに文書化する。

### ページネーション形式

ページネーションを行うリスト系エンドポイントは次の形式を使用する:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 10,
  "totalPages": 0
}
```

## 認証

### `POST /v1/auth/login`

- メソッド: `POST`
- パス: `/v1/auth/login`
- 認証必須？: `No`
- リクエスト形式:

```json
{
  "phoneNumber": "13800138000",
  "verificationCode": "123456"
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Login succeeded",
  "data": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "name": "Alice",
      "phoneNumber": "13800138000",
      "role": "ADMIN",
      "status": "ACTIVE"
    }
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  電話番号と検証コードを使用する。
  `access_token`、`refresh_token`、`csrf_token` の各 Cookie も設定する。

### `POST /v1/auth/register`

- メソッド: `POST`
- パス: `/v1/auth/register`
- 認証必須？: `No`
- リクエスト形式:

```json
{
  "name": "Alice",
  "phoneNumber": "13800138000",
  "email": "alice@example.com",
  "verificationCode": "123456"
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Register succeeded",
  "data": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "name": "Alice",
      "phoneNumber": "13800138000",
      "role": "CUSTOMER",
      "status": "ACTIVE"
    }
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  登録も成功時に認証用 Cookie を設定する。

### `POST /v1/auth/send-verification-code`

- メソッド: `POST`
- パス: `/v1/auth/send-verification-code`
- 認証必須？: `No`
- リクエスト形式:

```json
{
  "phoneNumber": "13800138000",
  "type": "login"
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Verification code sent",
  "data": null,
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  `type` は `login` または `register` でなければならない。

### `POST /v1/auth/refresh`

- メソッド: `POST`
- パス: `/v1/auth/refresh`
- 認証必須？: `No`
- リクエスト形式:

```json
{
  "refreshToken": "jwt"
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Token refreshed",
  "data": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "name": "Alice",
      "phoneNumber": "13800138000",
      "role": "ADMIN",
      "status": "ACTIVE"
    }
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  バックエンドは `refresh_token` Cookie が存在する場合にはそれを優先し、存在しない場合は `body.refreshToken` にフォールバックする。

### `POST /v1/auth/logout`

- メソッド: `POST`
- パス: `/v1/auth/logout`
- 認証必須？: `Yes`
- リクエスト形式:

```json
{}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Logout succeeded",
  "data": null,
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  `access_token`、`refresh_token`、`csrf_token` の各 Cookie をクリアする。

### `GET /v1/auth/profile`

- メソッド: `GET`
- パス: `/v1/auth/profile`
- 認証必須？: `Yes`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Profile loaded",
  "data": {
    "id": "uuid",
    "name": "Alice",
    "phoneNumber": "13800138000",
    "email": "alice@example.com",
    "role": "ADMIN",
    "status": "ACTIVE",
    "remarks": "",
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T00:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  このブランチにおける正規の「現在のユーザー」エンドポイントとして扱うこと。

### `GET /v1/auth/verify`

- メソッド: `GET`
- パス: `/v1/auth/verify`
- 認証必須？: `Yes`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Token is valid",
  "data": {
    "userId": "uuid",
    "valid": true,
    "expiresAt": 1770000000000
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  `expiresAt` はミリ秒単位のタイムスタンプとして返される。

### `GET /v1/auth/check-phone`

- メソッド: `GET`
- パス: `/v1/auth/check-phone`
- 認証必須？: `No`
- リクエスト形式:
  クエリパラメータ: `phoneNumber`（文字列）

- レスポンス形式:

```json
{
  "code": 200,
  "message": "检查完成",
  "data": {
    "exists": true
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  電話番号が既に登録済みかどうかを確認する。`exists` のブール値を返す。

## 予約

### `POST /v1/bookings`

- メソッド: `POST`
- パス: `/v1/bookings`
- 認証必須？: `Yes`
- リクエスト形式:

```json
{
  "timeSlotId": "uuid",
  "userId": "uuid",
  "serviceId": "uuid",
  "appointmentDate": "2026-03-30",
  "customerName": "Alice",
  "customerPhone": "13800138000",
  "customerEmail": "alice@example.com",
  "customerWechat": "alice_wechat",
  "notes": "Window seat if possible",
  "serviceName": "Consultation"
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Booking created",
  "data": {
    "id": "uuid",
    "appointmentNumber": "AP-20260330-0001",
    "timeSlotId": "uuid",
    "userId": "uuid",
    "appointmentDate": "2026-03-30T00:00:00.000Z",
    "status": "PENDING",
    "customerName": "Alice",
    "customerPhone": "13800138000",
    "customerEmail": "alice@example.com",
    "customerWechat": "alice_wechat",
    "notes": "Window seat if possible",
    "timeSlot": {
      "slotTime": "09:00:00",
      "durationMinutes": 30
    },
    "user": {
      "name": "Alice",
      "phoneNumber": "13800138000"
    },
    "service": {
      "id": "uuid",
      "name": "Consultation",
      "durationMinutes": 30
    },
    "confirmationSent": false,
    "reminderSent": false,
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T00:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  `userId` が省略された場合、バックエンドが `currentUser.id` から補完する。

### `GET /v1/bookings/all`

- メソッド: `GET`
- パス: `/v1/bookings/all`
- 認証必須？: `Yes`
- リクエスト形式:
  クエリパラメータとして `userId`、`timeSlotId`、`status`、`customerName`、`customerPhone`、`startDate`、`endDate`、`page`、`limit`、`keyword` を指定できる。

- レスポンス形式:

```json
{
  "items": [
    {
      "id": "uuid",
      "appointmentNumber": "AP-20260330-0001",
      "timeSlotId": "uuid",
      "userId": "uuid",
      "appointmentDate": "2026-03-30T00:00:00.000Z",
      "status": "PENDING",
      "customerName": "Alice",
      "customerPhone": "13800138000"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

- 備考:
  `/bookings/all` はユーザー用・管理者用の両クライアントで共有されるリストエンドポイントである。
  管理者以外のユーザーは、受け取ったクエリが広範であってもバックエンドロジックにより現在の認証済みユーザーに絞り込まれる。
  `/bookings/me` はこのブランチでは導入されておらず、契約の一部として扱ってはならない。

### `GET /v1/bookings/by-date?date=YYYY-MM-DD`

- メソッド: `GET`
- パス: `/v1/bookings/by-date`
- 認証必須？: `Yes`
- リクエスト形式:

```text
?date=YYYY-MM-DD
```

- レスポンス形式:

```json
{
  "items": [
    {
      "id": "uuid",
      "appointmentNumber": "AP-20260330-0001",
      "status": "PENDING",
      "customerName": "Alice"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

- 備考:
  日付別の予約ビューや日付ベースの空き状況対応に使用する。
  ここでも管理者以外のユーザーは自分自身のレコードにフィルタされる。

### `GET /v1/bookings/:id`

- メソッド: `GET`
- パス: `/v1/bookings/:id`
- 認証必須？: `Yes`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "id": "uuid",
  "appointmentNumber": "AP-20260330-0001",
  "timeSlotId": "uuid",
  "userId": "uuid",
  "appointmentDate": "2026-03-30T00:00:00.000Z",
  "status": "PENDING",
  "customerName": "Alice",
  "customerPhone": "13800138000"
}
```

- 備考:
  ラップされたページネーションペイロードではなく、単一の予約オブジェクトを返す。
  管理者以外のユーザーは自分の予約にのみアクセスできる。

### `PATCH /v1/bookings/:id`

- メソッド: `PATCH`
- パス: `/v1/bookings/:id`
- 認証必須？: `Yes`
- リクエスト形式:

```json
{
  "status": "CONFIRMED",
  "appointmentDate": "2026-03-31",
  "timeSlotId": "uuid",
  "serviceId": "uuid",
  "customerName": "Alice",
  "customerPhone": "13800138000",
  "customerEmail": "alice@example.com",
  "customerWechat": "alice_wechat",
  "notes": "Updated note"
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Booking updated",
  "data": {
    "id": "uuid",
    "status": "CONFIRMED"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者以外のユーザーは自分の予約のみを更新できる。

### `PATCH /v1/bookings/:id/cancel`

- メソッド: `PATCH`
- パス: `/v1/bookings/:id/cancel`
- 認証必須？: `Yes`
- リクエスト形式:

```json
{}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Booking cancelled",
  "data": null,
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  このブランチにおけるフロントエンド互換のキャンセルエンドポイントである。

### `DELETE /v1/bookings/:id`

- メソッド: `DELETE`
- パス: `/v1/bookings/:id`
- 認証必須？: `Yes`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:
  HTTP 204 No Content（レスポンスボディなし）。

- 備考:
  予約を物理削除する。管理者は任意の予約を削除でき、一般ユーザーは自分の予約のみを削除できる。

### `GET /v1/bookings/stats/summary`

- メソッド: `GET`
- パス: `/v1/bookings/stats/summary`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "获取预约统计信息成功",
  "data": {
    "totalAppointments": 100,
    "pendingAppointments": 10,
    "confirmedAppointments": 70,
    "completedAppointments": 15,
    "cancelledAppointments": 5,
    "todayAppointments": 3,
    "thisWeekAppointments": 20,
    "thisMonthAppointments": 50
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者専用の統計エンドポイントである。予約に関する統計データを返す。

## サービス

### `GET /v1/services`

- メソッド: `GET`
- パス: `/v1/services`
- 認証必須？: `Yes`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Services loaded",
  "data": [
    {
      "id": "uuid",
      "name": "Consultation",
      "description": "30 minute consultation",
      "durationMinutes": 30,
      "price": 199,
      "imageUrl": "https://example.com/service.png",
      "categoryId": "uuid",
      "isActive": true,
      "displayOrder": 1,
      "category": {
        "id": "uuid",
        "name": "General"
      }
    }
  ],
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  予約フローで使用される共有のサービスリストエンドポイントである。

### `GET /v1/services/all`

- メソッド: `GET`
- パス: `/v1/services/all`
- 認証必須？: `Yes`
- リクエスト形式:
  クエリパラメータとして `name`、`description`、`durationMinutes`、`price`、`imageUrl`、`categoryId`、`isActive`、`displayOrder`、`page`、`limit` を指定できる。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Services loaded",
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Consultation",
        "durationMinutes": 30,
        "isActive": true
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  ページネーションとフィルタリングをサポートする管理者向けのサービスリストエンドポイントである。

### `POST /v1/services/admin`

- メソッド: `POST`
- パス: `/v1/services/admin`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:

```json
{
  "name": "深度咨询",
  "description": "专业咨询服务",
  "durationMinutes": 60,
  "price": 299,
  "imageUrl": "https://example.com/service.png",
  "categoryId": "uuid",
  "isActive": true,
  "displayOrder": 1
}
```

- レスポンス形式:

```json
{
  "code": 201,
  "message": "创建服务成功",
  "data": {
    "id": "uuid",
    "name": "深度咨询",
    "description": "专业咨询服务",
    "durationMinutes": 60,
    "price": 299,
    "imageUrl": "https://example.com/service.png",
    "categoryId": "uuid",
    "isActive": true,
    "displayOrder": 1,
    "category": {
      "id": "uuid",
      "name": "General"
    }
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者が新しいサービスを作成する。

### `PATCH /v1/services/admin/:id`

- メソッド: `PATCH`
- パス: `/v1/services/admin/:id`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:

```json
{
  "name": "更新后的服务名称",
  "description": "更新后的描述",
  "durationMinutes": 90,
  "price": 399,
  "imageUrl": "https://example.com/new-image.png",
  "categoryId": "uuid",
  "isActive": false,
  "displayOrder": 2
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "更新服务成功",
  "data": {
    "id": "uuid",
    "name": "更新后的服务名称",
    "description": "更新后的描述",
    "durationMinutes": 90,
    "price": 399,
    "imageUrl": "https://example.com/new-image.png",
    "categoryId": "uuid",
    "isActive": false,
    "displayOrder": 2,
    "category": {
      "id": "uuid",
      "name": "General"
    }
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者がサービス情報を更新する。

### `PATCH /v1/services/admin/:id/status`

- メソッド: `PATCH`
- パス: `/v1/services/admin/:id/status`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:

```json
{
  "isActive": false
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "服务状态更新成功",
  "data": {
    "id": "uuid",
    "name": "服务名称",
    "isActive": false
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者がサービスの有効状態を切り替える。

## 時間枠

### `GET /v1/time-slots`

- メソッド: `GET`
- パス: `/v1/time-slots`
- 認証必須？: `No`
- リクエスト形式:
  クエリパラメータとして `slotTime`、`isActive`、`minDuration`、`maxDuration`、`page`、`limit` を指定できる。

- レスポンス形式:

```json
{
  "items": [
    {
      "id": "uuid",
      "slotTime": "09:00:00",
      "durationMinutes": 30,
      "isActive": true
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

- 備考:
  汎用の時間枠一覧エンドポイントである。

### `GET /v1/time-slots/available-slots?date=YYYY-MM-DD`

- メソッド: `GET`
- パス: `/v1/time-slots/available-slots`
- 認証必須？: `No`
- リクエスト形式:

```text
?date=YYYY-MM-DD
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "Operation succeeded",
  "data": [
    {
      "id": "uuid",
      "slotTime": "09:00:00",
      "durationMinutes": 30,
      "bookedCount": 1,
      "isAvailable": true,
      "availabilityStatus": "AVAILABLE",
      "appointments": [
        {
          "id": "uuid",
          "customerName": "Alice",
          "status": "PENDING"
        }
      ]
    }
  ],
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  このブランチにおける主要な時間枠空き状況エンドポイントである。
  `date` は `YYYY-MM-DD` 形式で渡す必要がある。

### `POST /v1/time-slots`

- メソッド: `POST`
- パス: `/v1/time-slots`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:

```json
{
  "slotTime": "09:00:00",
  "durationMinutes": 30,
  "isActive": true
}
```

- レスポンス形式:

```json
{
  "code": 201,
  "message": "创建时间段成功",
  "data": {
    "id": "uuid",
    "slotTime": "09:00:00",
    "durationMinutes": 30,
    "isActive": true,
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T00:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者が新しい時間枠を作成する。

### `GET /v1/time-slots/:id`

- メソッド: `GET`
- パス: `/v1/time-slots/:id`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "获取时间段详情成功",
  "data": {
    "id": "uuid",
    "slotTime": "09:00:00",
    "durationMinutes": 30,
    "isActive": true,
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T00:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者が単一の時間枠の詳細を取得する。

### `PATCH /v1/time-slots/:id`

- メソッド: `PATCH`
- パス: `/v1/time-slots/:id`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:

```json
{
  "slotTime": "10:00:00",
  "durationMinutes": 60,
  "isActive": false
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "更新时间段成功",
  "data": {
    "id": "uuid",
    "slotTime": "10:00:00",
    "durationMinutes": 60,
    "isActive": false,
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T01:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者が時間枠情報を更新する。

### `DELETE /v1/time-slots/:id`

- メソッド: `DELETE`
- パス: `/v1/time-slots/:id`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:
  HTTP 204 No Content（レスポンスボディなし）。

- 備考:
  管理者が時間枠を削除する。

## ユーザー

### `POST /v1/users`

- メソッド: `POST`
- パス: `/v1/users`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:

```json
{
  "name": "Bob",
  "phoneNumber": "13900139000",
  "email": "bob@example.com",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "remarks": "新用户"
}
```

- レスポンス形式:

```json
{
  "code": 201,
  "message": "创建用户成功",
  "data": {
    "id": "uuid",
    "name": "Bob",
    "phoneNumber": "13900139000",
    "email": "bob@example.com",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "remarks": "新用户",
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T00:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者が新しいユーザーを作成する。

### `GET /v1/users`

- メソッド: `GET`
- パス: `/v1/users`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  クエリパラメータとして `name`、`phoneNumber`、`email`、`role`、`status`、`page`、`limit` を指定できる。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "用户列表获取成功",
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Bob",
        "phoneNumber": "13900139000",
        "email": "bob@example.com",
        "role": "CUSTOMER",
        "status": "ACTIVE"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者がユーザーリストを取得する。

### `GET /v1/users/profile/me`

- メソッド: `GET`
- パス: `/v1/users/profile/me`
- 認証必須？: `Yes`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "获取个人资料成功",
  "data": {
    "id": "uuid",
    "name": "Alice",
    "phoneNumber": "13800138000",
    "email": "alice@example.com",
    "role": "ADMIN",
    "status": "ACTIVE",
    "remarks": "",
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T00:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  現在認証済みのユーザーの完全なプロフィールを取得する。

### `GET /v1/users/statistics`

- メソッド: `GET`
- パス: `/v1/users/statistics`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "用户统计获取成功",
  "data": {
    "totalUsers": 100,
    "activeUsers": 80,
    "inactiveUsers": 20,
    "adminUsers": 5,
    "customerUsers": 95,
    "todayRegistrations": 3
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者がユーザー統計データを取得する。

### `GET /v1/users/:id`

- メソッド: `GET`
- パス: `/v1/users/:id`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "获取用户详情成功",
  "data": {
    "id": "uuid",
    "name": "Bob",
    "phoneNumber": "13900139000",
    "email": "bob@example.com",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "remarks": "",
    "createdAt": "2026-03-30T00:00:00.000Z",
    "updatedAt": "2026-03-30T00:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者が単一のユーザーの詳細を取得する。

### `PUT /v1/users/:id/status`

- メソッド: `PUT`
- パス: `/v1/users/:id/status`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:

```json
{
  "status": "INACTIVE"
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "用户状态更新成功",
  "data": {
    "id": "uuid",
    "status": "INACTIVE"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者がユーザーの状態を更新する。

### `PUT /v1/users/:id`

- メソッド: `PUT`
- パス: `/v1/users/:id`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:

```json
{
  "name": "Bob Updated",
  "email": "bob.updated@example.com",
  "role": "ADMIN",
  "remarks": "更新备注"
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "用户信息更新成功",
  "data": {
    "id": "uuid",
    "name": "Bob Updated",
    "email": "bob.updated@example.com",
    "role": "ADMIN",
    "remarks": "更新备注"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者がユーザー情報を更新する。

### `DELETE /v1/users/:id`

- メソッド: `DELETE`
- パス: `/v1/users/:id`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:
  HTTP 204 No Content（レスポンスボディなし）。

- 備考:
  管理者がユーザーを削除する。

## システム

### `GET /v1/system/settings`

- メソッド: `GET`
- パス: `/v1/system/settings`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "系统设置获取成功",
  "data": {
    "key": "value",
    "anotherKey": "anotherValue"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  システム設定を取得する。

### `PATCH /v1/system/settings/:key`

- メソッド: `PATCH`
- パス: `/v1/system/settings/:key`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:

```json
{
  "value": "newValue"
}
```

- レスポンス形式:

```json
{
  "code": 200,
  "message": "系统设置更新成功",
  "data": {
    "key": "updatedKey",
    "value": "newValue"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  特定のシステム設定を更新する。

### `GET /v1/system/reports/statistics`

- メソッド: `GET`
- パス: `/v1/system/reports/statistics`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "系统统计报告获取成功",
  "data": {
    "totalBookings": 1000,
    "totalUsers": 150,
    "totalServices": 20,
    "totalTimeSlots": 48
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  システム全体の統計レポートを取得する。

### `GET /v1/system/reports/user-statistics`

- メソッド: `GET`
- パス: `/v1/system/reports/user-statistics`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "用户统计报告获取成功",
  "data": {
    "userActivity": [
      {
        "date": "2026-03-30",
        "activeUsers": 50,
        "newRegistrations": 3
      }
    ]
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  ユーザーアクティビティの統計レポートを取得する。

## ファイルアップロード

### `POST /v1/upload/single`

- メソッド: `POST`
- パス: `/v1/upload/single`
- 認証必須？: `Yes`
- リクエスト形式:
  フィールド `file`（ファイルアップロード）を含む multipart form-data。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "文件上传成功",
  "data": {
    "url": "https://example.com/uploads/filename.jpg",
    "filename": "filename.jpg",
    "size": 12345,
    "mimetype": "image/jpeg"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  単一ファイルアップロードのエンドポイントである。

### `POST /v1/upload/multiple`

- メソッド: `POST`
- パス: `/v1/upload/multiple`
- 認証必須？: `Yes`
- リクエスト形式:
  フィールド `files`（複数ファイルアップロード）を含む multipart form-data。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "多文件上传成功",
  "data": [
    {
      "url": "https://example.com/uploads/file1.jpg",
      "filename": "file1.jpg",
      "size": 12345,
      "mimetype": "image/jpeg"
    }
  ],
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  複数ファイルアップロードのエンドポイントである。

### `POST /v1/upload/avatar`

- メソッド: `POST`
- パス: `/v1/upload/avatar`
- 認証必須？: `Yes`
- リクエスト形式:
  フィールド `avatar`（画像ファイル）を含む multipart form-data。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "头像上传成功",
  "data": {
    "url": "https://example.com/uploads/avatar.jpg",
    "filename": "avatar.jpg",
    "size": 12345,
    "mimetype": "image/jpeg"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  ユーザーアバターのアップロード専用エンドポイントである。

### `GET /v1/upload/stats`

- メソッド: `GET`
- パス: `/v1/upload/stats`
- 認証必須？: `Yes`（管理者のみ）
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "上传统计获取成功",
  "data": {
    "totalFiles": 100,
    "totalSize": 10485760,
    "byType": {
      "image": 50,
      "document": 30,
      "other": 20
    }
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  管理者がファイルアップロードの統計データを取得する。

## 通知

### `GET /v1/notifications`

- メソッド: `GET`
- パス: `/v1/notifications`
- 認証必須？: `Yes`
- リクエスト形式:
  クエリパラメータとして `type`、`read`、`page`、`limit` を指定できる。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "通知列表获取成功",
  "data": {
    "items": [
      {
        "id": "uuid",
        "type": "SYSTEM",
        "title": "系统通知",
        "content": "您的预约已确认",
        "read": false,
        "createdAt": "2026-03-30T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  現在のユーザーの通知リストを取得する。

### `PUT /v1/notifications/:id/read`

- メソッド: `PUT`
- パス: `/v1/notifications/:id/read`
- 認証必須？: `Yes`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "通知标记为已读成功",
  "data": {
    "id": "uuid",
    "read": true
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  通知を既読にする。

### `PUT /v1/notifications/read-all`

- メソッド: `PUT`
- パス: `/v1/notifications/read-all`
- 認証必須？: `Yes`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "全部通知标记为已读成功",
  "data": {
    "markedCount": 5
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  現在のユーザーのすべての通知を既読にする。

### `GET /v1/notifications/unread-count`

- メソッド: `GET`
- パス: `/v1/notifications/unread-count`
- 認証必須？: `Yes`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "code": 200,
  "message": "未读通知数获取成功",
  "data": {
    "count": 3
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- 備考:
  現在のユーザーの未読通知数を取得する。

### WebSocket 接続

1. 接続 URL: `ws://localhost:3001/v1/notifications/ws`
2. 認証: `access_token` Cookie またはクエリパラメータ `token` により認証する
3. メッセージタイプ:
   - `notification`: 新規通知のプッシュ
   - `booking_update`: 予約状態の更新
   - `system_alert`: システムアラート

- 備考:
  リアルタイム通知は WebSocket 経由でプッシュされる。

## ヘルスチェック

### `GET /v1/health`

- メソッド: `GET`
- パス: `/v1/health`
- 認証必須？: `No`
- リクエスト形式:
  リクエストボディなし。

- レスポンス形式:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-30T00:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "storage": "available"
  }
}
```

- 備考:
  サービスのヘルスチェックエンドポイントである。データベース、Redis 等の依存サービスの接続状態を返す。
