#!/bin/bash
# Restart script for Shtetl Zmanim services
# This script kills all running services and restarts them in the background

set -e

echo "🔄 Restarting Shtetl Zmanim services..."
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to kill processes by pattern (with SIGKILL fallback)
kill_processes() {
    local pattern=$1
    local name=$2
    echo "🛑 Stopping $name..."
    # First try graceful SIGTERM
    pkill -f "$pattern" 2>/dev/null || true
    sleep 0.5
    # Then force SIGKILL if still running
    pkill -9 -f "$pattern" 2>/dev/null || true
}

# Function to force-kill anything on a port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "🔪 Force killing processes on port $port (PIDs: $pids)..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Kill the tmux session if it exists
echo "🛑 Stopping tmux session 'zmanim'..."
tmux kill-session -t zmanim 2>/dev/null || true

# Kill any stray processes by pattern - cast a wide net
echo "🛑 Stopping Go API processes..."
# Any go process in our workspace
pkill -9 -f "zmanim.*go" 2>/dev/null || true
pkill -9 -f "zmanim/api" 2>/dev/null || true
# Go temp binaries (go run creates these in /tmp)
pkill -9 -f "/tmp/go-build.*/exe/main" 2>/dev/null || true
pkill -9 -f "/tmp/go-build.*/exe/api" 2>/dev/null || true
# Named binary
pkill -9 -f "zmanim-api" 2>/dev/null || true

echo "🛑 Stopping Next.js processes..."
# Any next process on our port or in our workspace
pkill -9 -f "next.*3001" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "zmanim/web.*next" 2>/dev/null || true
pkill -9 -f "zmanim/web/node_modules/.bin/next" 2>/dev/null || true

# Wait for processes to terminate
sleep 2

# Force kill anything still on our ports (nuclear option)
echo ""
echo "🔍 Checking if ports are available..."
for port in 8080 3001; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is still in use, force killing..."
        kill_port $port
        # Double-check
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "❌ Failed to free port $port. Manual intervention required."
            echo "   Run: lsof -i :$port"
            exit 1
        fi
    fi
    echo "✅ Port $port is available"
done

echo ""
echo "🗃️  Running database migrations..."
"$SCRIPT_DIR/scripts/migrate.sh"

echo ""
echo "🚀 Starting services in background..."

# Run the startup script in the background (no-attach mode)
"$SCRIPT_DIR/.coder/start-services.sh" --no-attach

echo ""
echo "✅ Services restarted successfully!"
echo ""
echo "📺 To view services:"
echo "  tmux attach -t zmanim"
echo ""
echo "📋 Log files:"
echo "  - API: $SCRIPT_DIR/logs/api.log"
echo "  - Web: (view in tmux window 1)"
echo ""
echo "🔍 Quick log check:"
echo "  tail -f $SCRIPT_DIR/logs/api.log"
echo ""
echo "🌐 Service URLs:"
echo "  - Web App: http://localhost:3001"
echo "  - Go API:  http://localhost:8080"
echo ""
echo "🤖 To generate RAG embeddings (optional, requires OPENAI_API_KEY):"
echo "  cd api && go run cmd/indexer/main.go"
echo ""
