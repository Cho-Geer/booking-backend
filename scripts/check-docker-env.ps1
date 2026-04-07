# Docker Environment Validation Script for TestContainers
# This script checks if Docker is properly installed and configured for TestContainers

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Docker Environment Validation Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Check Docker installation
Write-Host "`n1. Checking Docker installation..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Docker installed: $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Docker not found or not in PATH" -ForegroundColor Red
        Write-Host "   Please install Docker Desktop from https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Docker not found: $_" -ForegroundColor Red
}

# 2. Check Docker service status
Write-Host "`n2. Checking Docker service status..." -ForegroundColor Yellow
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Docker service is running" -ForegroundColor Green
        
        # Extract useful info
        $serverVersion = ($dockerInfo | Select-String "Server Version:").ToString().Split(":")[1].Trim()
        $containers = ($dockerInfo | Select-String "Containers:").ToString().Split(":")[1].Trim()
        $images = ($dockerInfo | Select-String "Images:").ToString().Split(":")[1].Trim()
        
        Write-Host "   - Server Version: $serverVersion" -ForegroundColor Gray
        Write-Host "   - Containers: $containers" -ForegroundColor Gray
        Write-Host "   - Images: $images" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Docker service is not running or not accessible" -ForegroundColor Red
        Write-Host "   Error: $dockerInfo" -ForegroundColor Red
        Write-Host "   Please start Docker Desktop" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Error checking Docker service: $_" -ForegroundColor Red
}

# 3. Check Docker Host environment variable
Write-Host "`n3. Checking DOCKER_HOST environment variable..." -ForegroundColor Yellow
$dockerHost = $env:DOCKER_HOST
if ($dockerHost) {
    Write-Host "   ✓ DOCKER_HOST is set: $dockerHost" -ForegroundColor Green
    
    # Validate DOCKER_HOST format
    if ($dockerHost -match "^npipe:////./pipe/docker_engine$") {
        Write-Host "   - Format is correct for Windows" -ForegroundColor Gray
    } elseif ($dockerHost -match "^unix://") {
        Write-Host "   - Format is correct for Linux/macOS" -ForegroundColor Gray
    } else {
        Write-Host "   - Warning: Unusual DOCKER_HOST format" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⓘ DOCKER_HOST is not set (using default)" -ForegroundColor Blue
    
    # Suggest appropriate value based on OS
    if ($IsWindows) {
        Write-Host "   For Windows, you can set it with:" -ForegroundColor Gray
        Write-Host "   `$env:DOCKER_HOST = 'npipe:////./pipe/docker_engine'" -ForegroundColor Gray
    } elseif ($IsLinux -or $IsMacOS) {
        Write-Host "   For Linux/macOS, you can set it with:" -ForegroundColor Gray
        Write-Host "   export DOCKER_HOST=unix:///var/run/docker.sock" -ForegroundColor Gray
    }
}

# 4. Test running a container
Write-Host "`n4. Testing container execution..." -ForegroundColor Yellow
try {
    Write-Host "   Running 'docker run --rm alpine echo \"Docker is working!\"'..." -ForegroundColor Gray
    $testOutput = docker run --rm alpine echo "Docker is working!" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Container test passed: $testOutput" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Container test failed" -ForegroundColor Red
        Write-Host "   Error: $testOutput" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Container test error: $_" -ForegroundColor Red
}

# 5. Check TestContainers configuration (if applicable)
Write-Host "`n5. Checking TestContainers compatibility..." -ForegroundColor Yellow
Write-Host "   Note: This script cannot fully validate TestContainers configuration." -ForegroundColor Gray
Write-Host "   To verify TestContainers, run:" -ForegroundColor Gray
Write-Host "   npm run test:e2e -- --testNamePattern='setup' --verbose" -ForegroundColor Gray

# 6. Summary
Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "Validation Summary" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$issues = @()

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    $issues += "Docker not installed or not in PATH"
}

if ($dockerInfo -and $LASTEXITCODE -ne 0) {
    $issues += "Docker service not running"
}

if ($testOutput -and $LASTEXITCODE -ne 0) {
    $issues += "Container execution test failed"
}

if ($issues.Count -eq 0) {
    Write-Host "✅ All checks passed! Docker environment is ready for TestContainers." -ForegroundColor Green
    Write-Host "You should be able to run E2E tests with: npm run test:e2e" -ForegroundColor Green
} else {
    Write-Host "⚠️  Found $($issues.Count) issue(s):" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "   - $issue" -ForegroundColor Yellow
    }
    Write-Host "`nPlease fix the issues above before running E2E tests." -ForegroundColor Red
}

Write-Host "`nFor detailed setup instructions, see README.md" -ForegroundColor Gray