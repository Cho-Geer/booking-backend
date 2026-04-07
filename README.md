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

The application currently wires these modules in [src/app.module.ts](./src/app.module.ts).

Business modules:

- `auth`
- `users`
- `bookings`
- `services`
- `time-slots`
- `email`
- `retention`

Shared infrastructure:

- `common/database`
- `common/prisma`
- `common/file-upload`
- `common/websocket`

## API Overview

The local backend runs at:

```text
http://localhost:3001
```

The app sets the global API prefix to `/v1`, so application endpoints are exposed under:

```text
http://localhost:3001/v1/...
```

Swagger UI is available at:

```text
http://localhost:3001/api/docs
```

### Main Contract For This Branch

These are the main endpoints reviewers and frontend work should treat as the current contract:

- `POST /v1/auth/login`
- `POST /v1/bookings`
- `GET /v1/bookings/all`
- `GET /v1/bookings/by-date?date=YYYY-MM-DD`
- `GET /v1/bookings/:id`
- `PATCH /v1/bookings/:id`
- `PATCH /v1/bookings/:id/cancel`
- `GET /v1/time-slots/available-slots?date=YYYY-MM-DD`
- `GET /v1/services`
- `GET /v1/services/all`

### Important Booking Rules

- `/bookings/all` is the shared list endpoint for both user and admin clients in this branch.
- For non-admin users, the backend narrows `/bookings/all` to the current authenticated user even if the incoming query is broader.
- `/bookings/me` is not adopted in this branch and should not be treated as part of the contract.

### Endpoint Notes

#### Auth

- `POST /v1/auth/login`
  Phone number plus verification code login.
  Returns login payload and sets auth cookies.

#### Bookings

- `POST /v1/bookings`
  Creates a booking for the authenticated user.
  If `userId` is omitted, backend fills it from the current user.

- `GET /v1/bookings/all`
  Shared user/admin list endpoint.
  Accepts booking query filters and pagination params.
  Non-admin users are restricted server-side to their own records.

- `GET /v1/bookings/by-date?date=YYYY-MM-DD`
  Returns bookings for a single date.
  Used for date-based availability and calendar style views.

- `GET /v1/bookings/:id`
  Returns a single booking by id.
  Non-admin users can only access their own booking.

- `PATCH /v1/bookings/:id`
  Updates a booking.
  Non-admin users can only update their own booking.

- `PATCH /v1/bookings/:id/cancel`
  Frontend-compatible cancel endpoint for this branch.

#### Time Slots

- `GET /v1/time-slots/available-slots?date=YYYY-MM-DD`
  Returns slot availability for a single day.
  `date` must be passed in `YYYY-MM-DD` format.

#### Services

- `GET /v1/services`
  Shared service list endpoint used by booking flows.

- `GET /v1/services/all`
  Admin-oriented service list endpoint with pagination/filtering support.

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

For local development, copy `.env.example` to `.env.development` and adjust values for your machine.

Do not commit real environment files with secrets.

Important variables include:

- `PORT`
- `API_PREFIX`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL` or `FRONTEND_URLS`
- `CSRF_ENABLED`

Environment notes:

- `PORT=3001` is the expected local backend port for this branch.
- `API_PREFIX=/v1` remains in the sample because runtime code still references `process.env.API_PREFIX` when mounting CSRF middleware.
- `/v1` is the API contract for this branch.
- `FRONTEND_URL` is the legacy single-origin CORS setting.
- `FRONTEND_URLS` is the multi-origin CORS allowlist for setups that need more than one allowed frontend origin.

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run start:dev
```

The default local frontend is expected at `http://localhost:3000`, and the backend API runs at `http://localhost:3001`.

Expected local URL:

```text
http://localhost:3001
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
docker compose up -d
```

The NestJS API itself is started separately with the npm scripts above.

## Docker Environment Setup for Testing

The E2E tests use TestContainers to run PostgreSQL containers. To run these tests locally, you need a working Docker environment.

### 1. Install Docker

#### Windows
1. Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. During installation, enable WSL 2 backend (recommended) or Hyper-V backend
3. Restart your computer after installation
4. Start Docker Desktop from the Start menu

#### macOS
1. Download and install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
2. Move Docker.app to Applications folder
3. Start Docker Desktop from Applications

#### Linux (Ubuntu/Debian)
```bash
# Uninstall old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up stable repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Verify Docker Installation

```bash
docker --version
docker info
docker run hello-world
```

### 3. Configure User Permissions (Linux/macOS)

Add your user to the `docker` group to avoid using `sudo`:

```bash
sudo usermod -aG docker $USER
# Log out and log back in for changes to take effect
```

### 4. Configure TestContainers Environment

TestContainers needs to detect Docker. Set environment variables:

#### Windows PowerShell
```powershell
$env:DOCKER_HOST = "npipe:////./pipe/docker_engine"
```

#### Linux/macOS Bash
```bash
export DOCKER_HOST=unix:///var/run/docker.sock
# Add to ~/.bashrc or ~/.zshrc for persistence
echo 'export DOCKER_HOST=unix:///var/run/docker.sock' >> ~/.bashrc
```

### 5. Verify TestContainers Configuration

Run a simple test to verify Docker integration:

```bash
# In the booking-backend directory
npm run test:e2e -- --testNamePattern="setup" --verbose
```

Alternatively, use the validation script to check Docker environment:

```powershell
# Run the validation script (Windows)
./scripts/check-docker-env.ps1

# Or for Linux/macOS, you can create a similar bash script
```

### 6. Troubleshooting Common Issues

#### "Could not find a working container runtime strategy"
- Ensure Docker Desktop is running (Windows/macOS)
- Ensure Docker service is started (Linux: `sudo systemctl status docker`)
- Verify `DOCKER_HOST` environment variable is set correctly
- Check user permissions (Linux: user should be in `docker` group)

#### "Permission denied while trying to connect to the Docker daemon socket"
```bash
# Linux/macOS
sudo usermod -aG docker $USER
# Log out and log back in
```

#### TestContainers timeout
- Configure Docker image accelerator for faster downloads (China users)
- Increase timeout in test configuration if needed

### 7. Alternative: Skip Docker Tests

If Docker is not available, you can skip E2E tests:

```bash
npm run test  # Runs unit tests only
```

For CI/CD environments, Docker-based tests will run automatically.
