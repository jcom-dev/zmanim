# Zmanim Lab

**Halachic Zmanim Publishing Platform** - A portal for rabbinic authorities to publish customized Jewish prayer times with full algorithm control.

## Overview

Zmanim Lab enables halachic authorities to:
- Define custom zmanim calculation algorithms using a friendly UX
- Publish prayer times for specific geographic regions
- Provide end users with accurate, authority-specific zmanim

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Zmanim Lab                               │
├─────────────────────────────────────────────────────────────────┤
│  │   Web Frontend  │───▶│    Go API       │───▶│  PostgreSQL │ │
│  │   (Next.js)     │    │   (Chi Router)  │    │  + PostGIS  │ │
│  │     /web        │    │     /api        │    │             │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
│         │                       │                     │         │
│         ▼                       ▼                     ▼         │
│      Vercel               Fly.io              Cloud Provider    │
└─────────────────────────────────────────────────────────────────┘

Authentication: Clerk
```

## Project Structure

```
zmanim/
├── web/                 # Next.js frontend (Vercel)
│   ├── app/            # App Router pages
│   ├── components/     # React components
│   ├── lib/            # Utilities & API client
│   └── package.json
├── api/                 # Go backend (Fly.io)
│   ├── cmd/api/        # Entry point
│   ├── internal/       # Business logic
│   ├── Dockerfile
│   └── fly.toml
├── tests/              # E2E tests (Playwright)
│   ├── e2e/            # Test specs
│   ├── playwright.config.ts
│   └── TESTING.md      # Testing guide
├── db/                 # Database migrations
│   └── migrations/
├── docs/               # Documentation
└── .github/workflows/  # CI/CD
```

## Quick Start

### Option 1: Coder Cloud Development (Recommended)

Use Coder for a fully configured cloud development environment:

```bash
# Login to Coder
coder login http://your-coder-instance

# Push template (first time only)
coder templates push zmanim --directory .coder

# Create workspace
coder create zmanim-dev --template zmanim
```

#### Starting/Restarting Services in Coder

Services run in a tmux session named `zmanim` with windows for API and Web.

**Start both services:**
```bash
./.coder/start-services.sh
```

**Restart all services:**
```bash
./restart.sh
```

**Restart individual service:**
```bash
# Restart API only
tmux send-keys -t zmanim:api C-c
tmux send-keys -t zmanim:api "go run cmd/api/main.go" Enter

# Restart Web only
tmux send-keys -t zmanim:web C-c
tmux send-keys -t zmanim:web "npm run dev" Enter
```

**View logs / attach to tmux:**
```bash
tmux attach -t zmanim      # Attach to session
# Ctrl+B then 0  -> API logs
# Ctrl+B then 1  -> Web logs
# Ctrl+B then D  -> Detach
```

**Service URLs:**
| Service | Port | URL |
|---------|------|-----|
| Web App | 3001 | http://localhost:3001 |
| Go API  | 8080 | http://localhost:8080 |

**Health check:**
```bash
curl http://localhost:8080/health   # API
curl http://localhost:3001          # Web
```

See [.coder/README.md](./.coder/README.md) for detailed tmux usage.

### Option 2: Local Development

#### Prerequisites

- Node.js 24+ LTS
- Go 1.25+
- npm 10+
- PostgreSQL Database
- Clerk account
- Upstash account

#### Setup

```bash
# Clone repository
git clone https://github.com/jcom-dev/zmanim.git
cd zmanim

# Copy environment template
cp .env.example api/.env
cp .env.example web/.env.local
# Edit both files with your credentials
```

#### Frontend (web/)

```bash
cd web
npm install
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

#### Backend (api/)

```bash
cd api
go mod download
go run ./cmd/api
```

