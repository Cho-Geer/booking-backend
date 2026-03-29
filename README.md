# Booking System Backend

Backend API for a booking / customer operations system built with **NestJS**, **PostgreSQL**, and **Redis**.

This branch focuses on:
- a cleaner environment setup
- standardized API responses for core business modules
- cookie-based authentication with refresh flow
- booking / service / time-slot / user management
- scheduled retention cleanup for old booking records

---

## Overview

This backend powers a booking platform with both **customer-facing flows** and **admin-facing management APIs**.

At a high level, the system provides:

- phone-based authentication with verification codes
- booking creation, update, cancellation, and reporting
- service catalog management
- time-slot management and availability lookup
- user management for admin operations
- file upload endpoints
- system settings and report endpoints
- optional real-time communication via WebSocket
- scheduled retention cleanup for old completed / cancelled records

---

## Tech Stack

### Core
- NestJS
- TypeScript

### Data
- PostgreSQL
- Prisma ORM

### Cache / Session / Security
- Redis
- JWT
- cookie-based auth flow
- optional CSRF protection

### API / Realtime / Background Jobs
- Swagger
- Socket.IO / WebSocket gateway
- `@nestjs/schedule`

### File Handling
- Multer

### Testing / Tooling
- Jest
- ESLint
- Prettier
- Docker Compose

---

## Current Module Structure

