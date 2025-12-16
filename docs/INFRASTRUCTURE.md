# Infrastructure

AWS deployment, CI/CD, and operations for Shtetl Zmanim.

---

## Production Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CloudFront                                  │
│                    (CDN, SSL Termination, Edge Cache)                   │
│                                                                         │
│                         zmanim.shtetl.io                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                  │                                       │
│    ┌─────────────────────────────┼─────────────────────────────┐        │
│    │                             │                             │        │
│    ▼                             ▼                             ▼        │
│                                                                         │
│  S3 Bucket              Next.js Lambda              API Gateway         │
│  (Static Assets)            (SSR)                 (HTTP API)           │
│  /_next/static/*              /*                  /backend/*           │
│                                                         │               │
│                                                         ▼               │
│                                              ┌──────────────────┐       │
│                                              │   EC2 Instance   │       │
│                                              │   (m7g.medium)   │       │
│                                              │                  │       │
│                                              │  ┌────────────┐  │       │
│                                              │  │  Go API    │  │       │
│                                              │  │  (:8080)   │  │       │
│                                              │  └──────┬─────┘  │       │
│                                              │         │        │       │
│                                              │  ┌──────┴─────┐  │       │
│                                              │  │ PostgreSQL │  │       │
│                                              │  │   (:5432)  │  │       │
│                                              │  └────────────┘  │       │
│                                              │                  │       │
│                                              │  ┌────────────┐  │       │
│                                              │  │   Redis    │  │       │
│                                              │  │   (:6379)  │  │       │
│                                              │  └────────────┘  │       │
│                                              │                  │       │
│                                              │  EBS Volume      │       │
│                                              │  /data (30GB)    │       │
│                                              └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AWS Resources

### CDK Stacks

All infrastructure defined in `infrastructure/lib/stacks/zmanim-prod.ts`:

| Stack | Purpose |
|-------|---------|
| GitHub OIDC | CI/CD authentication (no long-lived credentials) |
| Network | VPC, subnets, security groups |
| Compute | EC2 instance, EBS volume, Elastic IP |
| Storage | S3 buckets for static assets |
| Secrets | SSM Parameter Store for credentials |
| API Gateway | HTTP API with JWT authorizer |
| DNS | Route 53 hosted zone |
| Certificate | ACM certificate (us-east-1 for CloudFront) |
| Next.js | Lambda function, CloudFront distribution |
| Health Check | CloudWatch alarm for uptime |
| DNS Records | A record pointing to CloudFront |

### EC2 Instance

| Property | Value |
|----------|-------|
| Type | m7g.medium (ARM64 Graviton3) |
| vCPU | 1 |
| Memory | 4 GB |
| OS | Amazon Linux 2023 |
| Storage | 30 GB EBS gp3 |
| Cost | ~$35-50/month |

### Network Configuration

- **VPC:** Single AZ (eu-west-1a)
- **Subnets:** Public subnet only
- **Security Group:**
  - Inbound: 22 (SSH), 80 (HTTP), 443 (HTTPS)
  - Outbound: All traffic

---

## Configuration

### Environment

`infrastructure/lib/config.ts`:

```typescript
export const config = {
  environment: "prod",
  region: "eu-west-1",
  domain: "zmanim.shtetl.io",
  instanceType: "m7g.medium",
  dataVolumeSize: 30,
  enableHealthCheck: true,
};
```

### SSM Parameters

Secrets stored in AWS SSM Parameter Store:

| Parameter | Purpose |
|-----------|---------|
| `/zmanim/prod/postgres-password` | Database password |
| `/zmanim/prod/redis-password` | Redis password |
| `/zmanim/prod/clerk-secret-key` | Clerk API secret |
| `/zmanim/prod/clerk-publishable-key` | Clerk public key |
| `/zmanim/prod/jwt-secret` | JWT signing key |
| `/zmanim/prod/restic-password` | Backup encryption |
| `/zmanim/prod/origin-verify-key` | CloudFront-to-origin auth |
| `/zmanim/prod/mapbox-public-token` | Mapbox maps (public) |
| `/zmanim/prod/mapbox-api-key` | Mapbox API (private) |

---

## Deployment

### Frontend (Next.js)

Automatic on push to `main`:

```bash
git push origin main
# Triggers: .github/workflows/deploy-prod-frontend.yml
```

The workflow:
1. Builds Next.js app
2. Deploys to Lambda
3. Updates CloudFront distribution
4. Invalidates CloudFront cache

### Backend (Go API)

Manual deployment:

```bash
# SSH to EC2
ssh ec2-user@<elastic-ip>

# Pull latest code
cd /opt/zmanim && git pull

# Rebuild and restart
cd api && go build -o ../bin/api ./cmd/api
sudo systemctl restart zmanim-api
```

Or via GitHub Actions:

```bash
# Trigger manual workflow
gh workflow run deploy-prod-backend.yml
```

### Infrastructure Changes

```bash
cd infrastructure
npm install
npx cdk diff        # Preview changes
npx cdk deploy      # Deploy all stacks
```

### New AMI

For OS-level changes:

```bash
git tag v1.0.0-ami
git push origin v1.0.0-ami
# Triggers: .github/workflows/build-prod-ami.yml
```

This runs Packer to build a new AMI with latest packages.

---

## CI/CD Workflows

### Pull Request Checks

| Workflow | Trigger | Duration | Purpose |
|----------|---------|----------|---------|
| `pr-checks.yml` | PR to dev | 6-8 min | SQLc, linting, tests, build |
| `pr-e2e.yml` | PR to dev | 15-20 min | Playwright E2E tests |

### Deployment

| Workflow | Trigger | Duration | Purpose |
|----------|---------|----------|---------|
| `deploy-prod-frontend.yml` | Push to main | 5 min | Next.js to Lambda |
| `deploy-prod-backend.yml` | Manual | 10 min | Go API to EC2 |
| `deploy-prod-infrastructure.yml` | Manual | 20 min | CDK stacks |
| `build-prod-ami.yml` | Tag v*.* | 15 min | Packer AMI |

### GitHub OIDC

No long-lived AWS credentials. Workflows use OIDC to assume IAM roles:

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::ACCOUNT:role/zmanim-github-actions
    aws-region: eu-west-1
```

---

## Monitoring

### Health Check

CloudWatch alarm monitors API health:

```
GET https://zmanim.shtetl.io/backend/api/v1/health
Expected: HTTP 200, body contains "healthy"
Interval: 1 minute
```

Alert sent to configured SNS topic on failure.

### Logs

```bash
# SSH to EC2
ssh ec2-user@<elastic-ip>

# API logs
sudo journalctl -u zmanim-api -f

# PostgreSQL logs
sudo journalctl -u postgresql -f

# Redis logs
sudo journalctl -u redis -f

# System logs
tail -f /var/log/messages
```

### Metrics

CloudWatch metrics available:
- EC2 CPU/Memory/Disk
- API Gateway request count, latency
- Lambda invocations, duration
- CloudFront requests, cache hit ratio

---

## Backups

### Database Backup

Automated daily backup with Restic:

```bash
# Manual backup
/opt/zmanim/scripts/backup.sh

# List backups
restic snapshots

# Restore
restic restore latest --target /tmp/restore
```

Backups stored in S3 with encryption.

### Snapshot

EC2 EBS snapshots:
- Automated via AWS Backup (if configured)
- Manual: AWS Console or CLI

---

## Scaling

### Current Capacity

Single EC2 handles:
- ~100 concurrent users
- ~1000 requests/minute
- ~4M locality lookups

### Scaling Path

1. **Vertical:** Upgrade to m7g.large or m7g.xlarge
2. **Read Replica:** PostgreSQL read replica for queries
3. **Horizontal:** Multiple API instances behind ALB
4. **Managed DB:** Migrate to RDS for HA
5. **Managed Cache:** Migrate to ElastiCache

### Quick Scale

```bash
# Stop instance, change type, start
aws ec2 stop-instances --instance-ids i-xxx
aws ec2 modify-instance-attribute --instance-id i-xxx --instance-type m7g.large
aws ec2 start-instances --instance-ids i-xxx
```

---

## Security

### Network Security

- VPC with public subnet only
- Security group restricts inbound to 22, 80, 443
- HTTPS everywhere (CloudFront handles SSL)

### Secret Management

- No secrets in code or git
- All secrets in SSM Parameter Store
- IAM roles for service access

### Access Control

- SSH key-based authentication only
- IAM roles for AWS service access
- Clerk JWT for API authentication

### SSL/TLS

- ACM certificate (auto-renewed)
- CloudFront handles HTTPS termination
- HTTP redirected to HTTPS

---

## Disaster Recovery

### RTO/RPO

| Metric | Target |
|--------|--------|
| Recovery Time Objective | 1 hour |
| Recovery Point Objective | 24 hours |

### Recovery Procedures

#### Database Corruption

```bash
# 1. Stop API
sudo systemctl stop zmanim-api

# 2. Restore from backup
restic restore latest --target /tmp/restore

# 3. Restore PostgreSQL
psql -f /tmp/restore/dump.sql

# 4. Start API
sudo systemctl start zmanim-api
```

#### EC2 Failure

```bash
# 1. Launch new instance from AMI
# 2. Attach EBS volume
# 3. Update Elastic IP association
# 4. Verify services
```

#### Complete Region Failure

1. Launch infrastructure in backup region
2. Restore from S3 cross-region backup
3. Update DNS to new CloudFront

---

## Operations

### SSH Access

```bash
ssh ec2-user@<elastic-ip>
```

### Service Management

```bash
# API
sudo systemctl status zmanim-api
sudo systemctl restart zmanim-api
sudo systemctl stop zmanim-api

# PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Redis
sudo systemctl status redis
sudo systemctl restart redis
```

### Database Access

```bash
# Local connection
psql -U zmanim

# From remote (via SSH tunnel)
ssh -L 5432:localhost:5432 ec2-user@<elastic-ip>
psql -h localhost -U zmanim
```

### Disk Usage

```bash
df -h                     # Disk usage
du -sh /data/*            # Data directory
```

### Process Monitoring

```bash
htop                      # Interactive process monitor
ps aux | grep zmanim      # API process
```

---

## Cost Breakdown

Estimated monthly costs:

| Resource | Cost |
|----------|------|
| EC2 m7g.medium (reserved) | ~$25 |
| EBS 30GB gp3 | ~$3 |
| Elastic IP | ~$4 |
| API Gateway | ~$5 |
| Lambda (Next.js) | ~$10 |
| CloudFront | ~$10 |
| S3 (assets + backups) | ~$5 |
| Route 53 | ~$1 |
| **Total** | **~$60-80/month** |

---

## Troubleshooting

### API Not Responding

```bash
# Check service status
sudo systemctl status zmanim-api

# Check logs
sudo journalctl -u zmanim-api -n 100

# Check port
curl http://localhost:8080/health

# Restart service
sudo systemctl restart zmanim-api
```

### Database Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check disk space
df -h /data

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### High Memory Usage

```bash
# Check memory
free -h

# Check top processes
ps aux --sort=-%mem | head

# Clear Redis cache if needed
redis-cli FLUSHDB
```

### CloudFront Issues

```bash
# Create cache invalidation
aws cloudfront create-invalidation \
  --distribution-id EXXX \
  --paths "/*"
```

### SSL Certificate Issues

ACM certificates auto-renew. If issues:
1. Check ACM console for certificate status
2. Verify DNS validation records exist
3. Check CloudFront distribution settings

---

## Local Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Database | Local PostgreSQL | EC2 PostgreSQL |
| Cache | Local Redis | EC2 Redis |
| API | go run (localhost:8080) | systemd service |
| Frontend | npm run dev (localhost:3001) | Lambda@Edge |
| Auth | Clerk test keys | Clerk production keys |
| Domain | localhost | zmanim.shtetl.io |
| HTTPS | No | Yes (CloudFront) |

---

## Quick Reference

### URLs

| Resource | URL |
|----------|-----|
| Production | https://zmanim.shtetl.io |
| API | https://zmanim.shtetl.io/backend/api/v1 |
| Swagger | https://zmanim.shtetl.io/backend/swagger/index.html |

### Key Commands

```bash
# Deploy frontend
git push origin main

# Deploy backend (manual)
gh workflow run deploy-prod-backend.yml

# Deploy infrastructure
cd infrastructure && npx cdk deploy

# SSH to server
ssh ec2-user@<elastic-ip>

# Check API health
curl https://zmanim.shtetl.io/backend/api/v1/health

# View logs
sudo journalctl -u zmanim-api -f

# Restart API
sudo systemctl restart zmanim-api
```
