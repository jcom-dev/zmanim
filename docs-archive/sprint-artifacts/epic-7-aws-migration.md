# Epic 7: AWS Migration & Infrastructure

**Epic:** Epic 7 - AWS Migration
**Project:** Shtetl Zmanim
**Author:** BMad
**Date:** 2025-12-10
**Status:** Planning
**Estimated Stories:** 10

---

## Executive Summary

Epic 7 migrates Shtetl Zmanim production environment from Fly.io/Vercel/Xata/Upstash to a unified AWS infrastructure. The architecture prioritizes **zero cold starts**, **low latency**, and **cost efficiency** (~$44/month).

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│              m7g.medium EC2 (eu-west-1)             │
│              2 vCPU, 4GB RAM, 30GB EBS              │
│              Packer AMI (pre-baked)                 │
│                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ │
│  │   Go API    │ │ PostgreSQL  │ │     Redis     │ │
│  │  (systemd)  │ │  + PostGIS  │ │   (systemd)   │ │
│  │   :8080     │ │    :5432    │ │     :6379     │ │
│  └─────────────┘ └─────────────┘ └───────────────┘ │
│                                                     │
│  Backup Cron → S3 (7-day retention)                │
└─────────────────────────────────────────────────────┘
                        ↑
                   API Gateway (HTTP)
                        ↑
                   CloudFront (CDN)
                   + Origin Shield
                        ↑
