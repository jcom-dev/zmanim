# Epic Technical Specification: AWS Migration & Infrastructure

Date: 2025-12-10
Author: BMad
Epic ID: 7
Status: Draft

---

## Overview

Epic 7 migrates Shtetl Zmanim production environment from the current multi-vendor infrastructure (Fly.io for API, Vercel for frontend, Xata for PostgreSQL, Upstash for Redis) to a unified AWS infrastructure. The architecture prioritizes **zero cold starts**, **low latency for US/Israel users**, and **cost efficiency** (~$44/month).

The migration implements a single EC2 m7g.medium (Graviton3) instance in eu-west-1 (Ireland) running PostgreSQL 16 + PostGIS, Redis 7, and the Go API as co-located services. This eliminates network latency between components and guarantees always-on availability without serverless cold start penalties. CloudFront CDN with Origin Shield provides global edge caching for API responses and static frontend assets.

**Key Innovation:** Packer AMI pre-baking eliminates NAT Gateway costs (~$32/month savings) by installing all dependencies at image build time rather than runtime.

## Objectives and Scope

### In Scope

- **AWS Infrastructure as Code (CDK):** TypeScript-based CDK project with separate stacks for Network, Compute, CDN, and DNS
- **Packer AMI Pipeline:** Pre-baked Amazon Linux 2023 ARM64 image with PostgreSQL 16, PostGIS 3.4, Redis 7, and Go API binary
- **VPC & Networking:** Public subnet VPC in eu-west-1, S3 Gateway Endpoint (free), no NAT Gateway
- **EC2 Compute:** m7g.medium instance with separate root (10GB) and persistent data (20GB) EBS volumes
- **S3 Storage:** Three buckets for backups (Restic), releases (API binaries), and static assets (Next.js export)
- **CloudFront CDN:** Origin Shield enabled, cache policies for API (1 hour) and static (1 year)
- **API Gateway:** HTTP API (not REST) with Clerk JWT authorizer and throttling
- **Route 53 DNS:** zmanim.shtetl.io domain with ACM certificate
- **SSM Parameter Store:** Secrets management (free tier) for Clerk keys, DB passwords, Restic password
- **Restic Backup:** Streaming backups to S3 with 7-day retention, email notifications on failure
- **Data Migration:** pg_dump/pg_restore from Xata to AWS PostgreSQL with verification
- **CI/CD:** GitHub Actions workflows for AMI builds, binary deploys, and frontend sync

### Out of Scope

- Development environment migration (stays on Fly.io/Vercel/Xata/Upstash)
- Multi-AZ redundancy (single instance architecture)
- Auto-scaling (fixed capacity, scale path documented for future)
- Database replication (single PostgreSQL instance)
- Kubernetes/ECS orchestration (systemd-managed services)
- WAF/Shield Advanced (basic CloudFront security only)

## System Architecture Alignment

This epic creates a **new production deployment target** while preserving the existing application architecture:

**Preserved Components:**
- Go API codebase (unchanged, different hosting)
- Next.js frontend (static export instead of SSR)
- PostgreSQL schema and data model (pg_dump/pg_restore compatible)
- Redis caching patterns (same configuration)
- Clerk authentication (JWT validation continues unchanged)
- API contracts and endpoints (no breaking changes)

**Architecture Changes:**
- Frontend: Vercel SSR → S3 static export + CloudFront (requires `next.config.js` output: 'export')
- Database: Xata managed PostgreSQL → Self-managed PostgreSQL on EC2
- Cache: Upstash REST Redis → Self-managed Redis on EC2
- API hosting: Fly.io → EC2 with systemd
- CDN: None → CloudFront with Origin Shield

**Infrastructure Pattern Alignment:**
- IaC: Follows AWS CDK best practices with L2/L3 constructs
- Immutable deployments: Packer AMI ensures reproducible infrastructure
- Separation of concerns: Data volume persists across AMI upgrades
- Cost optimization: No NAT Gateway, S3 Gateway Endpoint, Graviton3 ARM64

## Detailed Design

### Services and Modules

