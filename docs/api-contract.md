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
