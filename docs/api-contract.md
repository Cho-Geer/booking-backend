# API Contract

This document is the detailed API contract for this branch.

Use this file as the single source of truth for frontend/backend integration details. The READMEs intentionally stay shorter and should defer to this document for endpoint-level behavior.

Base URL in local development:

```text
http://localhost:3001
```

Global API prefix:

```text
/v1
```

## Shared Conventions

### Auth Transport

- The backend uses HttpOnly cookies for `access_token` and `refresh_token`.
- A `csrf_token` cookie is also used for mutation requests when CSRF protection is enabled.

### Response Envelope

Most successful endpoints use the backend `ApiResponseDto` envelope:

```json
{
  "code": 200,
  "message": "Operation succeeded",
  "data": {},
  "requestId": "req_xxx",
  "timestamp": "2026-03-30T00:00:00.000Z"
}
```

Some booking list flows return the list payload directly from the controller/service path rather than being wrapped in `data`. That is part of the current branch contract and is documented below endpoint-by-endpoint.

### Pagination Shape

List endpoints that paginate use this shape:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 10,
  "totalPages": 0
}
```

## Auth

### `POST /v1/auth/login`

- method: `POST`
- path: `/v1/auth/login`
- auth required?: `No`
- request shape:

```json
{
  "phoneNumber": "13800138000",
  "verificationCode": "123456"
}
```

- response shape:

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

- notes:
  Uses phone number plus verification code.
  Also sets `access_token`, `refresh_token`, and `csrf_token` cookies.

### `POST /v1/auth/register`

- method: `POST`
- path: `/v1/auth/register`
- auth required?: `No`
- request shape:

```json
{
  "name": "Alice",
  "phoneNumber": "13800138000",
  "email": "alice@example.com",
  "verificationCode": "123456"
}
```

- response shape:

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

- notes:
  Registration also sets auth cookies on success.

### `POST /v1/auth/send-verification-code`

- method: `POST`
- path: `/v1/auth/send-verification-code`
- auth required?: `No`
- request shape:

```json
{
  "phoneNumber": "13800138000",
  "type": "login"
}
```

- response shape:

```json
{
  "code": 200,
  "message": "Verification code sent",
  "data": null,
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- notes:
  `type` must be `login` or `register`.

### `POST /v1/auth/refresh`

- method: `POST`
- path: `/v1/auth/refresh`
- auth required?: `No`
- request shape:

```json
{
  "refreshToken": "jwt"
}
```

- response shape:

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

- notes:
  The backend prefers the `refresh_token` cookie when present and falls back to `body.refreshToken`.

### `POST /v1/auth/logout`

- method: `POST`
- path: `/v1/auth/logout`
- auth required?: `Yes`
- request shape:

```json
{}
```

- response shape:

```json
{
  "code": 200,
  "message": "Logout succeeded",
  "data": null,
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- notes:
  Clears `access_token`, `refresh_token`, and `csrf_token` cookies.

### `GET /v1/auth/profile`

- method: `GET`
- path: `/v1/auth/profile`
- auth required?: `Yes`
- request shape:
  No request body.

- response shape:

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

- notes:
  Treat this as the canonical "current user" endpoint for this branch.

### `GET /v1/auth/verify`

- method: `GET`
- path: `/v1/auth/verify`
- auth required?: `Yes`
- request shape:
  No request body.

- response shape:

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

- notes:
  `expiresAt` is returned as a millisecond timestamp.

### `GET /v1/auth/check-phone`

- method: `GET`
- path: `/v1/auth/check-phone`
- auth required?: `No`
- request shape:
  Query parameter: `phoneNumber` (string)

- response shape:

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

- notes:
  检查手机号是否已注册。返回 `exists` 布尔值。

## Bookings

### `POST /v1/bookings`

- method: `POST`
- path: `/v1/bookings`
- auth required?: `Yes`
- request shape:

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

- response shape:

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

- notes:
  If `userId` is omitted, the backend fills it from `currentUser.id`.

### `GET /v1/bookings/all`

- method: `GET`
- path: `/v1/bookings/all`
- auth required?: `Yes`
- request shape:
  Query params may include `userId`, `timeSlotId`, `status`, `customerName`, `customerPhone`, `startDate`, `endDate`, `page`, `limit`, and `keyword`.

- response shape:

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

- notes:
  `/bookings/all` is the shared list endpoint for both user and admin clients.
  Non-admin users are narrowed to the current authenticated user by backend logic even if the incoming query is broader.
  `/bookings/me` is not introduced in this branch and must not be treated as part of the contract.

### `GET /v1/bookings/by-date?date=YYYY-MM-DD`

- method: `GET`
- path: `/v1/bookings/by-date`
- auth required?: `Yes`
- request shape:

```text
?date=YYYY-MM-DD
```

- response shape:

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

- notes:
  Used for date-specific booking views and date-based availability support.
  Non-admin users are also filtered to their own records here.

### `GET /v1/bookings/:id`

- method: `GET`
- path: `/v1/bookings/:id`
- auth required?: `Yes`
- request shape:
  No request body.

- response shape:

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

- notes:
  Returns a single booking object rather than a wrapped paginated payload.
  Non-admin users can only access their own booking.

### `PATCH /v1/bookings/:id`

- method: `PATCH`
- path: `/v1/bookings/:id`
- auth required?: `Yes`
- request shape:

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

- response shape:

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

- notes:
  Non-admin users can only update their own booking.

### `PATCH /v1/bookings/:id/cancel`

- method: `PATCH`
- path: `/v1/bookings/:id/cancel`
- auth required?: `Yes`
- request shape:

```json
{}
```

- response shape:

```json
{
  "code": 200,
  "message": "Booking cancelled",
  "data": null,
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- notes:
  This is the frontend-compatible cancel endpoint for this branch.

### `DELETE /v1/bookings/:id`

- method: `DELETE`
- path: `/v1/bookings/:id`
- auth required?: `Yes`
- request shape:
  No request body.

- response shape:
  HTTP 204 No Content (no response body).

- notes:
  硬删除预约。管理员可以删除任何预约，普通用户只能删除自己的预约。

### `GET /v1/bookings/stats/summary`

- method: `GET`
- path: `/v1/bookings/stats/summary`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:

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

- notes:
  管理员专用统计端点。返回预约相关的统计数据。

## Services

### `GET /v1/services`

- method: `GET`
- path: `/v1/services`
- auth required?: `Yes`
- request shape:
  No request body.

- response shape:

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

- notes:
  Shared service list endpoint used by booking flows.

### `GET /v1/services/all`

- method: `GET`
- path: `/v1/services/all`
- auth required?: `Yes`
- request shape:
  Query params may include `name`, `description`, `durationMinutes`, `price`, `imageUrl`, `categoryId`, `isActive`, `displayOrder`, `page`, and `limit`.

- response shape:

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

- notes:
  Admin-oriented service list endpoint with pagination and filtering support.

### `POST /v1/services/admin`

- method: `POST`
- path: `/v1/services/admin`
- auth required?: `Yes` (Admin only)
- request shape:

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

- response shape:

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

- notes:
  管理员创建新服务。

### `PATCH /v1/services/admin/:id`

- method: `PATCH`
- path: `/v1/services/admin/:id`
- auth required?: `Yes` (Admin only)
- request shape:

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

- response shape:

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

- notes:
  管理员更新服务信息。

### `PATCH /v1/services/admin/:id/status`

- method: `PATCH`
- path: `/v1/services/admin/:id/status`
- auth required?: `Yes` (Admin only)
- request shape:

```json
{
  "isActive": false
}
```

- response shape:

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

- notes:
  管理员切换服务启用状态。

## Time Slots

### `GET /v1/time-slots`

- method: `GET`
- path: `/v1/time-slots`
- auth required?: `No`
- request shape:
  Query params may include `slotTime`, `isActive`, `minDuration`, `maxDuration`, `page`, and `limit`.

- response shape:

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

- notes:
  General time-slot listing endpoint.

### `GET /v1/time-slots/available-slots?date=YYYY-MM-DD`

- method: `GET`
- path: `/v1/time-slots/available-slots`
- auth required?: `No`
- request shape:

```text
?date=YYYY-MM-DD
```

- response shape:

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

- notes:
  Primary time-slot availability endpoint for this branch.
  `date` must be passed in `YYYY-MM-DD` format.

### `POST /v1/time-slots`

- method: `POST`
- path: `/v1/time-slots`
- auth required?: `Yes` (Admin only)
- request shape:

```json
{
  "slotTime": "09:00:00",
  "durationMinutes": 30,
  "isActive": true
}
```

- response shape:

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

- notes:
  管理员创建新时间段。

### `GET /v1/time-slots/:id`

- method: `GET`
- path: `/v1/time-slots/:id`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:

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

- notes:
  管理员获取单个时间段详情。

### `PATCH /v1/time-slots/:id`

- method: `PATCH`
- path: `/v1/time-slots/:id`
- auth required?: `Yes` (Admin only)
- request shape:

```json
{
  "slotTime": "10:00:00",
  "durationMinutes": 60,
  "isActive": false
}
```

- response shape:

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

- notes:
  管理员更新时间段信息。

### `DELETE /v1/time-slots/:id`

- method: `DELETE`
- path: `/v1/time-slots/:id`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:
  HTTP 204 No Content (no response body).

- notes:
  管理员删除时间段。

## Users

### `POST /v1/users`

- method: `POST`
- path: `/v1/users`
- auth required?: `Yes` (Admin only)
- request shape:

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

- response shape:

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

- notes:
  管理员创建新用户。

### `GET /v1/users`

- method: `GET`
- path: `/v1/users`
- auth required?: `Yes` (Admin only)
- request shape:
  Query params may include `name`, `phoneNumber`, `email`, `role`, `status`, `page`, `limit`.

- response shape:

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

- notes:
  管理员获取用户列表。

### `GET /v1/users/profile/me`

- method: `GET`
- path: `/v1/users/profile/me`
- auth required?: `Yes`
- request shape:
  No request body.

- response shape:

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

- notes:
  获取当前认证用户的完整个人资料。

### `GET /v1/users/statistics`

- method: `GET`
- path: `/v1/users/statistics`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:

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

- notes:
  管理员获取用户统计数据。

### `GET /v1/users/:id`

- method: `GET`
- path: `/v1/users/:id`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:

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

- notes:
  管理员获取单个用户详情。

### `PUT /v1/users/:id/status`

- method: `PUT`
- path: `/v1/users/:id/status`
- auth required?: `Yes` (Admin only)
- request shape:

```json
{
  "status": "INACTIVE"
}
```

- response shape:

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

- notes:
  管理员更新用户状态。

### `PUT /v1/users/:id`

- method: `PUT`
- path: `/v1/users/:id`
- auth required?: `Yes` (Admin only)
- request shape:

```json
{
  "name": "Bob Updated",
  "email": "bob.updated@example.com",
  "role": "ADMIN",
  "remarks": "更新备注"
}
```

- response shape:

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

- notes:
  管理员更新用户信息。

### `DELETE /v1/users/:id`

- method: `DELETE`
- path: `/v1/users/:id`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:
  HTTP 204 No Content (no response body).

- notes:
  管理员删除用户。

## System

### `GET /v1/system/settings`

- method: `GET`
- path: `/v1/system/settings`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:

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

- notes:
  获取系统配置设置。

### `PATCH /v1/system/settings/:key`

- method: `PATCH`
- path: `/v1/system/settings/:key`
- auth required?: `Yes` (Admin only)
- request shape:

```json
{
  "value": "newValue"
}
```

- response shape:

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

- notes:
  更新特定系统设置。

### `GET /v1/system/reports/statistics`

- method: `GET`
- path: `/v1/system/reports/statistics`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:

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

- notes:
  获取系统整体统计报告。

### `GET /v1/system/reports/user-statistics`

- method: `GET`
- path: `/v1/system/reports/user-statistics`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:

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

- notes:
  获取用户活动统计报告。

## File Upload

### `POST /v1/upload/single`

- method: `POST`
- path: `/v1/upload/single`
- auth required?: `Yes`
- request shape:
  Multipart form-data with field `file` (file upload).

- response shape:

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

- notes:
  单文件上传端点。

### `POST /v1/upload/multiple`

- method: `POST`
- path: `/v1/upload/multiple`
- auth required?: `Yes`
- request shape:
  Multipart form-data with field `files` (multiple file upload).

- response shape:

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

- notes:
  多文件上传端点。

### `POST /v1/upload/avatar`

- method: `POST`
- path: `/v1/upload/avatar`
- auth required?: `Yes`
- request shape:
  Multipart form-data with field `avatar` (image file).

- response shape:

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

- notes:
  用户头像上传专用端点。

### `GET /v1/upload/stats`

- method: `GET`
- path: `/v1/upload/stats`
- auth required?: `Yes` (Admin only)
- request shape:
  No request body.

- response shape:

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

- notes:
  管理员获取文件上传统计数据。

## Notifications

### `GET /v1/notifications`

- method: `GET`
- path: `/v1/notifications`
- auth required?: `Yes`
- request shape:
  Query params may include `type`, `read`, `page`, `limit`.

- response shape:

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

- notes:
  获取当前用户的通知列表。

### `PUT /v1/notifications/:id/read`

- method: `PUT`
- path: `/v1/notifications/:id/read`
- auth required?: `Yes`
- request shape:
  No request body.

- response shape:

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

- notes:
  将通知标记为已读。

### `PUT /v1/notifications/read-all`

- method: `PUT`
- path: `/v1/notifications/read-all`
- auth required?: `Yes`
- request shape:
  No request body.

- response shape:

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

- notes:
  将当前用户的所有通知标记为已读。

### `GET /v1/notifications/unread-count`

- method: `GET`
- path: `/v1/notifications/unread-count`
- auth required?: `Yes`
- request shape:
  No request body.

- response shape:

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

- notes:
  获取当前用户的未读通知数量。

### WebSocket 连接

1. 连接 URL: `ws://localhost:3001/v1/notifications/ws`
2. 认证: 通过 `access_token` cookie 或查询参数 `token` 认证
3. 消息类型:
   - `notification`: 新通知推送
   - `booking_update`: 预约状态更新
   - `system_alert`: 系统告警

- notes:
  实时通知通过 WebSocket 推送。

## Health

### `GET /v1/health`

- method: `GET`
- path: `/v1/health`
- auth required?: `No`
- request shape:
  No request body.

- response shape:

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

- notes:
  服务健康检查端点。返回数据库、Redis等依赖服务的连接状态。