API available at [http://localhost:8080](http://localhost:8080)

### Environment Variables

Required services:
- **PostgreSQL** - Database
- **Upstash** - Redis caching ([upstash.com](https://upstash.com))
- **Clerk** - Authentication ([clerk.com](https://clerk.com))

See `.env.example` for all required variables.

## Deployment

### Environment Strategy

| Environment | API | Frontend | Database | Cache |
|-------------|-----|----------|----------|-------|
| **Production** | AWS EC2 | AWS Lambda + CloudFront | PostgreSQL on EC2 | Redis on EC2 |
| **Development** | Fly.io | Vercel | Xata | Upstash |

**Production URL:** https://zmanim.shtetl.io

### Development Deployment (Fly.io + Vercel)

```bash
# Deploy API to Fly.io
cd api && fly deploy

# Frontend auto-deploys to Vercel on push to main
```

### Production Deployment (AWS)

Production uses AWS CDK infrastructure in `eu-west-1` (Ireland).

#### Architecture

```
                    ┌─────────────────────────────────────┐
                    │         CloudFront (CDN)            │
                    │   zmanim.shtetl.io                  │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
      /_next/static/*           /*                /backend/*
           │                     │                     │
           ▼                     ▼                     ▼
    ┌─────────────┐     ┌─────────────────┐    ┌─────────────┐
    │     S3      │     │  Next.js Lambda │    │ API Gateway │
    │   (static)  │     │     (SSR)       │    │  (HTTP API) │
    └─────────────┘     └─────────────────┘    └──────┬──────┘
                                                      │
                                               JWT Auth (Clerk)
                                                      │
                                                      ▼
                                    ┌─────────────────────────────┐
                                    │     EC2 (m7g.medium)        │
                                    │     Graviton3 ARM64         │
                                    ├─────────────────────────────┤
                                    │  Go API (:8080)             │
                                    │  PostgreSQL 17 + PostGIS    │
                                    │  Redis 7                    │
                                    └──────────────┬──────────────┘
                                                   │
                                    ┌──────────────┴──────────────┐
                                    │   EBS Data Volume (/data)   │
                                    │   - /data/postgres          │
                                    │   - /data/redis             │
                                    │   PERSISTENT (survives      │
                                    │   instance replacement)     │
                                    └─────────────────────────────┘
```

#### CDK Stacks

| Stack | Purpose | Region |
|-------|---------|--------|
| `ZmanimGitHubOidc` | OIDC auth for GitHub Actions | eu-west-1 |
| `ZmanimProdNetwork` | VPC, subnets, security groups | eu-west-1 |
| `ZmanimProdStorage` | S3 buckets (backups, releases) | eu-west-1 |
| `ZmanimProdSecrets` | SSM Parameter Store config | eu-west-1 |
| `ZmanimProdCompute` | EC2, EBS, Elastic IP, IAM | eu-west-1 |
| `ZmanimProdApiGateway` | HTTP API, JWT authorizer | eu-west-1 |
| `ZmanimProdDnsZone` | Route 53 hosted zone | eu-west-1 |
| `ZmanimProdCertificate` | ACM certificate | **us-east-1** |
| `ZmanimProdNextjs` | Next.js Lambda + CloudFront | eu-west-1 |
| `ZmanimProdDNS` | DNS A record, health check | eu-west-1 |
| `ZmanimProdHealthCheckAlarm` | CloudWatch alarm | **us-east-1** |

#### First-Time Setup

1. **Bootstrap GitHub OIDC** (requires local AWS credentials):
   ```bash
   cd infrastructure
   npx cdk deploy ZmanimGitHubOidc
   ```

2. **Configure GitHub Secrets:**
   - `AWS_ACCOUNT_ID` - Your 12-digit AWS account ID
   - `AWS_DEPLOY_ROLE_ARN` - ARN from GitHubOidcStack output
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
   - `CLERK_SECRET_KEY` - Clerk secret key

3. **Deploy all infrastructure:**
   ```bash
   cd infrastructure
   npx cdk deploy --all
   ```

4. **Set SSM parameters** (secrets):
   ```bash
   aws ssm put-parameter --name /zmanim/prod/postgres-password --value 'YOUR_PASSWORD' --type SecureString
   aws ssm put-parameter --name /zmanim/prod/redis-password --value 'YOUR_PASSWORD' --type SecureString
   aws ssm put-parameter --name /zmanim/prod/clerk-secret-key --value 'sk_live_...' --type SecureString
   aws ssm put-parameter --name /zmanim/prod/clerk-publishable-key --value 'pk_live_...' --type SecureString
   aws ssm put-parameter --name /zmanim/prod/jwt-secret --value 'YOUR_SECRET' --type SecureString
   aws ssm put-parameter --name /zmanim/prod/restic-password --value 'YOUR_PASSWORD' --type SecureString
   aws ssm put-parameter --name /zmanim/prod/origin-verify-key --value 'YOUR_KEY' --type SecureString
   ```

5. **Build and deploy AMI:**
   ```bash
   git tag v1.0.0-ami && git push origin v1.0.0-ami
   # GitHub Actions builds AMI and stores ID in SSM
   ```

6. **Run database migrations:**
   ```bash
   ./scripts/migrate.sh
   ```

#### Ongoing Deployments

| What to Deploy | Command |
|----------------|---------|
| **Next.js frontend** | Push to `main` branch (auto-deploys) |
| **Infrastructure changes** | `cd infrastructure && npx cdk deploy --all` |
| **New AMI** (OS/dependency updates) | `git tag v1.x.x-ami && git push origin v1.x.x-ami` |
| **API code only** | Upload binary to S3, restart service on EC2 |

#### Cost Estimate

| Component | Monthly Cost |
|-----------|-------------|
| EC2 m7g.medium | ~$25 |
| EBS storage (30GB) | ~$4 |
| Elastic IP | ~$3 |
| CloudFront + Lambda | ~$1-5 |
| API Gateway | ~$1-3 |
| S3 | ~$1-2 |
| Route 53 | ~$0.50 |
| **Total** | **~$35-50** |

#### Key Infrastructure Files

```
infrastructure/
├── bin/infrastructure.ts       # CDK app entry point
├── lib/
│   ├── network-stack.ts        # VPC, subnets, security groups
│   ├── compute-stack.ts        # EC2, EBS, IAM
│   ├── api-gateway-stack.ts    # HTTP API, JWT auth
│   ├── nextjs-lambda-stack.ts  # Next.js + CloudFront
│   ├── dns-stack.ts            # Route 53, certificates
│   ├── storage-stack.ts        # S3 buckets
│   └── github-oidc-stack.ts    # GitHub Actions auth
├── packer/
│   ├── zmanim-ami.pkr.hcl      # Packer AMI template
│   ├── files/                  # Config files for AMI
│   └── scripts/                # Provisioning scripts
└── deploy.sh                   # Local deployment helper

.github/workflows/
├── build-ami.yml               # Packer AMI build
├── cdk-deploy.yml              # Infrastructure deployment
└── deploy-prod.yml             # Next.js deployment
```

## Testing

Zmanim Lab uses **Playwright** for E2E testing with support for AI-assisted testing via MCP.

### Quick Start

```bash
# Install test dependencies (first time only)
cd tests
npm install
npx playwright install chromium
```

### Run Tests (Desktop Only - ~2.5 min)

```bash
cd tests

# Clean previous auth state (recommended for fresh runs)
rm -rf test-results/.auth

# Run tests
npx playwright test
```

### Run Tests Including Mobile (~7-9 min)

```bash
cd tests
rm -rf test-results/.auth
INCLUDE_MOBILE=true npx playwright test
```

### Fresh Start (If Tests Fail with Auth Errors)

```bash
cd tests
rm -rf test-results/   # Full clean
npx playwright test
```

### Test Execution Order

Tests run automatically in this order:
1. **Setup** - Signs in as admin & publisher (once)
2. **chromium-admin** - Admin tests
3. **chromium-publisher** - Publisher tests
4. **chromium** - Public page tests
5. **mobile-*** - Mobile tests (only with `INCLUDE_MOBILE=true`)

### Services Required

Ensure both services are running:
```bash
curl http://localhost:3001  # Web - should return HTML
curl http://localhost:8080/health  # API - should return OK
```

### Common Commands

| Command | Description |
|---------|-------------|
| `npx playwright test` | Run all tests (desktop) |
| `INCLUDE_MOBILE=true npx playwright test` | Run with mobile |
| `npx playwright test --ui` | Interactive UI mode |
| `npx playwright test --headed` | Visible browser |
| `npx playwright test --debug` | Debug mode |
| `npx playwright test home.spec.ts` | Run specific file |
| `npx playwright show-report test-results/html-report` | View report |

For comprehensive testing documentation, see [tests/TESTING.md](./tests/TESTING.md).

## Documentation

See [docs/](./docs/) for comprehensive documentation:

- [Documentation Index](./docs/README.md) - Documentation overview and navigation
- [Developer Guide](./docs/DEVELOPER_GUIDE.md) - Complete developer onboarding
- [Architecture](./docs/architecture.md) - System design and patterns
- [Coding Standards](./docs/coding-standards.md) - Development standards
- [API Reference](./docs/api-reference.md) - REST endpoints
- [Data Models](./docs/data-models.md) - Database schema
- [Deployment](./docs/deployment.md) - Deployment guide
- [Testing Guide](./tests/TESTING.md) - E2E testing with Playwright

### Business Documentation

For non-technical stakeholders:
- [What is Zmanim Lab?](./docs/business/01-what-is-zmanim.md) - Vision and purpose
- [Features List](./docs/business/02-features-comprehensive-list.md) - Comprehensive feature overview
- [Technical Overview](./docs/business/03-technical-architecture.md) - High-level architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Go 1.25, Chi router, pgx |
| Database | PostgreSQL |
| Caching | Upstash Redis (REST API, 24hr TTL) |
| Auth | Clerk |
| Zmanim | Custom Go calculation engine |
| Testing | Vitest (unit), Playwright (E2E) |
| Hosting | Vercel, Fly.io |
| Dev Environment | Coder (cloud IDE) |

## Features

- **Multi-Publisher Support** - Multiple halachic authorities can publish their zmanim
- **Algorithm DSL** - JSON-based formula definitions for custom calculations
- **Geographic Coverage** - PostGIS-powered coverage areas per publisher
- **Calculation Caching** - 24-hour cache for performance
- **Verification System** - Publisher verification workflow

## Halachic Disclaimer

Times are calculated based on astronomical and halachic methods. Consult your local rabbi for practical halachic guidance.

## License

[Add license here]

## Acknowledgments

- Calculation algorithms inspired by [KosherJava](https://github.com/KosherJava/zmanim) by Eliyahu Hershfeld
- Built with [BMad Method](https://github.com/bmad-agent/bmad-method) AI-first development methodology
