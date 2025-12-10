#!/bin/bash
# Helper script to start all Zmanim Lab services in tmux

# Check for --no-attach flag (used during Coder startup)
NO_ATTACH=false
if [ "$1" = "--no-attach" ]; then
    NO_ATTACH=true
fi

# Install Claude CLI if not installed
if ! command -v claude &> /dev/null; then
    echo "📦 Installing Claude CLI..."
    curl -fsSL https://claude.ai/install.sh | bash
    echo "✅ Claude CLI installed"
else
    echo "✅ Claude CLI already installed"
fi

echo "🚀 Starting Zmanim Lab services in tmux..."

# Get the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if we're in the right place
if [ ! -d "$PROJECT_ROOT/web" ] || [ ! -d "$PROJECT_ROOT/api" ]; then
    echo "❌ Error: Could not find web/ and api/ directories"
    echo "   Please run this script from the zmanim repository"
    exit 1
fi

# Kill existing session if it exists
tmux kill-session -t zmanim 2>/dev/null || true

# Create logs directory
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

# Build the Go API binary (ensures latest code is used)
echo "🔨 Building Go API..."
cd "$PROJECT_ROOT/api"
if go build -o zmanim-api ./cmd/api/main.go 2>&1; then
    echo "✅ API build successful"
else
    echo "❌ API build failed! Check $LOG_DIR/api-build.log"
    go build -o zmanim-api ./cmd/api/main.go 2>&1 | tee "$LOG_DIR/api-build.log"
    exit 1
fi
cd "$PROJECT_ROOT"

# Create a new tmux session with the API service (using built binary, with logging)
tmux new-session -d -s zmanim -n api "cd $PROJECT_ROOT/api && ./zmanim-api 2>&1 | tee $LOG_DIR/api.log"

# Create window for web service (port 3001)
tmux new-window -t zmanim -n web "cd $PROJECT_ROOT/web && npm run dev -- -p ${WEB_PORT:-3001}"

# Wait a moment for services to start
sleep 2

# Health check function
check_service() {
    local name=$1
    local url=$2
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo "✅ $name is running"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    echo "⚠️  $name may not be ready yet (check tmux)"
    return 1
}

echo ""
echo "🔍 Checking service health..."
check_service "API" "http://localhost:8080/health"
check_service "Web" "http://localhost:${WEB_PORT:-3001}"

echo ""
echo "✅ Services started in tmux session 'zmanim'"
echo ""
echo "📺 To view services:"
echo "  tmux attach -t zmanim"
echo ""
echo "🔀 To switch between services:"
echo "  Ctrl+B then 0 (api)"
echo "  Ctrl+B then 1 (web)"
echo ""
echo "📤 To detach: Ctrl+B then D"
echo "🛑 To kill all: tmux kill-session -t zmanim"
echo ""
echo "🌐 Service URLs:"
echo "  - Web App: http://localhost:${WEB_PORT:-3001}"
echo "  - Go API:  http://localhost:8080"
echo ""

# Attach to the session (unless --no-attach was passed)
if [ "$NO_ATTACH" = false ]; then
    tmux attach -t zmanim
fi
