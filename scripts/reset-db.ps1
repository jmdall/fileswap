# Database Reset Script
# Usage: .\reset-db.ps1 [-Confirm]

param(
    [switch]$Confirm
)

Write-Host ""
Write-Host "==================================" -ForegroundColor Red
Write-Host "    Database Reset Utility        " -ForegroundColor Red
Write-Host "==================================" -ForegroundColor Red
Write-Host ""
Write-Host "WARNING: This will delete all data!" -ForegroundColor Yellow
Write-Host ""

if (!$Confirm) {
    $response = Read-Host "Are you sure you want to reset the database? (yes/no)"
    if ($response -ne "yes") {
        Write-Host "Operation cancelled" -ForegroundColor Yellow
        exit 0
    }
}

# Check Docker
docker ps 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Get PostgreSQL container
$postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-String "postgres" | Select-Object -First 1

if (!$postgresContainer) {
    Write-Host "PostgreSQL container not found!" -ForegroundColor Red
    Write-Host "Starting PostgreSQL service..." -ForegroundColor Yellow
    docker-compose up -d postgres
    Start-Sleep -Seconds 10
    $postgresContainer = docker ps --filter "name=postgres" --format "{{.Names}}" | Select-String "postgres" | Select-Object -First 1
}

if (!$postgresContainer) {
    Write-Host "Failed to start PostgreSQL container" -ForegroundColor Red
    exit 1
}

$containerName = $postgresContainer.ToString().Trim()

# Reset the database
Write-Host "Resetting database..." -ForegroundColor Yellow

# Drop all tables, types, and functions
$resetSQL = @"
-- Terminate active connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'file_exchange' 
  AND pid <> pg_backend_pid();

-- Drop all tables
DROP TABLE IF EXISTS download_log CASCADE;
DROP TABLE IF EXISTS file_upload CASCADE;
DROP TABLE IF EXISTS participant CASCADE;
DROP TABLE IF EXISTS exchange_session CASCADE;

-- Drop all types
DROP TYPE IF EXISTS session_state CASCADE;
DROP TYPE IF EXISTS participant_role CASCADE;
DROP TYPE IF EXISTS file_status CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS check_session_ready CASCADE;
DROP FUNCTION IF EXISTS check_session_releasable CASCADE;
DROP FUNCTION IF EXISTS update_session_state CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_sessions CASCADE;

-- Clean up any remaining objects
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO exchange_user;
GRANT ALL ON SCHEMA public TO public;
"@

Write-Host "Dropping existing database objects..." -ForegroundColor Yellow
$resetSQL | docker exec -i $containerName psql -U exchange_user -d file_exchange 2>$null

# Apply new schema
Write-Host "Applying fresh schema..." -ForegroundColor Yellow
Get-Content ..\backend\src\db\schema.sql | docker exec -i $containerName psql -U exchange_user -d file_exchange

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==================================" -ForegroundColor Green
    Write-Host "   Database Reset Complete!       " -ForegroundColor Green
    Write-Host "==================================" -ForegroundColor Green
    
    # Verify tables
    Write-Host ""
    Write-Host "Verifying database structure..." -ForegroundColor Cyan
    $verifySQL = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    $tables = $verifySQL | docker exec -i $containerName psql -U exchange_user -d file_exchange -t
    
    Write-Host "Tables created:" -ForegroundColor Green
    $tables | ForEach-Object { 
        if ($_.Trim()) { 
            Write-Host "  - $($_.Trim())" -ForegroundColor White 
        } 
    }
    
    Write-Host ""
    Write-Host "You can now restart the backend:" -ForegroundColor Cyan
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
} else {
    Write-Host "Database reset failed!" -ForegroundColor Red
    Write-Host "Check PostgreSQL logs:" -ForegroundColor Yellow
    Write-Host "  docker-compose logs postgres" -ForegroundColor White
    exit 1
}