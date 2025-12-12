# Zmanim AMI Build with Packer

This directory contains the Packer configuration to build a custom Amazon Machine Image (AMI) for the Zmanim application with all dependencies pre-installed.

## Overview

The Packer AMI approach eliminates NAT Gateway costs (~$32/month savings) by pre-installing all packages during the AMI build process. EC2 instances boot in less than 60 seconds with all services ready.

## AMI Contents

- **Base OS:** Amazon Linux 2023 ARM64 (latest)
- **Database:** PostgreSQL 16 + PostGIS 3.4 + pg_cron
- **Cache:** Redis 7 with RDB + AOF persistence
- **Application:** Go API binary (linux/arm64)
- **Backup:** Restic backup tool with S3 streaming
- **Monitoring:** AWS CloudWatch Agent

## Directory Structure

```
infrastructure/packer/
├── zmanim-ami.pkr.hcl          # Main Packer template
├── variables.pkr.hcl            # Build variables
├── scripts/                     # Provisioner scripts
│   ├── install-packages.sh      # Install all packages
│   ├── configure-postgres.sh    # PostgreSQL configuration
│   ├── configure-redis.sh       # Redis configuration
│   └── configure-systemd.sh     # systemd service setup
└── files/                       # Configuration files
    ├── postgresql.conf          # PostgreSQL optimized config
    ├── pg_hba.conf             # PostgreSQL authentication
    ├── redis.conf              # Redis config with persistence
    ├── zmanim-api.service      # systemd unit for API
    ├── restic-backup.service   # systemd unit for backup
    ├── restic-backup.timer     # Daily backup at 3 AM UTC
    ├── backup-notify@.service  # Email notification on failure
    ├── backup.sh               # Restic backup script
    ├── notify-failure.sh       # SES email notification
    ├── download-latest.sh      # Download latest binary from S3
    └── config.env.template     # Environment variables template
```

## Building the AMI

### Prerequisites

- AWS credentials with EC2 and AMI creation permissions
- Packer 1.9+ installed
- Pre-built Go API binary for linux/arm64

### Local Build

1. **Build the Go API binary:**
   ```bash
   cd ../../api
   GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build \
     -ldflags="-s -w" \
     -o ../bin/zmanim-api \
     ./cmd/api
   ```

2. **Initialize Packer:**
   ```bash
   cd infrastructure/packer
   packer init .
   ```

3. **Validate the template:**
   ```bash
   packer validate .
   ```

4. **Build the AMI:**
   ```bash
   packer build -var 'version=v1.0.0' .
   ```

### GitHub Actions Build

The AMI is automatically built via GitHub Actions when a tag matching `v*-ami` is pushed:

```bash
git tag v1.0.0-ami
git push origin v1.0.0-ami
```

The workflow will:
1. Build the Go binary for linux/arm64
2. Run Packer to create the AMI
3. Store the AMI ID in SSM Parameter Store at `/zmanim/prod/ami-id`
4. Tag the AMI with version and git commit information

### Required GitHub Secrets

- `AWS_ACCESS_KEY_ID` - AWS access key for AMI build
- `AWS_SECRET_ACCESS_KEY` - AWS secret access key

## Configuration

### Build Variables

Edit `variables.pkr.hcl` to customize:

- `version` - AMI version (default: "test-local")
- `region` - AWS region (default: "eu-west-1")
- `instance_type` - Build instance type (default: "t4g.small")
- `api_binary_path` - Path to Go binary (default: "../../bin/zmanim-api")

### PostgreSQL Configuration

Optimized for m7g.medium (2 vCPU, 4GB RAM):
- `shared_buffers = 1GB` (25% of system RAM)
- `effective_cache_size = 3GB` (75% of system RAM)
- `work_mem = 10MB` per query
- Data directory: `/data/postgres` (separate EBS volume)

### Redis Configuration

- Persistence: RDB + AOF enabled
- Memory limit: 1GB with allkeys-lru eviction
- Data directory: `/data/redis` (separate EBS volume)

## systemd Services

### Service Dependencies

```
zmanim-api.service
├── After: postgresql-16.service
├── After: redis7.service
├── Requires: postgresql-16.service, redis7.service
├── ExecStartPre: /opt/zmanim/download-latest.sh
└── ExecStart: /opt/zmanim/zmanim-api

restic-backup.timer (daily 3 AM UTC)
└── Activates: restic-backup.service
    ├── ExecStart: /opt/zmanim/backup.sh
    └── OnFailure: backup-notify@%n.service
```

