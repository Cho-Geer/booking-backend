# Windows PowerShell script to run backend CI locally using Docker containers
# This script simulates the GitHub Actions backend-ci.yml workflow

Write-Host "=== Backend CI Local Simulation ===" -ForegroundColor Cyan
Write-Host "Starting PostgreSQL and Redis containers..." -ForegroundColor Yellow

# Start infrastructure services
docker-compose -f docker-compose.yml up -d postgres redis

# Wait for services to be healthy
Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow
$maxRetries = 30
$retryCount = 0
$servicesReady = $false

while ($retryCount -lt $maxRetries -and -not $servicesReady) {
    $postgresHealth = docker-compose -f docker-compose.yml ps --filter "health=healthy" --services | Select-String "postgres"
    $redisHealth = docker-compose -f docker-compose.yml ps --filter "health=healthy" --services | Select-String "redis"
    
    if ($postgresHealth -and $redisHealth) {
        $servicesReady = $true
        Write-Host "✓ All services are healthy" -ForegroundColor Green
    } else {
        $retryCount++
        Write-Host "Waiting for services... ($retryCount/$maxRetries)"
        Start-Sleep -Seconds 2
    }
}

if (-not $servicesReady) {
    Write-Host "✗ Services failed to start within timeout" -ForegroundColor Red
    docker-compose -f docker-compose.yml logs
    docker-compose -f docker-compose.yml down
    exit 1
}

Write-Host "`n=== Running Quality Gate ===" -ForegroundColor Cyan

# Quality Gate - Backend checks
Write-Host "1. Installing backend dependencies..." -ForegroundColor Yellow
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Backend dependency installation failed" -ForegroundColor Red
    docker-compose -f docker-compose.yml down
    exit 1
}

Write-Host "2. Running Prisma generate..." -ForegroundColor Yellow
npm run prisma:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Prisma generate failed" -ForegroundColor Red
    docker-compose -f docker-compose.yml down
    exit 1
}

Write-Host "3. Running linting..." -ForegroundColor Yellow
npm run lint:check
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Linting failed" -ForegroundColor Red
    docker-compose -f docker-compose.yml down
    exit 1
}

Write-Host "4. Running type checking..." -ForegroundColor Yellow
npm run typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Type checking failed" -ForegroundColor Red
    docker-compose -f docker-compose.yml down
    exit 1
}

Write-Host "5. Running unit tests..." -ForegroundColor Yellow
npm run test -- --runInBand
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Unit tests failed" -ForegroundColor Red
    docker-compose -f docker-compose.yml down
    exit 1
}

Write-Host "6. Building backend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Backend build failed" -ForegroundColor Red
    docker-compose -f docker-compose.yml down
    exit 1
}

Write-Host "✓ Quality Gate passed" -ForegroundColor Green

Write-Host "`n=== Running Integration Gate ===" -ForegroundColor Cyan

# Integration Gate - Database setup and E2E tests
Write-Host "1. Running Prisma migrate deploy..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://postgres:5382@localhost:5432/booking_system"
$env:REDIS_HOST = "localhost"
$env:REDIS_PORT = "6379"
npm run prisma:deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Prisma migrate failed" -ForegroundColor Red
    docker-compose -f docker-compose.yml down
    exit 1
}

Write-Host "2. Running Prisma seed..." -ForegroundColor Yellow
npm run prisma:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Prisma seed failed" -ForegroundColor Red
    docker-compose -f docker-compose.yml down
    exit 1
}

Write-Host "3. Running E2E tests..." -ForegroundColor Yellow
$env:NODE_ENV = "development"
$env:PORT = "3001"
$env:API_PREFIX = "/v1"
$env:JWT_SECRET = "ci-only-secret"
$env:JWT_EXPIRES_IN = "3600"
npm run test:e2e -- --runInBand
$e2eExitCode = $LASTEXITCODE

# Cleanup
Write-Host "`n=== Cleaning up ===" -ForegroundColor Cyan
docker-compose -f docker-compose.yml down

if ($e2eExitCode -eq 0) {
    Write-Host "`n=== CI Simulation Complete ===" -ForegroundColor Green
    Write-Host "✓ All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n=== CI Simulation Failed ===" -ForegroundColor Red
    Write-Host "✗ E2E tests failed with exit code $e2eExitCode" -ForegroundColor Red
    exit $e2eExitCode
}
