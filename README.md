# CRM Booking Platform Backend

NestJS based backend for a CRM style booking platform.

This service provides authentication, booking management, user and service administration, time slot management, Redis backed caching, Swagger docs, and WebSocket based real time notifications.

Detailed endpoint contract: [docs/api-contract.md](./docs/api-contract.md)

## Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM
- Redis
- Swagger
- Jest

## Current Modules

The application currently wires these modules in [src/app.module.ts](./src/app.module.ts):

- `auth`
- `users`
- `bookings`
- `services`
- `time-slots`
- `email`
- `retention`
- `common/database`
- `common/prisma`
- `common/file-upload`
- `common/websocket`

## API Overview

The app starts with the global prefix `v1`, so routes are exposed under `/v1/...`.

Examples of implemented routes:

- `POST /v1/auth/login`
- `POST /v1/auth/register`
- `POST /v1/auth/send-verification-code`
- `POST /v1/auth/refresh`
- `GET /v1/auth/profile`
- `GET /v1/auth/verify`
- `GET /v1/bookings/all`
- `GET /v1/bookings/by-date`
- `POST /v1/bookings`
- `PATCH /v1/bookings/:id`
- `PATCH /v1/bookings/:id/cancel`
- `GET /v1/services`
- `GET /v1/services/all`
- `POST /v1/services/admin`
- `GET /v1/time-slots`
- `GET /v1/time-slots/available-slots`
- `GET /v1/users/profile/me`
- `GET /v1/users/statistics`
- `GET /v1/system/settings`

Swagger UI is available at `/api/docs`.

## Runtime Features

- JWT based auth with access and refresh tokens
- Auth cookies plus CSRF token cookie support
- Role and permission guarded routes
- Booking CRUD and booking statistics
- Service management for admins
- Time slot availability queries
- User management and profile APIs
- Redis cache configuration
- WebSocket gateway support
- Email module with Handlebars templates
- Scheduled retention jobs
- File upload module

## Data Model

The Prisma schema currently includes these main models:

- `User`
- `UserSession`
- `Appointment`
- `AppointmentHistory`
- `TimeSlot`
- `Service`
- `ServiceCategory`
- `Notification`
- `SystemSetting`
- `BlockedTimeSlot`
- `ActivityLog`
- `SystemLog`
- `AppointmentStatistic`

See [prisma/schema.prisma](./prisma/schema.prisma) for the full schema.

## Environment

Example env files are included:

- `.env.example`
- `.env.production.example`

Do not commit real environment files with secrets.

Important variables include:

- `PORT`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL` or `FRONTEND_URLS`
- `CSRF_ENABLED`

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run start:dev
```

Build for production:

```bash
npm run build
```

Start the built app:

```bash
npm run start:prod
```

## Database Commands

Useful Prisma scripts:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:seed
npm run db:init
```

## Testing

Run unit tests:

```bash
npm run test
```

Run coverage:

```bash
npm run test:cov
```

Run e2e tests:

```bash
npm run test:e2e
```

## Docker

The included [docker-compose.yml](./docker-compose.yml) starts infrastructure services only:

- PostgreSQL
- Redis

Start them with:

```bash
docker-compose up -d
```

The NestJS API itself is started separately with the npm scripts above.