| Component | Technology | Location | Port | Responsibility |
|-----------|------------|----------|------|----------------|
| Go API | Go 1.24 binary | `/opt/zmanim/zmanim-api` | 8080 | HTTP REST API, calculation engine |
| PostgreSQL | PostgreSQL 16 + PostGIS 3.4 | `/data/postgres` | 5432 (socket) | Primary database |
| Redis | Redis 7 | `/data/redis` | 6379 | Zmanim calculation cache |
| CloudFront | AWS CloudFront | Edge | 443 | CDN, SSL termination |
| API Gateway | AWS HTTP API | Regional | 443 | Routing, JWT validation, throttling |
| S3 Static | AWS S3 | Regional | - | Next.js static assets |
| Restic | Restic binary | `/opt/zmanim/backup.sh` | - | Backup to S3 |

**systemd Service Dependencies:**
```
zmanim-api.service
├── After: postgresql.service
├── After: redis.service
└── Requires: postgresql.service, redis.service
```

### Data Models and Contracts

**No schema changes required.** The migration preserves the existing PostgreSQL schema:

```sql
-- Core tables (unchanged)
publishers          -- Publisher profiles
master_zmanim_registry  -- Canonical zman definitions
publisher_zmanim    -- Publisher's custom zmanim
publisher_coverage  -- Geographic coverage
cities              -- ~163k cities with PostGIS geometry
```

**New AWS Resources (CDK):**

```typescript
// Network Stack
VPC:
  cidr: '10.0.0.0/16'
  subnets: [PublicSubnet(az: 'eu-west-1a')]
  internetGateway: true
  natGateway: false

SecurityGroup:
  ingress:
    - port: 443, source: CloudFrontPrefixList
    - port: 22, source: AdminCIDR
  egress: all

// Compute Stack
EC2Instance:
  type: 'm7g.medium'
  ami: PackerBuiltAMI
  role: ZmanimInstanceRole

EBSVolume(data):
  size: 20GB
  type: gp3
  mountPoint: '/data'

ElasticIP:
  attached: EC2Instance

// Storage Stack
S3Bucket(backups):
  name: 'zmanim-backups-prod'
  encryption: AES256

S3Bucket(releases):
  name: 'zmanim-releases-prod'

S3Bucket(static):
  name: 'zmanim-static-prod'
  websiteHosting: true
```

### APIs and Interfaces