### Enabled Services

All services are enabled for auto-start on boot:
- `postgresql-16.service` - PostgreSQL database
- `redis7.service` - Redis cache
- `zmanim-api.service` - Go API service
- `restic-backup.timer` - Daily backup timer

## Backup Strategy

### Restic Backup

The AMI includes Restic backup configured to stream directly to S3:

- **PostgreSQL:** `pg_dump -Fc` piped to Restic
- **Redis:** `redis-cli --rdb -` piped to Restic
- **Schedule:** Daily at 3 AM UTC with 5-minute random delay
- **Retention:** 7 daily, 4 weekly, 3 monthly snapshots
- **Integrity:** Weekly check on Sundays (5% data verification)

### Failure Notifications

On backup failure, an email is sent via AWS SES:
- Service: `backup-notify@.service`
- Script: `/opt/zmanim/notify-failure.sh`
- Includes: Service name, timestamp, recent logs

## Security

### Zero Secrets in AMI

The AMI contains **NO SECRETS**. All sensitive values are placeholders:

- Database passwords: Retrieved from SSM Parameter Store at boot
- Redis password: Retrieved from SSM Parameter Store at boot
- Clerk API keys: Retrieved from SSM Parameter Store at boot
- AWS credentials: IAM instance role (no access keys)

### Authentication

- **PostgreSQL:** Local socket authentication only (peer + scram-sha-256)
- **Redis:** Bind to localhost only, password from SSM
- **API:** Clerk authentication, CORS configured

## Deployment

### Code Updates Without AMI Rebuild

The `zmanim-api.service` includes `ExecStartPre=/opt/zmanim/download-latest.sh` which downloads the latest binary from S3 before starting. This allows code updates without rebuilding the AMI:

1. Build new binary: `GOOS=linux GOARCH=arm64 go build ...`
2. Upload to S3: `aws s3 cp zmanim-api s3://zmanim-releases/releases/latest/`
3. Restart service: `systemctl restart zmanim-api.service`

### Full AMI Update

For infrastructure changes (package versions, system configuration):

1. Update Packer templates or scripts
2. Push tag: `git tag v1.1.0-ami && git push origin v1.1.0-ami`
3. GitHub Actions builds new AMI
4. Update EC2 launch template with new AMI ID
5. Terminate old instance, launch new instance

## Testing

### Validate Template

```bash
packer validate .
```

### Verify Scripts

```bash
for f in scripts/*.sh files/*.sh; do
  bash -n "$f" && echo "✓ $f" || echo "✗ $f FAILED"
done
```

### Check Configurations

```bash
# PostgreSQL
grep -E "(shared_buffers|data_directory)" files/postgresql.conf

# Redis
grep -E "(appendonly|maxmemory|dir)" files/redis.conf

# Backup script
grep -E "(pg_dump|redis-cli)" files/backup.sh
```

## Cost Savings

- **NAT Gateway:** $0/month (eliminated)
- **Previous:** ~$32/month for NAT Gateway
- **Current:** $0/month for package installation (pre-baked in AMI)
- **Boot time:** <60 seconds vs 5-10 minutes with runtime installation

## Troubleshooting

### AMI Build Fails

1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify source AMI exists: `aws ec2 describe-images --owners amazon --filters "Name=name,Values=al2023-ami-*-arm64"`
3. Review Packer logs for provisioner errors

### Service Won't Start

1. SSH to EC2 instance
2. Check service status: `systemctl status zmanim-api.service`
3. View logs: `journalctl -u zmanim-api.service -n 50`
4. Verify binary exists: `ls -l /opt/zmanim/zmanim-api`
5. Check config: `cat /opt/zmanim/config.env`

### Backup Failures

1. Check timer: `systemctl status restic-backup.timer`
2. View backup logs: `journalctl -u restic-backup.service -n 50`
3. Verify S3 access: `aws s3 ls s3://zmanim-backups/`
4. Check Restic config: `cat /etc/restic/env`

## References

- [Story 7.2: Packer AMI Build Pipeline](../../docs/sprint-artifacts/stories/7-2-packer-ami-build-pipeline.md)
- [Epic 7: AWS Migration](../../docs/sprint-artifacts/epic-7-aws-migration.md)
- [Packer Documentation](https://www.packer.io/docs)
- [Amazon Linux 2023 User Guide](https://docs.aws.amazon.com/linux/al2023/ug/)
