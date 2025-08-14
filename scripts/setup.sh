#!/bin/bash
# Secure File Exchange - Setup Script
# Usage: ./setup.sh [--skip-dependencies] [--reset-database] [--start-services]

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_DEPS=false
RESET_DB=false
START_SERVICES=false

for arg in "$@"; do
    case $arg in
        --skip-dependencies)
            SKIP_DEPS=true
            ;;
        --reset-database)
            RESET_DB=true
            ;;
        --start-services)
            START_SERVICES=true
            ;;
    esac
done

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}     Secure File Exchange - Setup          ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Check Docker
echo -e "${YELLOW}Checking Docker...${NC}"
if ! docker ps >/dev/null 2>&1; then
    echo -e "${RED}Docker is not running. Please start Docker.${NC}"
    exit 1
fi
echo -e "${GREEN}Docker is running${NC}"

# Start Docker services
echo ""
echo -e "${YELLOW}Starting Docker services...${NC}"
docker-compose up -d postgres redis minio

# Wait for services
echo -e "${YELLOW}Waiting for services to start...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
    
    # Check PostgreSQL
    if docker exec $(docker ps -qf "name=postgres") pg_isready -U exchange_user >/dev/null 2>&1; then
        PG_READY=true
    else
        PG_READY=false
    fi
    
    # Check Redis
    if docker exec $(docker ps -qf "name=redis") redis-cli ping >/dev/null 2>&1; then
        REDIS_READY=true
    else
        REDIS_READY=false
    fi
    
    if [ "$PG_READY" = true ] && [ "$REDIS_READY" = true ]; then
        break
    fi
    
    if [ $((ATTEMPT % 5)) -eq 0 ]; then
        echo -e "${YELLOW}Still waiting for services... ($ATTEMPT/$MAX_ATTEMPTS)${NC}"
    fi
done

echo -e "${GREEN}Services are ready!${NC}"

# Configure MinIO
echo ""
echo -e "${YELLOW}Configuring MinIO...${NC}"
MINIO_CONTAINER=$(docker ps --filter "name=minio" --format "{{.Names}}" | grep minio | head -1)
if [ -n "$MINIO_CONTAINER" ]; then
    docker exec $MINIO_CONTAINER sh -c "mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null && mc mb -p local/file-exchange 2>/dev/null && echo 'MinIO configured' || echo 'MinIO already configured'"
else
    echo -e "${RED}MinIO container not found${NC}"
fi

# Initialize or reset database
if [ "$RESET_DB" = true ]; then
    echo ""
    echo -e "${YELLOW}Resetting database...${NC}"
    
    POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | grep postgres | head -1)
    if [ -n "$POSTGRES_CONTAINER" ]; then
        # Drop and recreate schema
        cat <<EOF | docker exec -i $POSTGRES_CONTAINER psql -U exchange_user -d file_exchange 2>/dev/null
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
EOF
        echo -e "${GREEN}Database cleaned${NC}"
    fi
fi

# Initialize database
echo ""
echo -e "${YELLOW}Initializing database...${NC}"
POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | grep postgres | head -1)
if [ -n "$POSTGRES_CONTAINER" ]; then
    # Check if schema exists
    TABLE_COUNT=$(echo "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exchange_session';" | docker exec -i $POSTGRES_CONTAINER psql -U exchange_user -d file_exchange -t 2>/dev/null | tr -d ' ')
    
    if [ "$TABLE_COUNT" = "0" ] || [ "$RESET_DB" = true ]; then
        cat ../backend/src/db/schema.sql | docker exec -i $POSTGRES_CONTAINER psql -U exchange_user -d file_exchange 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Database schema applied${NC}"
        else
            echo -e "${YELLOW}Database schema already exists or error occurred${NC}"
        fi
    else
        echo -e "${GREEN}Database already initialized${NC}"
    fi
else
    echo -e "${RED}PostgreSQL container not found${NC}"
fi

# Install dependencies
if [ "$SKIP_DEPS" = false ]; then
    echo ""
    
    # Backend dependencies
    if [ ! -d "../backend/node_modules" ]; then
        echo -e "${YELLOW}Installing backend dependencies...${NC}"
        (cd ../backend && npm install)
    else
        echo -e "${GREEN}Backend dependencies already installed${NC}"
    fi
    
    # Frontend dependencies
    if [ ! -d "../frontend/node_modules" ]; then
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        (cd ../frontend && npm install)
    else
        echo -e "${GREEN}Frontend dependencies already installed${NC}"
    fi
fi

# Start application services if requested
if [ "$START_SERVICES" = true ]; then
    echo ""
    echo -e "${YELLOW}Starting application services...${NC}"
    
    # Start backend in background
    (cd ../backend && npm run dev) &
    
    # Start frontend in background
    (cd ../frontend && ng serve) &
    
    echo -e "${GREEN}Services started in background${NC}"
fi

# Display summary
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}           Setup Complete!                  ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${CYAN}Services running:${NC}"
echo -e "${WHITE}  PostgreSQL: localhost:5432${NC}"
echo -e "${WHITE}  Redis: localhost:6379${NC}"
echo -e "${WHITE}  MinIO: http://localhost:9000${NC}"
echo -e "${WHITE}  MinIO Console: http://localhost:9001${NC}"
echo -e "${GRAY}    (login: minioadmin/minioadmin)${NC}"
echo ""

if [ "$START_SERVICES" = false ]; then
    echo -e "${CYAN}To start the application:${NC}"
    echo ""
    echo -e "${YELLOW}Backend:${NC}"
    echo -e "${WHITE}  cd backend${NC}"
    echo -e "${WHITE}  npm run dev${NC}"
    echo ""
    echo -e "${YELLOW}Frontend:${NC}"
    echo -e "${WHITE}  cd frontend${NC}"
    echo -e "${WHITE}  ng serve${NC}"
else
    echo -e "${CYAN}Application running at:${NC}"
    echo -e "${WHITE}  http://localhost:4200${NC}"
fi

echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo -e "${WHITE}  docker-compose down${NC}"
echo ""