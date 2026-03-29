# API Contract

This document is the current single source of truth for the frontend/backend API contract in this branch.

All paths below are relative to the backend global prefix `/v1`.

## Shared Response Envelope

Most successful endpoints are wrapped in the backend `ApiResponseDto` shape:

```json
{
  "code": 200,
  "message": "Operation succeeded",
  "data": {},
  "requestId": "req_xxx",
  "timestamp": "2026-03-29T00:00:00.000Z"
}
```

Many list endpoints return `data.items`, `data.total`, `data.page`, `data.limit`, and `data.totalPages`.

## Auth

### Login

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
  Login uses phone number plus verification code.
  The backend also sets `access_token`, `refresh_token`, and `csrf_token` cookies.

### Register

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

### Send Verification Code

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
  `type` is one of `login` or `register`.

### Refresh Token

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
  Backend prefers the `refresh_token` cookie when present and falls back to `body.refreshToken`.

### Logout

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
  Backend clears `access_token`, `refresh_token`, and `csrf_token` cookies.

### Get Profile

- method: `GET`
- path: `/v1/auth/profile`
- auth required?: `Yes`
- request shape:
  No body.

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
    "createdAt": "2026-03-29T00:00:00.000Z",
    "updatedAt": "2026-03-29T00:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- notes:
  Current frontend auth bootstrap should treat this as the canonical current-user endpoint.

### Verify Token

- method: `GET`
- path: `/v1/auth/verify`
- auth required?: `Yes`
- request shape:
  No body.

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

### Create Booking

- method: `POST`
- path: `/v1/bookings`
- auth required?: `Yes`
- request shape:

```json
{
  "timeSlotId": "uuid",
  "userId": "uuid",
  "serviceId": "uuid",
  "appointmentDate": "2026-03-29",
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
    "appointmentNumber": "AP-20260329-0001",
    "timeSlotId": "uuid",
    "userId": "uuid",
    "appointmentDate": "2026-03-29T00:00:00.000Z",
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
    "createdAt": "2026-03-29T00:00:00.000Z",
    "updatedAt": "2026-03-29T00:00:00.000Z"
  },
  "requestId": "req_xxx",
  "timestamp": "..."
}
```

- notes:
  If `userId` is omitted, backend fills it from `currentUser.id`.

### List Bookings

- method: `GET`
- path: `/v1/bookings/all`
- auth required?: `Yes`
- request shape:
  Query params may include `userId`, `timeSlotId`, `status`, `customerName`, `customerPhone`, `startDate`, `endDate`, `page`, `limit`, `keyword`.

- response shape:

```json
{
  "items": [
    {
      "id": "uuid",
      "appointmentNumber": "AP-20260329-0001",
      "timeSlotId": "uuid",
      "userId": "uuid",
      "appointmentDate": "2026-03-29T00:00:00.000Z",
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
  `/bookings/all` is shared by both user and admin clients.
  Non-admin users are narrowed to the current user by backend logic even if a broader query is sent.
  `/bookings/me` is not adopted in this branch.

### List Bookings By Date

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
      "appointmentNumber": "AP-20260329-0001",
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
  Non-admin users are also filtered to their own records here.

### Get Booking Detail

- method: `GET`
- path: `/v1/bookings/:id`
- auth required?: `Yes`
- request shape:
  No body.

- response shape:
  Returns a single booking object shaped like `AppointmentResponseDto`.

- notes:
  Non-admin users can only access their own booking.

### Update Booking

- method: `PATCH`
- path: `/v1/bookings/:id`
- auth required?: `Yes`
- request shape:

```json
{
  "status": "CONFIRMED",
  "appointmentDate": "2026-03-30",
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
  Success envelope with a single updated booking in `data`.

- notes:
  Non-admin users can only update their own booking.

### Cancel Booking

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

### Public/Shared Service List

- method: `GET`
- path: `/v1/services`
- auth required?: `Yes`
- request shape:
  No body.

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
  This endpoint is the minimum shared service list endpoint for user flows.

### Admin Service List

- method: `GET`
- path: `/v1/services/all`
- auth required?: `Yes`
- request shape:
  Query params may include `name`, `description`, `durationMinutes`, `price`, `imageUrl`, `categoryId`, `isActive`, `displayOrder`, `page`, `limit`.

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
  Admin only endpoint.

## Time Slots

### List Time Slots

- method: `GET`
- path: `/v1/time-slots`
- auth required?: `No`
- request shape:
  Query params may include `slotTime`, `isActive`, `minDuration`, `maxDuration`, `page`, `limit`.

- response shape:
  Returns a list/paginated set of time slots from the time-slot service.

- notes:
  Used for general time-slot browsing and admin tooling.

### Get Available Slots For Date

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
  This is the minimum required time-slot availability endpoint for the branch.
  `date` must be in `YYYY-MM-DD` format.
