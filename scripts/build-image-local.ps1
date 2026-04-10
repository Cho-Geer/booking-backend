# Windows PowerShell script to build Docker images locally
# This script simulates the GitHub Actions backend-image.yml workflow (PR mode)

Write-Host "=== Backend Docker Image Local Build ===" -ForegroundColor Cyan

# Configuration
$LOCAL_TEST_IMAGE = "booking-backend:test"
$DOCKERFILE = "./Dockerfile"
$PLATFORM = "linux/amd64"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Test image: $LOCAL_TEST_IMAGE"
Write-Host "  Dockerfile: $DOCKERFILE"
Write-Host "  Platform: $PLATFORM"

# Check if Docker is running
Write-Host "`nChecking Docker..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    docker ps | Out-Null
    $dockerRunning = $true
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running" -ForegroundColor Red
    exit 1
}

# Check if Docker Buildx is available
Write-Host "`nChecking Docker Buildx..." -ForegroundColor Yellow
try {
    docker buildx version | Out-Null
    Write-Host "✓ Docker Buildx is available" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker Buildx is not available" -ForegroundColor Red
    exit 1
}

# Build main backend image (single platform, load locally)
Write-Host "`nBuilding main backend image..." -ForegroundColor Cyan
Write-Host "This simulates the PR build step in GitHub Actions" -ForegroundColor Gray

$buildCommand = @(
    "docker", "buildx", "build",
    "--file", $DOCKERFILE,
    "--tag", $LOCAL_TEST_IMAGE,
    "--platform", $PLATFORM,
    "--load",
    "."
)

Write-Host "Running: $($buildCommand -join ' ')" -ForegroundColor Gray
& $buildCommand[0] $buildCommand[1..($buildCommand.Length-1)]

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n✗ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✓ Build succeeded" -ForegroundColor Green

# Verify the image was created
Write-Host "`nVerifying image..." -ForegroundColor Yellow
docker images --filter "reference=$LOCAL_TEST_IMAGE" --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Image verification failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✓ Image $LOCAL_TEST_IMAGE is ready" -ForegroundColor Green

# Test the image (optional)
Write-Host "`n=== Optional: Test the image ===" -ForegroundColor Cyan
$testImage = Read-Host "Do you want to test the image? (Y/N)"

if ($testImage -eq "Y" -or $testImage -eq "y") {
    Write-Host "`nStarting test container..." -ForegroundColor Yellow
    
    # Cleanup any existing container
    docker stop backend-test 2>$null | Out-Null
    docker rm backend-test 2>$null | Out-Null
    
    # Start the container
    docker run -d --name backend-test -p 3001:3001 $LOCAL_TEST_IMAGE
    
    Write-Host "Waiting 10 seconds for container to start..." -ForegroundColor Gray
    Start-Sleep -Seconds 10
    
    # Check health endpoint
    Write-Host "`nChecking health endpoint..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/v1/health" -UseBasicParsing -TimeoutSec 5
        Write-Host "✓ Health check passed: $($response.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "✗ Health check failed" -ForegroundColor Red
        Write-Host "Container logs:" -ForegroundColor Gray
        docker logs backend-test
    }
    
    # Cleanup
    Write-Host "`nCleaning up..." -ForegroundColor Cyan
    docker stop backend-test | Out-Null
    docker rm backend-test | Out-Null
    Write-Host "✓ Cleanup complete" -ForegroundColor Green
}

Write-Host "`n=== Build Complete ===" -ForegroundColor Green
Write-Host "To use the image: docker run -p 3001:3001 $LOCAL_TEST_IMAGE" -ForegroundColor Cyan
