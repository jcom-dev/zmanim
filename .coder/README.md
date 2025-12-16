# Shtetl Zmanim Coder Workspace

This directory contains the Coder workspace template for the Shtetl Zmanim platform.

## Overview

Shtetl Zmanim uses a **monorepo** structure with:
- `web/` - Next.js frontend
- `api/` - Go backend

**External Services:**
- **Xata** - PostgreSQL database (managed)
- **Upstash** - Redis caching (serverless REST API)
- **Clerk** - Authentication

## Quick Start

### 1. Create Workspace

```bash
# Login to Coder
coder login http://your-coder-instance

# Push template (first time only)
coder templates push zmanim --directory .coder

# Create workspace
coder create zmanim-dev --template zmanim
```

### 2. Configure Environment

Copy the `.env.example` file and configure your credentials:

```bash
# API configuration
cp .env.example api/.env

# Web configuration
cp .env.example web/.env.local
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST endpoint
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis auth token
- `CLERK_SECRET_KEY` - Clerk backend secret
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk frontend key

### 3. Start Services

```bash
# Using the helper script (starts both in tmux)
./.coder/start-services.sh

# Or manually:
# Terminal 1: API
cd api && go run cmd/api/main.go

# Terminal 2: Web
cd web && npm run dev -- -p 3001
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Web App | 3001 | Next.js frontend |
| Go API | 8080 | REST API backend |

### Accessing Services

**Option 1: Direct Port Access (Recommended for Development)**

If using SSH or local Coder installation:
```bash
# Services are accessible directly on localhost
http://localhost:3001  # Web App
http://localhost:8080  # API
```

**Option 2: Via Coder Web UI**

Coder provides app shortcuts in the workspace UI, but these are proxied through Coder's web server:
- Web App: Click "Web App" in workspace UI
- API: Click "API" in workspace UI

Note: These proxied URLs may look like `http://localhost:3000/@username/workspace/apps/slug/` but will redirect to the actual service.

**Option 3: Port Forwarding (If Remote)**

If Coder is running remotely and ports aren't exposed:
```bash
# Forward ports from remote workspace to local machine
coder port-forward zmanim-dev --tcp 3001:3001 --tcp 8080:8080

# Then access via localhost
http://localhost:3001  # Web App
http://localhost:8080  # API
```

## Development Tools

**Installed in Container:**
- Go 1.25.4 - Backend development
- Node.js 24.x LTS (Krypton) - Frontend development
- npm 10+ - Package manager
- Playwright 1.56+ - E2E testing (Chromium)
- tmux - Service management

## Health Checks

```bash
# API
curl http://localhost:8080/health

# Web
curl http://localhost:3001
```

## Reloading / Restarting Services

Services run in a tmux session named `zmanim` with two windows:
- Window 0: `api` - Go backend
- Window 1: `web` - Next.js frontend (port 3001)

### Quick Restart (Recommended)

Use the restart script when services are unresponsive or you need a clean restart:

```bash
# From the project root
./restart.sh
```

This script will:
- Kill all running services (tmux session + stray processes)
- Force-free ports 8080 and 3001 if still in use
- Restart everything in the background
- Run health checks to verify services are up

### Manual Restart

```bash
# Kill the tmux session and restart everything
tmux kill-session -t zmanim
./.coder/start-services.sh
```

### Restart Individual Service (via tmux)

```bash
# Attach to tmux session
tmux attach -t zmanim

# Switch to the window you want to restart:
#   Ctrl+B then 0  -> api window
#   Ctrl+B then 1  -> web window

# Kill the running process: Ctrl+C
# Then restart by pressing Up arrow and Enter (re-runs last command)
# Or manually type:
#   API:  go run cmd/api/main.go
#   Web:  npm run dev

# Detach when done: Ctrl+B then D
```

### Restart Service Without Attaching

```bash
# Restart API only (window 0)
tmux send-keys -t zmanim:api C-c
tmux send-keys -t zmanim:api "cd /home/coder/workspace/zmanim/api && go run cmd/api/main.go" Enter

# Restart Web only (window 1)
tmux send-keys -t zmanim:web C-c
tmux send-keys -t zmanim:web "cd /home/coder/workspace/zmanim/web && npm run dev" Enter
```

### View Service Logs

```bash
# Attach to see live output
tmux attach -t zmanim

# Switch windows inside tmux:
#   Ctrl+B then 0  -> API logs
#   Ctrl+B then 1  -> Web logs
#   Ctrl+B then D  -> Detach (services keep running)
```

### After Code Changes

- **Go API changes**: Restart required (no hot reload) - use tmux restart above
- **Next.js changes**: Hot Module Replacement (HMR) auto-reloads, no restart needed
- **package.json changes**: Run `npm install` in web window, then restart

### Ports Reference

| Service | Port | Notes |
|---------|------|-------|
| Next.js Web | **3001** | Frontend app (configured in package.json) |
| Go API | 8080 | Backend REST API |

## Testing

```bash
# Go unit tests
cd api && go test ./...

# Playwright E2E tests
cd web && npm run test:e2e
```

## Files

- `zmanim-workspace.tf` - Terraform workspace definition
- `startup.sh` - Initialization script (runs on workspace creation)
- `start-services.sh` - Helper to start web and API in tmux
- `../restart.sh` - Quick restart script (kills all services and restarts)
- `README.md` - This file

## Using Your Own Fork or Branch

```bash
# Create workspace with custom branch
coder create zmanim-dev --template zmanim \
  --parameter zmanim_branch=feature/my-feature

# Or with your fork
coder create zmanim-dev --template zmanim \
  --parameter zmanim_repo=git@github.com:your-username/zmanim.git
```

## Troubleshooting

### Git clone fails
Add your SSH key to GitHub:
```bash
coder ssh zmanim-dev -- "cat ~/.ssh/id_ed25519.pub"
# Add to: https://github.com/settings/ssh/new
```

### Services won't start
Check environment variables are configured:
```bash
cat api/.env
cat web/.env.local
```

### Services not responding / Need clean restart
Use the restart script:
```bash
cd /home/coder/workspace/zmanim
./restart.sh
```

This will kill all services, free up ports, and restart everything cleanly.

### Can't access services via Coder Web UI apps
The app shortcuts in Coder's web UI proxy through paths like:
- `http://localhost:3000/@username/workspace/apps/web/`
- `http://localhost:3000/@username/workspace/apps/api/`

For direct access without proxy:
1. Use SSH: `coder ssh zmanim-dev` then access `http://localhost:3001` and `http://localhost:8080`
2. Use port forwarding: `coder port-forward zmanim-dev --tcp 3001:3001 --tcp 8080:8080`
3. If using VS Code: The ports should be automatically forwarded

### Database connection fails
Verify the PostgreSQL connection string in `DATABASE_URL` is correct.

### Frontend shows "No publishers available"
This usually means:
1. Backend API isn't running - use `./restart.sh` to restart services
2. Missing environment variables in `api/.env` - check `CLERK_JWKS_URL` and `CLERK_ISSUER` are set
3. CORS issue - default allows `localhost:3000` and `localhost:3001`, update `ALLOWED_ORIGINS` in `api/.env` if using different port

## Architecture

```
Coder Workspace
└── Development Container
    ├── Go 1.25.4
    ├── Node.js 24.x LTS
    ├── Playwright 1.56+

External Services:
├── Xata (PostgreSQL)
├── Upstash (Redis)
└── Clerk (Auth)
```

## References

- [Coder Documentation](https://coder.com/docs)
- [Architecture](../docs/architecture.md)
- [Epics](../docs/epics.md)