**No API changes.** All existing endpoints continue unchanged:

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/zmanim` | Public | Calculate zmanim |
| GET | `/api/cities` | Public | Search cities |
| GET | `/api/publishers` | Public | List publishers |
| GET | `/api/publisher/*` | JWT | Publisher management |
| GET | `/api/admin/*` | JWT+Admin | Admin operations |

**New Infrastructure Endpoints:**

| Service | Endpoint | Purpose |
|---------|----------|---------|
| CloudFront | `https://zmanim.shtetl.io/*` | User-facing CDN |
| API Gateway | `https://api.zmanim.shtetl.io/*` | API routing |
| S3 Static | `/*` (via CloudFront) | Static assets |

**API Gateway Configuration:**
```yaml
HTTP API:
  routes:
    - path: '/api/*'
      method: ANY
      integration: HttpProxy(EC2_ELASTIC_IP:8080)
      authorizer: ClerkJWT (routes requiring auth)
  throttling:
    burstLimit: 1000
    rateLimit: 500
  cors:
    origins: ['https://zmanim.shtetl.io']
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    headers: ['Authorization', 'Content-Type', 'X-Publisher-Id']
```

### Workflows and Sequencing

**Deployment Flow (AMI Update - Path 1):**
```
1. GitHub tag push (v*.*.* -ami)
     ↓
2. GitHub Actions: Build Go binary (linux/arm64)
     ↓
3. GitHub Actions: Packer build new AMI
     ↓
4. GitHub Actions: CDK deploy
     ├── Stop EC2 instance
     ├── Detach Data EBS volume
     ├── Terminate old instance
     ├── Launch new instance from AMI
     ├── Attach Data EBS volume
     └── Associate Elastic IP
     ↓
5. Instance boots, systemd starts services
     ↓
6. Health check passes
```

**Deployment Flow (Code Update - Path 2):**
```
1. GitHub tag push (v*.*.*)
     ↓
2. GitHub Actions: Build Go binary (linux/arm64)
     ↓
3. Upload binary to S3 releases bucket
     ↓
4. SSM Run Command: systemctl restart zmanim-api
     ├── ExecStartPre: download-latest.sh
     └── Start: zmanim-api
     ↓
5. Service running with new binary (~10s downtime)
```

**Backup Flow:**
```
Daily 3 AM UTC (systemd timer)
     ↓
restic-backup.service
     ├── pg_dump → restic backup --stdin → S3
     ├── redis-cli --rdb → restic backup --stdin → S3
     └── restic forget --keep-daily 7 --prune
     ↓
OnFailure → backup-notify.service → SES email
```

**Request Flow:**
```
User → CloudFront (edge cache check)
     ↓ (cache miss)
CloudFront → Origin Shield (regional cache)
     ↓ (cache miss)
API Gateway → Clerk JWT validation
     ↓
EC2:8080 (Go API)
     ├── Redis cache check
     └── PostgreSQL query
     ↓
Response → Cache at Origin Shield → Cache at Edge
```

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Cold start latency | 0ms | No cold starts (always-on EC2) |
| API response (cached, edge) | <50ms | CloudFront edge hit |
| API response (cached, origin) | <100ms | Origin Shield hit |
| API response (uncached) | <200ms | Direct EC2 calculation |
| Frontend TTFB | <100ms | CloudFront static |
| Database query | <50ms | PostgreSQL with indexes |
| Cache lookup | <5ms | Local Redis |

**Performance Optimizations:**
- Co-located services eliminate network latency between API/DB/cache
- Origin Shield reduces origin requests by ~50%
- gp3 EBS with 3000 IOPS baseline
- Graviton3 ARM64 20% better price/performance vs x86

### Security

| Control | Implementation |
|---------|----------------|
| Transport encryption | HTTPS only (CloudFront, API Gateway) |
| Data encryption at rest | EBS encryption, S3 AES-256 |
| Secrets management | SSM Parameter Store SecureString |
| Authentication | Clerk JWT validation at API Gateway |
| Authorization | Unchanged application-level RBAC |
| Network isolation | Security groups restrict to CloudFront/admin IPs |
| SSH access | Key-based only, admin IP whitelist |

**Security Group Rules:**
```
Ingress:
  - 443/tcp from CloudFront Prefix List (managed)
  - 22/tcp from Admin CIDR (e.g., VPN IP)

Egress:
  - All traffic (S3 via Gateway Endpoint)
```

**SSM Parameters:**
```
/zmanim/prod/clerk-secret-key     (SecureString)
/zmanim/prod/postgres-password    (SecureString)
/zmanim/prod/restic-password      (SecureString)
/zmanim/prod/config               (String - non-sensitive)
```

### Reliability/Availability

| Metric | Target | Implementation |
|--------|--------|----------------|
| Availability | 99.5% | Single EC2 (no HA), rapid recovery |
| RTO (Recovery Time) | <30 min | Launch new instance from AMI |
| RPO (Data Loss) | <24 hours | Daily Restic backups |
| Backup success rate | 100% | Email alerts on failure |

**Recovery Procedures:**
1. **Instance failure:** Launch new instance from AMI, attach data volume
2. **Data corruption:** Restore from Restic backup (pg_restore)
3. **Region failure:** Manual migration to another region (future: multi-region)

**Health Checks:**
- Route 53 health check on `/health` endpoint
- CloudWatch alarm: StatusCheckFailed
- systemd: Restart=on-failure for all services

### Observability

| Signal | Source | Destination |
|--------|--------|-------------|
| Application logs | Go slog JSON | CloudWatch Logs |
| PostgreSQL logs | postgresql.service | CloudWatch Logs |
| Redis logs | redis.service | CloudWatch Logs |
| System metrics | CloudWatch Agent | CloudWatch Metrics |
| API metrics | API Gateway | CloudWatch Metrics |
| CDN metrics | CloudFront | CloudWatch Metrics |

**CloudWatch Alarms:**
```
- EC2 CPU > 80% for 5 minutes → SNS notification
- EC2 Disk > 80% used → SNS notification
- API Gateway 5xx > 1% for 5 minutes → SNS notification
- Backup job failed → Email via SES
```

**Dashboards:**
- Request latency (p50, p95, p99)
- Cache hit ratio
- Error rates by endpoint
- EC2 resource utilization

## Dependencies and Integrations

### Infrastructure Dependencies

| Dependency | Version | Purpose | Source |
|------------|---------|---------|--------|
| AWS CDK | ^2.x | Infrastructure as Code | npm |
| Packer | ^1.9 | AMI builds | hashicorp |
| Amazon Linux 2023 | ARM64 | Base OS | AWS |
| PostgreSQL | 16 | Database | dnf |
| PostGIS | 3.4 | Geographic queries | dnf |
| Redis | 7 | Caching | dnf |
| Restic | ^0.16 | Backups | dnf |
| AWS CLI | v2 | SSM, S3, SES | dnf |
| CloudWatch Agent | Latest | Metrics/logs | AWS |

### Application Dependencies (Unchanged)

**Go (api/go.mod):**
- go 1.24.0
- github.com/go-chi/chi/v5 v5.0.11
- github.com/jackc/pgx/v5 v5.7.2
- github.com/redis/go-redis/v9 v9.17.1
- github.com/clerk/clerk-sdk-go/v2 v2.5.0
- github.com/hebcal/hebcal-go v0.10.6

**Frontend (web/package.json):**
- next ^16.0.3
- react ^19.2.0
- @clerk/nextjs ^6.35.5
- @tanstack/react-query ^5.90.10

### External Integrations

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Clerk | Authentication | JWT validation, unchanged |
| GitHub Actions | CI/CD | AWS credentials in secrets |
| SES | Email notifications | Backup failure alerts |

## Acceptance Criteria (Authoritative)

### Story 7.1: AWS CDK Project Setup
1. CDK project initialized in `/infrastructure` with TypeScript
2. Stacks defined: NetworkStack, ComputeStack, CDNStack, DNSStack
3. Environment config supports prod (dev stays on Fly.io)
4. GitHub Actions workflow deploys CDK on tag push
5. AWS credentials configured in GitHub Secrets

### Story 7.2: Packer AMI Build Pipeline
1. Packer template builds Amazon Linux 2023 ARM64
2. PostgreSQL 16 + PostGIS installed and configured
3. Redis 7 installed with persistence enabled
4. Go API binary included in `/opt/zmanim/`
5. systemd services configured for all components
6. Backup scripts included
7. GitHub Actions builds AMI on release tag
8. AMI ID stored in SSM Parameter Store

### Story 7.3: VPC & Network Infrastructure
1. VPC created in eu-west-1 with public subnet
2. Internet Gateway attached
3. S3 VPC Gateway Endpoint configured (free)
4. Security group allows 443 from CloudFront, 22 from admin IPs
5. No NAT Gateway (Packer AMI handles dependencies)

### Story 7.4: EC2 Instance & EBS Storage
1. m7g.medium instance launches from Packer AMI
2. Root EBS: 10GB gp3 (from AMI, disposable)
3. Data EBS: 20GB gp3 (persistent, mounted at `/data`)
4. Elastic IP attached
5. IAM role grants S3, SSM, SES access
6. User data mounts data volume, pulls secrets, starts services
7. CloudWatch agent configured

### Story 7.5: S3 Buckets & Restic Backup
1. Three S3 buckets created (backups, releases, static)
2. Bucket policies allow VPC endpoint access
3. Restic configured for S3 streaming backups
4. systemd timer runs backup daily at 3 AM UTC
5. Email notification on backup failure via SES
6. Backup verification runs weekly

### Story 7.6: CloudFront Distribution
1. Distribution created with Origin Shield (eu-west-1)
2. Origin 1: API Gateway (dynamic, 1hr cache)
3. Origin 2: S3 (static, 1yr cache)
4. Behaviors route `/api/*` → API Gateway, `/*` → S3
5. HTTPS only with HTTP redirect
6. Custom domain: zmanim.shtetl.io

### Story 7.7: API Gateway Configuration
1. HTTP API (not REST) created
2. Integration proxies to EC2 Elastic IP
3. Clerk JWT authorizer configured
4. Throttling limits set (500 rps, 1000 burst)
5. CORS configured for frontend domain
6. Access logs sent to CloudWatch

### Story 7.8: Route 53 & SSL Certificates
1. ACM certificate requested for zmanim.shtetl.io
2. DNS validation configured
3. A record alias points to CloudFront
4. Health check monitors `/health` endpoint

### Story 7.9: SSM Parameter Store Configuration
1. SecureString parameters created for secrets
2. String parameter created for non-sensitive config
3. IAM policy grants EC2 ssm:GetParameter access
4. User data script exports parameters to environment

### Story 7.10: Data Migration & Go-Live
1. pg_dump exports data from Xata PostgreSQL
2. pg_restore imports to AWS PostgreSQL
3. Data integrity verified (row counts match)
4. All API endpoints tested against new DB
5. DNS cutover procedure documented
6. Rollback procedure documented
7. Go-live executed with zero data loss

## Traceability Mapping

| AC | Spec Section | Component | Test Approach |
|----|--------------|-----------|---------------|
| 7.1.1-5 | Services/CDK | /infrastructure | CDK synth, deploy dry-run |
| 7.2.1-8 | Packer AMI | /infrastructure/packer | AMI boot test, service check |
| 7.3.1-5 | VPC & Network | NetworkStack | VPC connectivity test |
| 7.4.1-7 | EC2 & EBS | ComputeStack | Instance health check |
| 7.5.1-6 | S3 & Backup | Restic scripts | Backup/restore cycle |
| 7.6.1-6 | CloudFront | CDNStack | Edge latency test |
| 7.7.1-6 | API Gateway | CDNStack | JWT validation test |
| 7.8.1-4 | Route 53 | DNSStack | DNS resolution test |
| 7.9.1-4 | SSM | ComputeStack | Parameter retrieval test |
| 7.10.1-7 | Migration | Migration scripts | Data integrity verification |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Single point of failure (no HA) | Medium | High | Document recovery procedure, test regularly |
| Data volume attachment failure | Low | High | Manual attachment procedure documented |
| Packer AMI drift from code | Medium | Medium | Version AMI, track in SSM |
| CloudFront cache issues | Low | Medium | Invalidation scripts ready |
| Cost overrun | Low | Low | Budget alerts configured |

### Assumptions

1. **Domain access:** shtetl.io DNS can be configured for Route 53 or external DNS with CNAME
2. **Clerk compatibility:** Clerk JWT validation works identically in API Gateway authorizer
3. **PostgreSQL compatibility:** Xata PostgreSQL export is standard pg_dump compatible
4. **Static export:** Next.js app can run as static export (no SSR features blocking)
5. **Region availability:** eu-west-1 has all required services (m7g, CloudFront Origin Shield)

### Open Questions

1. **Q:** Should we use Route 53 hosted zone or external DNS with CNAME?
   **A:** Decision needed based on domain registrar and existing DNS setup

2. **Q:** What admin IP ranges should be allowed for SSH?
   **A:** Need VPN or bastion host IP range from infrastructure team

3. **Q:** Should we enable detailed CloudWatch metrics (additional cost)?
   **A:** Start with basic, enable detailed if needed for debugging

4. **Q:** Multi-region DR: should we replicate to us-east-1 for US users?
   **A:** Out of scope for Epic 7, document in future scaling path

## Test Strategy Summary

### Test Levels

| Level | Scope | Tool | Coverage |
|-------|-------|------|----------|
| Unit | CDK constructs | CDK assertions | Stack synthesis |
| Integration | AWS resources | CDK deploy | Resource creation |
| E2E | Full system | Playwright | User flows |
| Load | Performance | k6 or Artillery | Latency targets |
| DR | Recovery | Manual | Backup/restore |

### Test Plan

1. **Pre-Migration Testing**
   - Deploy full infrastructure to staging account
   - Import subset of production data
   - Run existing E2E test suite against staging
   - Verify all API endpoints return expected results

2. **Migration Testing**
   - Perform dry-run migration on staging
   - Compare row counts between source and target
   - Run data integrity checksums
   - Test rollback procedure

3. **Post-Migration Testing**
   - Run full E2E test suite against production
   - Monitor CloudWatch metrics for 24 hours
   - Verify backup runs successfully
   - Test restore procedure with backup data

4. **Performance Testing**
   - Measure API latency from US and Israel
   - Verify CloudFront cache hit ratios
   - Test under 10x expected load
   - Verify no cold start latency

### Acceptance Test Cases

```
TC-7.1: CDK deploys all stacks without errors
TC-7.2: EC2 boots from AMI in <60 seconds
TC-7.3: API responds to /health within 5 seconds of boot
TC-7.4: CloudFront serves cached response with <50ms latency
TC-7.5: API Gateway validates Clerk JWT correctly
TC-7.6: Restic backup completes successfully
TC-7.7: Restic restore recovers PostgreSQL data
TC-7.8: DNS resolves zmanim.shtetl.io to CloudFront
TC-7.9: SSL certificate valid and trusted
TC-7.10: All E2E tests pass against new infrastructure
```
