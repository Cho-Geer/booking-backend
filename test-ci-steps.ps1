# Test script to verify individual CI steps

Write-Host "=== Testing CI Steps ===" -ForegroundColor Cyan

# Step 1: Start services
Write-Host "`n1. Starting PostgreSQL and Redis..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml up -d postgres redis
Start-Sleep -Seconds 5

# Step 2: Check services
Write-Host "`n2. Checking services..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml ps

# Step 3: Install dependencies
Write-Host "`n3. Installing dependencies..." -ForegroundColor Yellow
npm ci

# Step 4: Prisma generate
Write-Host "`n4. Prisma generate..." -ForegroundColor Yellow
npm run prisma:generate

# Step 5: Lint check
Write-Host "`n5. Lint check..." -ForegroundColor Yellow
npm run lint:check

# Step 6: Typecheck
Write-Host "`n6. Type check..." -ForegroundColor Yellow
npm run typecheck

# Step 7: Unit tests
Write-Host "`n7. Unit tests..." -ForegroundColor Yellow
npm run test -- --runInBand

# Step 8: Build
Write-Host "`n8. Build..." -ForegroundColor Yellow
npm run build

# Cleanup
Write-Host "`nCleaning up..." -ForegroundColor Cyan
docker-compose -f docker-compose.yml down

Write-Host "`n=== Test Complete ===" -ForegroundColor Green