```text
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── database/
│   ├── file-upload/
│   ├── middleware/
│   ├── prisma/
│   ├── websocket/
│   └── ...
├── modules/
│   ├── auth/
│   ├── bookings/
│   ├── email/
│   ├── prisma/
│   ├── retention/
│   ├── services/
│   ├── system/
│   ├── time-slots/
│   └── users/
└── scripts/
    └── run-retention.ts
Core Capabilities
1. Authentication

The auth module is built around phone number + verification code instead of password login.

Supported flows include:

register
login
send verification code
refresh access token
logout
verify current token
get current profile
check whether a phone number already exists

Authentication behavior:

access token and refresh token are stored in cookies
a csrf_token cookie is also issued
refresh flow can read the refresh token from cookie or request body
logout adds both access and refresh tokens to a Redis-backed blacklist
verification codes are stored in Redis

Note: in the current implementation, SMS delivery is still a local-development style flow.
Verification codes are generated and stored in Redis, and the actual SMS provider integration is marked as TODO.

2. Booking Management

The booking module supports the main business flow of the system.

Supported operations:

create booking
list bookings with query conditions
query all bookings for a specific date
get booking details
update booking
cancel booking
booking statistics summary

Typical use cases:

users manage their own bookings
admins can view wider datasets and statistics
booking records are connected to users, services, and time slots
3. Service Management

The service module manages the list of bookable services.

Supported operations:

get service list
admin list view
create service (admin)
update service (admin)
toggle service active status (admin)
4. Time Slot Management

The time-slot module manages available booking slots.

Supported operations:

create time slot (admin)
get time-slot list
get availability for a given date
get time-slot detail
update time slot (admin)
delete time slot (admin)
5. User Management

The user module provides admin-facing user management features.

Supported operations include:

create user
list users with filters and pagination
get user detail
update user info
change user status
delete user
get current user profile
get user statistics
6. System / Reports

The system module provides:

public system settings
admin setting updates
booking statistics reports
admin user statistics reports
7. File Upload

Authenticated upload endpoints are included for:

single file upload
multiple file upload
avatar upload
file stats
file existence check
file info lookup
file deletion
8. Retention Cleanup

A retention module is included to remove old booking records that are already:

CANCELLED
COMPLETED

It supports:

scheduled execution via cron
dry-run mode
manual execution via script
configurable batch size / retention window / sleep interval
9. WebSocket Gateway

A WebSocket gateway is included under the /ws namespace.

It supports:

authenticated socket connection
notification subscription
simple message handling
online user tracking
direct / broadcast notification emission

This is currently a secondary capability compared with the main REST API flow.

Data Model Overview

The Prisma schema currently includes core entities such as:

User
UserSession
Appointment
AppointmentHistory
TimeSlot
Service
ServiceCategory
Notification
SystemSetting
BlockedTimeSlot
ActivityLog
SystemLog
AppointmentStatistic

This makes the backend closer to a small operations platform than a simple CRUD demo.

API Conventions
Base URL

All HTTP APIs are served under:

/v1

Examples:

POST /v1/auth/login
POST /v1/bookings
GET /v1/services
GET /v1/time-slots/available-slots?date=2026-03-29
Swagger

Swagger UI is available at:

/api/docs
Response Shape

Core business controllers use a shared response wrapper pattern:

{
  "code": 200,
  "message": "success",
  "data": {}
}

A response-time header is also added by the transform interceptor where applied.

Example API Surface
Auth
POST /v1/auth/login
POST /v1/auth/register
POST /v1/auth/send-verification-code
POST /v1/auth/refresh
POST /v1/auth/logout
GET /v1/auth/profile
GET /v1/auth/verify
GET /v1/auth/check-phone
Bookings
POST /v1/bookings
GET /v1/bookings/all
GET /v1/bookings/by-date
GET /v1/bookings/stats/summary
GET /v1/bookings/:id
PATCH /v1/bookings/:id
DELETE /v1/bookings/:id
PATCH /v1/bookings/:id/cancel
Services
GET /v1/services
GET /v1/services/all
POST /v1/services/admin
PATCH /v1/services/admin/:id
PATCH /v1/services/admin/:id/status
Time Slots
POST /v1/time-slots
GET /v1/time-slots
GET /v1/time-slots/available-slots
GET /v1/time-slots/:id
PATCH /v1/time-slots/:id
DELETE /v1/time-slots/:id
Users
POST /v1/users
GET /v1/users
GET /v1/users/:id
PUT /v1/users/:id/status
PUT /v1/users/:id
DELETE /v1/users/:id
GET /v1/users/profile/me
GET /v1/users/statistics
System
GET /v1/system/settings
PATCH /v1/system/settings/:key
GET /v1/system/reports/statistics
GET /v1/system/reports/user-statistics
Upload
POST /v1/upload/single
POST /v1/upload/multiple
POST /v1/upload/avatar
GET /v1/upload/stats
GET /v1/upload/exists/:filename
GET /v1/upload/info/:filename
DELETE /v1/upload/:filename
Getting Started
1. Clone the repository
git clone https://github.com/Cho-Geer/booking-backend.git
cd booking-backend
git checkout refactor/unify-api-response-and-env
2. Install dependencies
npm install
3. Start infrastructure (PostgreSQL + Redis)
docker compose up -d
4. Create your local environment file

Because the current Nest config loads environment files from .env.development and .env.production,
copy the example file into .env.development for local development:

cp .env.example .env.development

Then update at least:

DATABASE_URL
JWT_SECRET
JWT_REFRESH_SECRET
FRONTEND_URL / FRONTEND_URLS
Redis connection values if needed
5. Initialize database
npm run db:init

This runs:

Prisma client generation
migrations
seed script
6. Start the backend
npm run start:dev

The backend will be available at:

http://localhost:3001

Swagger UI:

http://localhost:3001/api/docs
Environment Notes

Key environment variables include:

App / API
NODE_ENV
PORT
FRONTEND_URL
FRONTEND_URLS
CSRF_ENABLED
COOKIE_SAME_SITE
COOKIE_DOMAIN
Database
DATABASE_URL
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_NAME
Redis
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
JWT
JWT_SECRET
JWT_EXPIRES_IN
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN
Upload
UPLOAD_DIR
MAX_FILE_SIZE
UPLOAD_BASE_URL
ALLOWED_MIME_TYPES
Mail / SMS (optional)
MAIL_HOST
MAIL_PORT
MAIL_USERNAME
MAIL_PASSWORD
MAIL_FROM
SMS_ACCESS_KEY_ID
SMS_ACCESS_KEY_SECRET
SMS_REGION
SMS_SIGN_NAME
SMS_TEMPLATE_CODE
Retention
RETENTION_ENABLED
RETENTION_DRY_RUN
RETENTION_DAYS
RETENTION_BATCH_SIZE
RETENTION_BATCH_SLEEP_MS
RETENTION_CRON
Useful Scripts
App
npm run start:dev
npm run build
npm run start:prod
Test
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
Prisma
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:studio
npm run prisma:seed
npm run db:reset
npm run db:init
Retention
npm run retention:dry-run
npm run retention:run-once
Local Development Notes
Verification Codes

For local development, verification codes are stored in Redis and logged by the backend in non-production mode.
This is useful for testing login / register flows before a real SMS provider is integrated.

CORS

The backend supports multiple frontend origins via:

FRONTEND_URLS=http://localhost:3000,http://localhost:3005
CSRF

If CSRF_ENABLED=true, unsafe methods are checked against the csrf_token cookie and x-csrf-token header.
Some auth endpoints are intentionally bypassed:

/auth/login
/auth/register
/auth/send-verification-code
/auth/refresh
What This Branch Improves

This branch is aimed at making the backend easier to run and easier to integrate by:

cleaning up environment handling
aligning API behavior around a common response wrapper
keeping auth cookies / refresh flow explicit
separating business modules more clearly
adding retention tooling for old booking data
Known Gaps / Next Steps

A few things are still clearly development-stage:

SMS delivery is not fully integrated yet
some secondary modules are less production-polished than the core auth / booking flow
WebSocket notifications exist, but the main business path is still REST-first
this repository is backend-only and should be paired with the frontend project for end-to-end demo
License

MIT


必要なら次にそのまま続けて、  
**この README をあなたの branch の実装にさらに合わせた「短め版」** か、**中国語 / 日本語版** に整えます。
::contentReference[oaicite:1]{index=1}