┌─────────────────────────────────────────────────────┐
│                     Users                           │
│         US (edge) ←→ EU (origin) ←→ Israel (edge)  │
└─────────────────────────────────────────────────────┘
```

---

## Goals & Success Criteria

### Primary Goals

1. **Zero Cold Starts** - All services always running on dedicated EC2
2. **Global Performance** - CloudFront edge caching for US/Israel users
3. **Cost Efficiency** - Target ~$44/month (vs ~$80+ for managed services)
4. **Vendor Neutral Core** - PostgreSQL, Redis, Go (portable)
5. **Infrastructure as Code** - AWS CDK for reproducibility
6. **Immutable Deployments** - Packer AMI, no runtime package installs

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold start latency | 0ms | No cold starts (always on) |
| API response (cached) | <50ms | CloudFront edge hit |
| API response (origin) | <200ms | Direct to EC2 |
| Monthly cost | <$50 | AWS Cost Explorer |
| Deployment time | <10min | GitHub Actions |
| Backup success rate | 100% | S3 object count |

---

## Architecture Decisions

### Why Single EC2 (Not Fargate/Lambda)

| Option | Cold Start | Cost | Complexity |
|--------|------------|------|------------|
| Lambda | 30-60s (VPC) | Variable | Low |
| Fargate | 30-60s (new task) | ~$50+ | Medium |
| Aurora Serverless | 30s+ (scale up) | ~$65+ | Low |
| **EC2 m7g.medium** | **None** | **~$30** | **Low** |

**Decision**: Single EC2 with all services co-located eliminates network latency between app/db/cache and guarantees zero cold starts.

### Why Packer AMI (Not Runtime Install)

| Approach | NAT Gateway | Boot Time | Reproducibility |
|----------|-------------|-----------|-----------------|
| Runtime install | Required (~$32/mo) | 5-10 min | Variable |
| **Packer AMI** | **Not needed ($0)** | **<1 min** | **100%** |

**Decision**: Pre-bake everything into AMI. Saves ~$32/month on NAT Gateway and ensures consistent deployments.

### Why eu-west-1 (Ireland)

| Factor | Ireland | Frankfurt |
|--------|---------|-----------|
| US East latency | ~70ms | ~85ms |
| Israel latency | ~60ms | ~50ms |
| Service availability | Most complete | Very complete |
| Cost | Slightly cheaper | Standard |

**Decision**: eu-west-1 provides best balance for US + Israel users via CloudFront edge locations.

---

## Infrastructure Components

### Compute

| Component | Service | Configuration |
|-----------|---------|---------------|
| App Server | EC2 m7g.medium | 2 vCPU, 4GB RAM, Graviton3 |
| Storage | EBS gp3 | 30GB, 3000 IOPS |
| IP | Elastic IP | Static public IP |

### Database & Cache

| Component | Software | Configuration |
|-----------|----------|---------------|
| Database | PostgreSQL 16 | + PostGIS 3.4, local socket |
| Cache | Redis 7 | In-memory, persistence enabled |

### Networking

| Component | Service | Configuration |
|-----------|---------|---------------|
| CDN | CloudFront | Origin Shield enabled |
| API Routing | API Gateway | HTTP API (not REST) |
| DNS | Route 53 | zmanim.shtetl.io |
| SSL | ACM | Auto-renewed certificates |
| VPC | Custom | Public subnet only |
| S3 Access | VPC Endpoint | Gateway (free) |

### Security

| Component | Service | Purpose |
|-----------|---------|---------|
| Secrets | SSM Parameter Store | Clerk keys, DB passwords, Restic password |
| Auth | Clerk (external) | JWT validation |
| Firewall | Security Groups | Restrict to CloudFront/API Gateway |

### Backup

| Component | Target | Retention |
|-----------|--------|-----------|
| PostgreSQL | S3 (pg_dump) | 7 days |
| Redis | S3 (RDB snapshot) | 7 days |
| Schedule | Daily 3 AM UTC | Cron |

---

## Cost Breakdown

| Service | Configuration | Monthly |
|---------|---------------|---------|
| EC2 m7g.medium | Graviton3, eu-west-1 | ~$30 |
| EBS gp3 (root) | 10GB (disposable, from AMI) | ~$1 |
| EBS gp3 (data) | 20GB (persistent, /data) | ~$2 |
| Elastic IP | Attached to EC2 | Free |
| S3 | Backups + releases + static | ~$2 |
| CloudFront | CDN + Origin Shield | ~$5 |
| API Gateway | HTTP API | ~$2 |
| Route 53 | Hosted zone | ~$0.50 |
| SSM Parameter Store | SecureString params | Free* |
| NAT Gateway | Not needed (Packer AMI) | $0 |
| **Total** | | **~$42.50/month** |

*SSM Parameter Store Standard tier is free for up to 10,000 parameters

---

## Story Breakdown

### Story 7.1: AWS CDK Project Setup

**As a** developer,
**I want** AWS CDK infrastructure as code,
**So that** I can reproducibly deploy and manage AWS resources.

**Acceptance Criteria:**
- [ ] CDK project initialized with TypeScript
- [ ] Separate stacks: Network, Compute, CDN, DNS
- [ ] Environment config for prod (dev stays on Fly.io)
- [ ] GitHub Actions workflow for CDK deploy

**Work Items:**
1. Initialize CDK project in `/infrastructure`
2. Configure AWS credentials in GitHub Secrets
3. Create base stack structure
4. Set up CDK pipeline in GitHub Actions

**Estimated:** 3 points

---

### Story 7.2: Packer AMI Build Pipeline

**As a** developer,
**I want** a Packer-built AMI with all dependencies,
**So that** EC2 instances boot instantly without NAT Gateway.

**Acceptance Criteria:**
- [ ] Packer template for Amazon Linux 2023 ARM64
- [ ] PostgreSQL 16 + PostGIS installed
- [ ] Redis 7 installed
- [ ] Go API binary included
- [ ] Systemd services configured
- [ ] Backup scripts included
- [ ] GitHub Actions builds AMI on release

**Work Items:**
1. Create Packer template (`zmanim-ami.pkr.hcl`)
2. Write systemd service files for all components
3. Write backup script
4. Configure PostgreSQL (pg_hba.conf, postgresql.conf)
5. Configure Redis (redis.conf)
6. GitHub Actions workflow to build AMI
7. Store AMI ID in SSM Parameter Store

**Estimated:** 8 points

---

### Story 7.3: VPC & Network Infrastructure

**As a** developer,
**I want** a secure VPC with public subnet,
**So that** EC2 can serve traffic without NAT Gateway costs.

**Acceptance Criteria:**
- [ ] VPC with public subnet in eu-west-1
- [ ] Internet Gateway attached
- [ ] S3 VPC Gateway Endpoint (free)
- [ ] Security group: Allow 443 from CloudFront, 22 from admin IPs
- [ ] No NAT Gateway (Packer AMI handles dependencies)

**Work Items:**
1. CDK: Create VPC with single public subnet
2. CDK: Create Internet Gateway
3. CDK: Create S3 Gateway Endpoint
4. CDK: Create Security Groups
5. Document network architecture

**Estimated:** 3 points

---

### Story 7.4: EC2 Instance & EBS Storage

**As a** developer,
**I want** an EC2 instance running the Packer AMI,
**So that** I have zero cold start compute.

**Acceptance Criteria:**
- [ ] m7g.medium instance from Packer AMI
- [ ] Root EBS volume: 10GB gp3 (from AMI, disposable)
- [ ] Data EBS volume: 20GB gp3 (persistent, survives AMI upgrades)
- [ ] Data volume mounted at `/data` with PostgreSQL + Redis data dirs
- [ ] Elastic IP attached
- [ ] IAM role for S3 backup, Secrets Manager access, SSM Run Command
- [ ] User data script mounts data volume, pulls secrets, starts services
- [ ] CloudWatch agent for metrics/logs

**Work Items:**
1. CDK: Create EC2 instance from AMI
2. CDK: Create persistent Data EBS volume (separate from root)
3. CDK: Create and attach Elastic IP
4. CDK: Create IAM role with policies (S3, Secrets Manager, SSM)
5. Write user data startup script (mount /data, configure paths)
6. Configure PostgreSQL to use /data/postgres
7. Configure Redis to use /data/redis
8. Configure CloudWatch agent

**Estimated:** 5 points

---

### Story 7.5: S3 Buckets & Restic Backup Configuration

**As a** developer,
**I want** S3 buckets for backups and static assets with Restic streaming backups,
**So that** data is durable, encrypted, and frontend is served from CDN.

**Acceptance Criteria:**
- [ ] `zmanim-backups-prod` bucket for Restic repository
- [ ] `zmanim-releases-prod` bucket for API binaries
- [ ] `zmanim-static-prod` bucket for Next.js assets
- [ ] Restic installed in AMI, configured for S3 streaming
- [ ] systemd timer runs backup daily at 3 AM UTC
- [ ] Email notification on backup failure via SES
- [ ] Backup verification (weekly `restic check`)

**Work Items:**
1. CDK: Create backup bucket (Restic manages retention)
2. CDK: Create releases bucket for API binaries
3. CDK: Create static assets bucket
4. CDK: Configure bucket policies for VPC endpoint access
5. CDK: Configure SES for backup failure emails
6. Configure Restic environment file (pulls secrets at boot)
7. Create backup.sh script with pg_dump/redis streaming
8. Create systemd service + timer for backup
9. Create failure notification service
10. Test backup and restore procedures

**Estimated:** 5 points

---

### Story 7.6: CloudFront Distribution

**As a** developer,
**I want** CloudFront CDN in front of API and static assets,
**So that** US/Israel users get fast edge-cached responses.

**Acceptance Criteria:**
- [ ] CloudFront distribution with Origin Shield (eu-west-1)
- [ ] Origin 1: API Gateway (dynamic)
- [ ] Origin 2: S3 bucket (static)
- [ ] Cache policy: 1 hour for zmanim, 1 year for static
- [ ] Behaviors: `/api/*` → API Gateway, `/*` → S3
- [ ] HTTPS only, HTTP → HTTPS redirect
- [ ] Custom domain: zmanim.shtetl.io

**Work Items:**
1. CDK: Create CloudFront distribution
2. CDK: Configure Origin Shield
3. CDK: Create cache policies
4. CDK: Configure behaviors and origins
5. CDK: Attach ACM certificate
6. Test edge caching from US/Israel

**Estimated:** 5 points

---

### Story 7.7: API Gateway Configuration

**As a** developer,
**I want** API Gateway routing requests to EC2,
**So that** I get request logging, throttling, and Clerk JWT validation.

**Acceptance Criteria:**
- [ ] HTTP API (not REST - lower latency)
- [ ] Integration: HTTP proxy to EC2 Elastic IP
- [ ] Authorizer: Clerk JWT validation
- [ ] Throttling: Default limits configured
- [ ] CORS configured for frontend domain
- [ ] Access logs to CloudWatch

**Work Items:**
1. CDK: Create HTTP API
2. CDK: Create JWT authorizer for Clerk
3. CDK: Configure routes and integrations
4. CDK: Configure throttling
5. CDK: Configure CORS
6. CDK: Enable access logging

**Estimated:** 5 points

---

### Story 7.8: Route 53 & SSL Certificates

**As a** developer,
**I want** DNS and SSL configured,
**So that** zmanim.shtetl.io serves over HTTPS.

**Acceptance Criteria:**
- [ ] Import shtetl.io domain to Route 53 (or configure external DNS)
- [ ] ACM certificate for zmanim.shtetl.io
- [ ] DNS validation for certificate
- [ ] A record pointing to CloudFront distribution
- [ ] Health check configured

**Work Items:**
1. CDK: Create hosted zone (or document external DNS)
2. CDK: Request ACM certificate
3. CDK: Configure DNS validation
4. CDK: Create A record alias to CloudFront
5. CDK: Create health check

**Estimated:** 3 points

---

### Story 7.9: SSM Parameter Store Configuration

**As a** developer,
**I want** secrets stored in SSM Parameter Store,
**So that** sensitive config isn't in code or AMI, and costs $0.

**Acceptance Criteria:**
- [ ] SSM SecureString: `/zmanim/prod/clerk-secret-key`
- [ ] SSM SecureString: `/zmanim/prod/postgres-password`
- [ ] SSM SecureString: `/zmanim/prod/restic-password`
- [ ] SSM String: `/zmanim/prod/config` (non-sensitive)
- [ ] EC2 pulls parameters at boot via IAM role
- [ ] User data script exports to environment

**Work Items:**
1. CDK: Create SSM parameters (SecureString for secrets)
2. CDK: IAM policy for ssm:GetParameter on `/zmanim/prod/*`
3. Update user data script to pull and export parameters
4. Configure environment variables for Go API
5. Configure Restic environment from SSM
6. Test parameter retrieval at boot

**Estimated:** 2 points

---

### Story 7.10: Data Migration & Go-Live

**As a** developer,
**I want** to migrate production data from Xata to AWS PostgreSQL,
**So that** the new infrastructure has all existing data.

**Acceptance Criteria:**
- [ ] Export data from Xata PostgreSQL
- [ ] Import to AWS PostgreSQL
- [ ] Verify data integrity (row counts, checksums)
- [ ] Test all API endpoints against new DB
- [ ] DNS cutover plan documented
- [ ] Rollback plan documented
- [ ] Successful go-live with zero downtime

**Work Items:**
1. Create migration script (pg_dump/pg_restore)
2. Test migration on staging
3. Document cutover procedure
4. Document rollback procedure
5. Execute migration during low-traffic window
6. Verify and monitor post-migration
7. Update DNS to point to new infrastructure

**Estimated:** 5 points

---

## Packer AMI Contents

### Base Image
- Amazon Linux 2023 ARM64

### Installed Software
```
PostgreSQL 16
  - PostGIS 3.4
  - pg_cron extension
  - Configured for /data/postgres

Redis 7
  - Persistence enabled (RDB + AOF)
  - Memory limit: 1GB
  - Configured for /data/redis

Go API Binary
  - /opt/zmanim/zmanim-api
  - Built for linux/arm64

Restic
  - Backup tool with S3 streaming
  - Encryption + deduplication

AWS CLI v2
  - For SSM, Secrets Manager, SES

CloudWatch Agent
  - Metrics and log shipping
```

### Systemd Services
```
zmanim-api.service    - Go API (depends on PostgreSQL, Redis)
postgresql.service    - Database
redis.service         - Cache
backup.timer          - Daily backup trigger
```

### Configuration Files
```
/etc/postgresql/16/main/postgresql.conf
/etc/postgresql/16/main/pg_hba.conf
/etc/redis/redis.conf
/opt/zmanim/config.env.template
/opt/zmanim/backup.sh
```

---

## Backup Strategy

Uses [Restic](https://restic.net/) for encrypted, deduplicated backups streaming directly to S3.
Based on [restic-amazon-backup](https://github.com/breakerh/restic-amazon-backup).

### Backup Architecture

```
┌─────────────────────────────────────────────────────┐
│  Backup Flow (no local staging)                     │
│                                                     │
│  pg_dump ─────┐                                     │
│               ├──→ restic backup --stdin ──→ S3    │
│  redis-cli ───┘                                     │
│                                                     │
│  systemd timer (daily 3 AM) ──→ restic-backup.service│
│                                      │              │
│                              OnFailure=email.service│
└─────────────────────────────────────────────────────┘
```

### Why Restic

| Feature | Benefit |
|---------|---------|
| Stdin streaming | No local disk staging needed |
| Deduplication | Efficient incremental backups |
| Encryption | AES-256 at rest |
| S3 native | Direct upload via VPC endpoint |
| Prune/forget | Built-in retention policies |

### Restic Environment File

Generated at boot from SSM Parameter Store:

```bash
# /etc/restic/env (generated by user-data script)
AWS_DEFAULT_REGION=eu-west-1
RESTIC_REPOSITORY=s3:s3.eu-west-1.amazonaws.com/zmanim-backups-prod
RESTIC_PASSWORD=$(aws ssm get-parameter --name /zmanim/prod/restic-password --with-decryption --query Parameter.Value --output text)
# Note: S3 access via IAM instance role, no access keys needed
```

### Backup Script

```bash
#!/bin/bash
# /opt/zmanim/backup.sh

set -euo pipefail

source /etc/restic/env

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# PostgreSQL backup (streams directly to S3)
echo "[$TIMESTAMP] Backing up PostgreSQL..."
sudo -u postgres pg_dump -Fc zmanim | restic backup --stdin --stdin-filename postgres.dump

# Redis backup (streams directly to S3)
echo "[$TIMESTAMP] Backing up Redis..."
redis-cli --rdb - | restic backup --stdin --stdin-filename redis.rdb

# Prune old backups (keep 7 daily, 4 weekly, 3 monthly)
echo "[$TIMESTAMP] Pruning old snapshots..."
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune

# Verify repository integrity (weekly)
if [ "$(date +%u)" -eq 7 ]; then
    echo "[$TIMESTAMP] Running integrity check..."
    restic check
fi

echo "[$TIMESTAMP] Backup completed"
```

### systemd Service

```ini
# /etc/systemd/system/restic-backup.service
[Unit]
Description=Restic Backup to S3
OnFailure=backup-notify@%n.service

[Service]
Type=oneshot
User=root
EnvironmentFile=/etc/restic/env
ExecStart=/opt/zmanim/backup.sh
StandardOutput=journal
StandardError=journal
```

### systemd Timer

```ini
# /etc/systemd/system/restic-backup.timer
[Unit]
Description=Daily Restic Backup at 3 AM UTC

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

### Email Notification on Failure

```ini
# /etc/systemd/system/backup-notify@.service
[Unit]
Description=Backup Failure Email Notification

[Service]
Type=oneshot
ExecStart=/opt/zmanim/notify-failure.sh %i
```

```bash
#!/bin/bash
# /opt/zmanim/notify-failure.sh

SERVICE_NAME=$1
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
HOSTNAME=$(hostname)

# Send via AWS SES (or postfix/sendmail)
aws ses send-email \
  --from "backup@zmanim.shtetl.io" \
  --to "admin@shtetl.io" \
  --subject "🚨 Backup Failed: $SERVICE_NAME on $HOSTNAME" \
  --text "Backup service $SERVICE_NAME failed at $TIMESTAMP on $HOSTNAME.

Check logs with: journalctl -u $SERVICE_NAME"
```

### Restore Procedure

```bash
# List available snapshots
restic snapshots

# Restore PostgreSQL (latest)
restic dump latest postgres.dump | pg_restore -d zmanim -c

# Restore PostgreSQL (specific snapshot)
restic dump abc123 postgres.dump | pg_restore -d zmanim -c

# Restore Redis
systemctl stop redis
restic dump latest redis.rdb > /data/redis/dump.rdb
chown redis:redis /data/redis/dump.rdb
systemctl start redis
```

### Initialize Restic Repository (One-Time)

```bash
# Run during initial setup
source /etc/restic/env
restic init
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy-prod.yml

name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

env:
  AWS_REGION: eu-west-1

jobs:
  build-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.24'

      - name: Build Go binary
        run: |
          cd api
          GOOS=linux GOARCH=arm64 go build -o ../bin/zmanim-api ./cmd/api

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: zmanim-api
          path: bin/zmanim-api

  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Next.js
        run: |
          cd web
          npm ci
          npm run build

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: frontend
          path: web/out

  build-ami:
    needs: build-api
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download API binary
        uses: actions/download-artifact@v4
        with:
          name: zmanim-api
          path: bin/

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Build AMI with Packer
        run: |
          cd infrastructure/packer
          packer init .
          packer build -var "version=${{ github.ref_name }}" zmanim-ami.pkr.hcl

  deploy:
    needs: [build-ami, build-frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Download frontend
        uses: actions/download-artifact@v4
        with:
          name: frontend
          path: frontend/

      - name: Deploy frontend to S3
        run: |
          aws s3 sync frontend/ s3://zmanim-static-prod/ --delete
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }} --paths "/*"

      - name: Deploy infrastructure with CDK
        run: |
          cd infrastructure/cdk
          npm ci
          npx cdk deploy --all --require-approval never
```

---

## Frontend Deployment (Static Export)

The Next.js frontend is deployed as a static export to S3 + CloudFront.

### Configuration

```js
// web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Static HTML export for S3
  trailingSlash: true,  // Better S3 compatibility
  images: {
    unoptimized: true,  // No image optimization server
  },
}

module.exports = nextConfig
```

### Environment Variables (Build-Time)

All `NEXT_PUBLIC_*` vars are baked into the JS bundle at build time:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.zmanim.shtetl.io` | Go API endpoint |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_xxx` | Clerk auth (public) |

```yaml
# GitHub Actions build
- name: Build Next.js for Production
  env:
    NEXT_PUBLIC_API_URL: https://api.zmanim.shtetl.io
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY }}
  run: |
    cd web
    npm ci
    npm run build
```

### S3 + CloudFront Setup

```
┌─────────────────────────────────────────────────────┐
│  CloudFront Distribution                            │
│  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ Behavior: /*    │  │ Behavior: /api/*        │  │
│  │ Origin: S3      │  │ Origin: API Gateway     │  │
│  │ Cache: 1 year   │  │ Cache: 1 hour           │  │
│  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────┘
           ↓                        ↓
    S3 (static assets)      API Gateway → EC2
```

### SPA Routing (CloudFront Function)

Handle client-side routing by returning `index.html` for missing paths:

```js
// CloudFront Function for SPA routing
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // If no file extension, serve index.html
  if (!uri.includes('.')) {
    request.uri = '/index.html';
  }

  return request;
}
```

### Deploy Process

```bash
# Build static export
cd web && npm run build

# Output in web/out/
# Sync to S3
aws s3 sync out/ s3://zmanim-static-prod/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

### Static Export Limitations

| Feature | Supported | Alternative |
|---------|-----------|-------------|
| Client components | ✅ | - |
| API calls to Go backend | ✅ | - |
| `next/image` optimization | ❌ | Use `unoptimized: true` |
| Server components | ❌ | Use client components |
| API routes (`/api/*`) | ❌ | Go API handles all endpoints |
| Middleware | ❌ | CloudFront Functions |

---

## Development Environment

**Development stays on current stack:**

| Component | Dev Environment | Production |
|-----------|-----------------|------------|
| API | Fly.io | AWS EC2 |
| Frontend | Vercel | AWS S3 + CloudFront |
| Database | Xata PostgreSQL | AWS EC2 PostgreSQL |
| Cache | Upstash Redis | AWS EC2 Redis |
| Domain | zmanim.shtetl.dev | zmanim.shtetl.io |

This separation keeps dev costs minimal while production gets optimized AWS infrastructure.

---

## Monitoring & Alerting

### CloudWatch Metrics
- EC2: CPU, Memory, Disk, Network
- API Gateway: Latency, 4xx, 5xx errors
- CloudFront: Cache hit ratio, Origin latency

### CloudWatch Alarms
- EC2 CPU > 80% for 5 minutes
- EC2 Disk > 80% used
- API Gateway 5xx > 1% for 5 minutes
- Backup job failed (custom metric)

### CloudWatch Logs
- Go API application logs
- PostgreSQL error logs
- Redis logs
- Backup job logs

---

## Deployment Strategy

### Storage Architecture

```
┌─────────────────────────────────────────┐
│  EC2 Instance (from AMI)                │
│  ┌─────────────┐  ┌───────────────────┐ │
│  │ Root EBS    │  │ Data EBS          │ │
│  │ 10GB gp3    │  │ 20GB gp3          │ │
│  │ /           │  │ /data             │ │
│  │ (from AMI)  │  │ - /data/postgres  │ │
│  │ disposable  │  │ - /data/redis     │ │
│  └─────────────┘  └───────────────────┘ │
│        ↓                   ↓            │
│   Replaced on         Persists across   │
│   AMI upgrade         AMI upgrades      │
└─────────────────────────────────────────┘
```

### Path 1: AMI Update (Infrastructure Change)

Use when: PostgreSQL/Redis version upgrade, OS patches, systemd config changes

```
1. Stop EC2 instance
2. Detach Data EBS volume (/data)
3. Terminate old instance (root volume deleted)
4. Launch new instance from new AMI
5. Attach Data EBS volume to new instance
6. Instance starts, systemd auto-starts services

Downtime: ~2-3 minutes
Data: Preserved (same EBS)
Triggered by: New AMI version tag
```

### Path 2: API Binary Update (Code Change Only)

Use when: Go API code changes, no infrastructure changes needed

```
1. GitHub Actions triggers SSM Run Command
2. SSM executes: systemctl restart zmanim-api
3. systemd ExecStartPre downloads latest binary
4. systemd starts zmanim-api

Downtime: ~5-10 seconds
AMI: Unchanged
Triggered by: Release tag (non-AMI)
```

### Systemd Service Configuration

```ini
# /etc/systemd/system/zmanim-api.service
[Unit]
Description=Zmanim API
After=postgresql.service redis.service
Requires=postgresql.service redis.service

[Service]
Type=simple
User=zmanim
WorkingDirectory=/opt/zmanim
ExecStartPre=/opt/zmanim/download-latest.sh
ExecStart=/opt/zmanim/zmanim-api
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/zmanim/config.env

[Install]
WantedBy=multi-user.default
```

### Binary Download Script

```bash
#!/bin/bash
# /opt/zmanim/download-latest.sh

set -euo pipefail

BUCKET="zmanim-releases-prod"
BINARY_PATH="/opt/zmanim/zmanim-api"

# Get latest version from S3
LATEST=$(aws s3 cp s3://$BUCKET/latest.txt -)

# Download if different
CURRENT=$(cat /opt/zmanim/version.txt 2>/dev/null || echo "none")
if [ "$LATEST" != "$CURRENT" ]; then
    echo "Updating from $CURRENT to $LATEST"
    aws s3 cp s3://$BUCKET/zmanim-api-$LATEST $BINARY_PATH
    chmod +x $BINARY_PATH
    echo $LATEST > /opt/zmanim/version.txt
else
    echo "Already at version $LATEST"
fi
```

### GitHub Actions: Binary Deploy (Path 2)

```yaml
# Triggered on release tags that don't require AMI rebuild
- name: Upload binary to S3
  run: |
    aws s3 cp bin/zmanim-api s3://zmanim-releases-prod/zmanim-api-${{ github.ref_name }}
    echo "${{ github.ref_name }}" | aws s3 cp - s3://zmanim-releases-prod/latest.txt

- name: Restart API via SSM
  run: |
    aws ssm send-command \
      --instance-ids ${{ secrets.EC2_INSTANCE_ID }} \
      --document-name "AWS-RunShellScript" \
      --parameters 'commands=["systemctl restart zmanim-api"]'
```

### GitHub Actions: AMI Deploy (Path 1)

```yaml
# Triggered on AMI rebuild tags (e.g., v1.0.0-ami)
- name: Build new AMI with Packer
  run: packer build zmanim-ami.pkr.hcl

- name: Replace EC2 instance
  run: |
    # Stop and detach data volume
    aws ec2 stop-instances --instance-ids $OLD_INSTANCE_ID
    aws ec2 wait instance-stopped --instance-ids $OLD_INSTANCE_ID
    aws ec2 detach-volume --volume-id $DATA_VOLUME_ID

    # Terminate old, launch new
    aws ec2 terminate-instances --instance-ids $OLD_INSTANCE_ID
    NEW_INSTANCE_ID=$(aws ec2 run-instances --image-id $NEW_AMI_ID ... --query 'Instances[0].InstanceId' --output text)

    # Attach data volume and EIP
    aws ec2 wait instance-running --instance-ids $NEW_INSTANCE_ID
    aws ec2 attach-volume --volume-id $DATA_VOLUME_ID --instance-id $NEW_INSTANCE_ID --device /dev/sdf
    aws ec2 associate-address --instance-id $NEW_INSTANCE_ID --allocation-id $EIP_ALLOCATION_ID
```

---

## Future Scaling Path

When traffic grows beyond single EC2:

1. **Database**: Move PostgreSQL to RDS (~$15/mo)
2. **Cache**: Move Redis to ElastiCache (~$12/mo)
3. **Compute**: Add second EC2 behind ALB
4. **Advanced**: Consider Citus for horizontal DB scaling

---

## Summary

| Aspect | Choice |
|--------|--------|
| **Region** | eu-west-1 (Ireland) |
| **Compute** | EC2 m7g.medium (Graviton3) |
| **Database** | PostgreSQL 16 + PostGIS (local) |
| **Cache** | Redis 7 (local) |
| **CDN** | CloudFront + Origin Shield |
| **Frontend** | S3 + CloudFront |
| **API Routing** | API Gateway (HTTP) |
| **DNS** | Route 53 / zmanim.shtetl.io |
| **Auth** | Clerk (external) |
| **IaC** | AWS CDK (TypeScript) |
| **AMI** | Packer (no NAT Gateway) |
| **Backups** | Restic → S3 |
| **CI/CD** | GitHub Actions |
| **Cost** | ~$42.50/month |

---

## Story Summary

| Story | Title | Points |
|-------|-------|--------|
| 7.1 | AWS CDK Project Setup | 3 |
| 7.2 | Packer AMI Build Pipeline | 8 |
| 7.3 | VPC & Network Infrastructure | 3 |
| 7.4 | EC2 Instance & EBS Storage | 5 |
| 7.5 | S3 Buckets & Restic Backup Configuration | 5 |
| 7.6 | CloudFront Distribution | 5 |
| 7.7 | API Gateway Configuration | 5 |
| 7.8 | Route 53 & SSL Certificates | 3 |
| 7.9 | SSM Parameter Store Configuration | 2 |
| 7.10 | Data Migration & Go-Live | 5 |
| **Total** | | **44 points** |

---

**Generated:** 2025-12-10
**Status:** READY FOR REVIEW
