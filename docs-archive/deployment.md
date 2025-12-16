# Deployment Guide

This guide covers deployment configuration for Shtetl Zmanim across all platforms.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Production Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌───────────┐      ┌───────────┐      ┌───────────────────────┐  │
│   │  Vercel   │      │  Fly.io   │      │        Xata           │  │
│   │ (Frontend)│─────▶│ (Backend) │─────▶│   (PostgreSQL)        │  │
│   │ Next.js   │      │   Go API  │      │   + PostGIS           │  │
│   └───────────┘      └───────────┘      └───────────────────────┘  │
│        │                                           │                 │
│        │              ┌───────────┐                │                 │
│        └─────────────▶│   Clerk   │◀───────────────┘                 │
│                       │   (Auth)  │                                  │
│                       └───────────┘                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Backend Deployment (Fly.io)

### Current Status
- **URL:** https://zmanim.fly.dev
- **Status:** Deployed

### Dockerfile

Located at `backend/Dockerfile`:

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/api

# Final stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]
```

### Fly.io Setup

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login:**
   ```bash
   fly auth login
   ```

3. **Initialize (if not done):**
   ```bash
   cd backend
   fly launch
   ```

4. **Set secrets:**
   ```bash
   fly secrets set DATABASE_URL="postgresql://..."
   fly secrets set CLERK_SECRET_KEY="sk_..."
   fly secrets set ALLOWED_ORIGINS="https://your-frontend.vercel.app"
   ```

5. **Deploy:**
   ```bash
   fly deploy
   ```

### Environment Variables (Backend)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8080) |
| `ENVIRONMENT` | No | development/production |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `JWT_SECRET` | Prod | JWT signing secret |
| `ALLOWED_ORIGINS` | No | CORS allowed origins (comma-separated) |
| `RATE_LIMIT_REQUESTS` | No | Rate limit requests (default: 60) |
| `RATE_LIMIT_DURATION` | No | Rate limit window (default: 1m) |

---

## Frontend Deployment (Vercel)

### Status
- **Planned** - Not yet configured

### Setup Steps

1. **Connect repository to Vercel:**
   - Go to vercel.com
   - Import GitHub repository
   - Configure root directory (will be `web/` after restructure)

2. **Configure build settings:**
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": ".next",
     "installCommand": "npm install",
     "framework": "nextjs"
   }
   ```

3. **Set environment variables:**
   ```
   NEXT_PUBLIC_API_URL=https://zmanim.fly.dev
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   ```

### vercel.json (for subdirectory deployment)

After restructuring to `web/` directory:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ]
}
```

Or configure in Vercel dashboard: Settings > General > Root Directory > `web`

---

## Database (PostgreSQL)

### Setup Steps

1. **Apply migrations:**
   ```bash
   # Run migration script
   ./scripts/migrate.sh
   ```

2. **Verify tables:**
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
   ORDER BY table_name;
   ```

---

## Authentication (Clerk)

### Setup Steps

1. **Create Clerk application:**
   - Go to clerk.com
   - Create new application
   - Note publishable key and secret key

2. **Configure environment variables:**

   Frontend:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   ```

3. **Configure allowed origins in Clerk dashboard**

4. **Integrate with backend:**
   - Verify Clerk JWT tokens in Go middleware
   - Map Clerk user IDs to publishers table

---

## CI/CD (GitHub Actions)

### Planned Configuration

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Fly
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly
        run: flyctl deploy --remote-only
        working-directory: ./api
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./web
```

### Required Secrets

| Secret | Source |
|--------|--------|
| `FLY_API_TOKEN` | `fly tokens create deploy` |
| `VERCEL_TOKEN` | Vercel dashboard > Settings > Tokens |
| `VERCEL_ORG_ID` | Vercel project settings |
| `VERCEL_PROJECT_ID` | Vercel project settings |

---

## Local Development

### Prerequisites
- Node.js 18+
- Go 1.21+
- Docker (optional)

### Frontend

```bash
# Install dependencies
npm install

# Set environment variables
echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local

# Run development server
npm run dev
```

### Backend

```bash
cd backend

# Install dependencies
go mod download

# Set environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run development server
go run ./cmd/api
```

### Docker Compose (Future)

```yaml
version: '3.8'
services:
  frontend:
    build: ./web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8080
    depends_on:
      - backend

  backend:
    build: ./api
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=${DATABASE_URL}
```

---

## Planned: Coder/Devcontainer

### devcontainer.json

```json
{
  "name": "Shtetl Zmanim Dev",
  "image": "mcr.microsoft.com/devcontainers/universal:2",
  "features": {
    "ghcr.io/devcontainers/features/go:1": {
      "version": "1.21"
    },
    "ghcr.io/devcontainers/features/node:1": {
      "version": "18"
    }
  },
  "forwardPorts": [3000, 8080],
  "postCreateCommand": "npm install && cd backend && go mod download",
  "customizations": {
    "vscode": {
      "extensions": [
        "golang.go",
        "bradlc.vscode-tailwindcss",
        "esbenp.prettier-vscode"
      ]
    }
  }
}
```

---

## Monitoring

### Fly.io

```bash
# View logs
fly logs

# Check status
fly status

# SSH into instance
fly ssh console
```

### Vercel

- Dashboard: vercel.com/dashboard
- Deployment logs available per deployment
- Real-time logs via Vercel CLI: `vercel logs`

---

*Generated by BMAD Document Project Workflow - 2025-11-25*
