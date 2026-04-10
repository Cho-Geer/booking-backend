# Windows PowerShell script to build Docker images locally
# This script simulates the GitHub Actions backend-image.yml workflow (PR mode)

Write-Host "=== Local Docker Build Simulation ===" -ForegroundColor Cyan
Write-Host "This script simulates the PR build mode from GitHub Actions" -ForegroundColor Yellow

# Configuration
$IMAGE_NAME = "booking-backend"
$LOCAL_TEST_IMAGE = "booking-backend:test"
$PLATFORM = "linux/amd64"

Write-Host "`nConfiguration:" -ForegroundColor Cyan
Write-Host "  Image name: $LOCAL_TEST_IMAGE"
Write-Host "  Platform: $PLATFORM"
Write-Host ""

# Step 1: Check if Docker is running
Write-Host "1. Checking Docker environment..." -ForegroundColor Yellow
docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker is not running" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker is running" -ForegroundColor Green

# Step 2: Set up Docker Buildx
Write-Host "`n2. Setting up Docker Buildx..." -ForegroundColor Yellow
docker buildx inspect default | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating new Buildx builder..."
    docker buildx create --use
} else {
    Write-Host "Using existing Buildx builder"
}
Write-Host "✓ Docker Buildx is ready" -ForegroundColor Green

# Step 3: Build the main backend image (single platform, load locally)
Write-Host "`n3. Building main backend image..." -ForegroundColor Yellow
Write-Host "   This may take several minutes..." -ForegroundColor Gray

docker buildx build `
    --file ./Dockerfile `
    --tag $LOCAL_TEST_IMAGE `
    --platform $PLATFORM `
    --load `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker build successful" -ForegroundColor Green

# Step 4: Verify the image
Write-Host "`n4. Verifying image..." -ForegroundColor Yellow
docker images $LOCAL_TEST_IMAGE
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Image verification failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Image is available locally" -ForegroundColor Green

# Step 5: Run basic test (similar to GitHub Actions)
Write-Host "`n5. Running basic test..." -ForegroundColor Yellow
Write-Host "   Starting test container..." -ForegroundColor Gray

# Clean up any existing container
docker stop backend-test 2&gt;$null | Out-Null
docker rm backend-test 2&gt;$null | Out-Null

# Start the test container
docker run -d `
    --name backend-test `
    -p 3001:3001 `
    $LOCAL_TEST_IMAGE

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to start test container" -ForegroundColor Red
    exit 1
}

Write-Host "   Waiting for container to be ready..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# Check health endpoint
Write-Host "   Checking health endpoint..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/v1/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Health check passed" -ForegroundColor Green
    } else {
        Write-Host "✗ Health check failed with status: $($response.StatusCode)" -ForegroundColor Red
        docker logs backend-test
        exit 1
    }
} catch {
    Write-Host "✗ Health check failed: $