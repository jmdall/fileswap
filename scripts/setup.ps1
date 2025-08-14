# Secure File Exchange - Setup Script
# Usage: .\setup.ps1 [-SkipDependencies] [-ResetDatabase] [-StartServices]

param(
    [switch]$SkipDependencies,
    [switch]$ResetDatabase,
    [switch]$StartServices
)

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "     Secure File Exchange - Setup          " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Docker
Write-Host "Checking Docker..." -ForegroundColor Yellow
docker ps 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "Docker is running" -ForegroundColor Green

# Start Docker services
Write-Host ""
Write-Host "Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d postgres redis minio

# Wait for services
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$allHealthy = $false

while ($attempt -lt $maxAttempts -and !$allHealthy) {
    Start-Sleep -Seconds 2
    $attempt++
    
    # Check if all services are healthy
    $healthStatus = docker-compose ps --format json | ConvertFrom-Json
    $allHealthy = $true
    
    foreach ($service in $healthStatus) {
        if ($service.Health -ne "healthy" -and $service.Health -ne "") {
            $allHealthy = $false
            break
        }
    }
    
    if ($attempt % 5 -eq 0) {
        Write-Host "Still waiting for services... ($attempt/$maxAttempts)" -ForegroundColor Yellow
    }
}

if (!$allHealthy -and $attempt -eq $maxAttempts) {
    Write-Host "Services are taking longer than expected to start" -ForegroundColor Yellow
    Write-Host "Continuing anyway..." -ForegroundColor Yellow
}

Write-Host "Services are ready!" -ForegroundColor Green

# Configure MinIO
Write-Host ""
Write-Host "Configuring MinIO..." -ForegroundColor Yellow
$minioContainer = docker ps --filter "name=minio" --format "{{.Names}}" | Select-String "minio" | Select-Object -First 1
if ($minioContainer) {
    $containerName = $minioContainer.ToString().Trim()
    docker exec $containerName sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null && mc mb -p local/file-exchange 2>/dev/null && echo 'MinIO configured' || echo 'MinIO already configured'"
} else {
    Write-Host "MinIO container not found" -ForegroundColor Red
}

# Initialize or reset database
if ($ResetDatabase) {
    Write-Host ""
    Write-Host "Resetting database..." -ForegroundColor Yellow
    
    $postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-String "postgres" | Select-Object -First 1
    if ($postgresContainer) {
        $containerName = $postgresContainer.ToString().Trim()
        
        # Drop and recreate schema
        $resetSQL = @"
-- Drop all tables and types
DROP TABLE IF EXISTS download_log CASCADE;
DROP TABLE IF EXISTS file_upload CASCADE;
DROP TABLE IF EXISTS participant CASCADE;
DROP TABLE IF EXISTS exchange_session CASCADE;
DROP TYPE IF EXISTS session_state CASCADE;
DROP TYPE IF EXISTS participant_role CASCADE;
DROP TYPE IF EXISTS file_status CASCADE;
DROP FUNCTION IF EXISTS check_session_ready CASCADE;
DROP FUNCTION IF EXISTS check_session_releasable CASCADE;
DROP FUNCTION IF EXISTS update_session_state CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_sessions CASCADE;
"@
        
        $resetSQL | docker exec -i $containerName psql -U exchange_user -d file_exchange 2>$null
        Write-Host "Database cleaned" -ForegroundColor Green
    }
}

# Initialize database
Write-Host ""
Write-Host "Initializing database..." -ForegroundColor Yellow
$postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-String "postgres" | Select-Object -First 1
if ($postgresContainer) {
    $containerName = $postgresContainer.ToString().Trim()
    
    # Check if schema exists
    $checkSQL = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exchange_session';"
    $tableCount = $checkSQL | docker exec -i $containerName psql -U exchange_user -d file_exchange -t 2>$null
    
    if ($tableCount -eq 0 -or $ResetDatabase) {
        Get-Content ..\backend\src\db\schema.sql | docker exec -i $containerName psql -U exchange_user -d file_exchange 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Database schema applied" -ForegroundColor Green
        } else {
            Write-Host "Database schema already exists or error occurred" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Database already initialized" -ForegroundColor Green
    }
} else {
    Write-Host "PostgreSQL container not found" -ForegroundColor Red
}

# Install dependencies
if (!$SkipDependencies) {
    Write-Host ""
    
    # Backend dependencies
    if (!(Test-Path "..\backend\node_modules")) {
        Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
        Push-Location ..\backend
        npm install
        Pop-Location
    } else {
        Write-Host "Backend dependencies already installed" -ForegroundColor Green
    }
    
    # Frontend dependencies
    if (!(Test-Path "..\frontend\node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        Push-Location ..\frontend
        npm install
        Pop-Location
    } else {
        Write-Host "Frontend dependencies already installed" -ForegroundColor Green
    }
}

# Start application services if requested
if ($StartServices) {
    Write-Host ""
    Write-Host "Starting application services..." -ForegroundColor Yellow
    
    # Start backend in new terminal
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ..\backend; npm run dev"
    
    # Start frontend in new terminal
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ..\frontend; ng serve"
    
    Write-Host "Services started in new terminals" -ForegroundColor Green
}

# Display summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "           Setup Complete!                  " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services running:" -ForegroundColor Cyan
Write-Host "  PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host "  Redis: localhost:6379" -ForegroundColor White
Write-Host "  MinIO: http://localhost:9000" -ForegroundColor White
Write-Host "  MinIO Console: http://localhost:9001" -ForegroundColor White
Write-Host "    (login: minioadmin/minioadmin)" -ForegroundColor Gray
Write-Host ""

if (!$StartServices) {
    Write-Host "To start the application:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backend:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "Frontend:" -ForegroundColor Yellow
    Write-Host "  cd frontend" -ForegroundColor White
    Write-Host "  ng serve" -ForegroundColor White
} else {
    Write-Host "Application running at:" -ForegroundColor Cyan
    Write-Host "  http://localhost:4200" -ForegroundColor White
}

Write-Host ""
Write-Host "To stop all services:" -ForegroundColor Yellow
Write-Host "  docker-compose down" -ForegroundColor White
Write-Host ""