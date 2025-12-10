# Story 7.5: S3 Buckets & Restic Backup Configuration

Status: ready-for-dev

## Story

As a **developer**,
I want **S3 buckets for backups and static assets with Restic streaming backups**,
So that **data is durable, encrypted, and frontend is served from CDN**.

## Acceptance Criteria

1. **AC1:** `zmanim-backups-prod` bucket for Restic repository
2. **AC2:** `zmanim-releases-prod` bucket for API binaries
3. **AC3:** `zmanim-static-prod` bucket for Next.js assets
4. **AC4:** Restic installed in AMI, configured for S3 streaming
5. **AC5:** systemd timer runs backup daily at 3 AM UTC
6. **AC6:** Email notification on backup failure via SES
7. **AC7:** Backup verification (weekly `restic check`)

## Tasks / Subtasks

- [ ] **Task 1: Create Backup Bucket** (AC: 1)
  - [ ] 1.1 Define `zmanim-backups-prod` S3 bucket in CDK
  - [ ] 1.2 Configure AES-256 server-side encryption
  - [ ] 1.3 Enable versioning for safety
  - [ ] 1.4 Configure bucket policy for VPC endpoint access
  - [ ] 1.5 Note: Restic manages its own retention (no lifecycle rules)

- [ ] **Task 2: Create Releases Bucket** (AC: 2)
  - [ ] 2.1 Define `zmanim-releases-prod` S3 bucket in CDK
  - [ ] 2.2 Configure AES-256 encryption
  - [ ] 2.3 Set lifecycle rule: delete old versions after 30 days
  - [ ] 2.4 Configure bucket policy for EC2 role access

- [ ] **Task 3: Create Static Assets Bucket** (AC: 3)
  - [ ] 3.1 Define `zmanim-static-prod` S3 bucket in CDK
  - [ ] 3.2 Configure for static website hosting
  - [ ] 3.3 Configure CloudFront OAI access policy
  - [ ] 3.4 Set cache-control headers for static assets

- [ ] **Task 4: Restic Configuration in AMI** (AC: 4)
  - [ ] 4.1 Ensure Restic installed in Packer AMI (Story 7.2)
  - [ ] 4.2 Create `/etc/restic/env.template` with S3 repository URL
  - [ ] 4.3 Configure user data to generate `/etc/restic/env` from SSM
  - [ ] 4.4 Document Restic repository initialization (one-time)

- [ ] **Task 5: Backup Timer** (AC: 5)
  - [ ] 5.1 Create `restic-backup.timer` in AMI
  - [ ] 5.2 Configure `OnCalendar=*-*-* 03:00:00`
  - [ ] 5.3 Set `Persistent=true` for catch-up
  - [ ] 5.4 Set `RandomizedDelaySec=300` for jitter
  - [ ] 5.5 Enable timer in systemd

- [ ] **Task 6: Email Notification** (AC: 6)
  - [ ] 6.1 Configure SES in CDK (verify domain/email)
  - [ ] 6.2 Create `backup-notify@.service` in AMI
  - [ ] 6.3 Create `/opt/zmanim/notify-failure.sh` script
  - [ ] 6.4 Configure `OnFailure=backup-notify@%n.service`
  - [ ] 6.5 Test failure notification

- [ ] **Task 7: Weekly Verification** (AC: 7)
  - [ ] 7.1 Add weekly `restic check` to backup.sh
  - [ ] 7.2 Run only on Sundays (`date +%u` == 7)
  - [ ] 7.3 Include verification result in logs

- [ ] **Task 8: Testing** (AC: 1-7)
  - [ ] 8.1 Deploy buckets to staging
  - [ ] 8.2 Initialize Restic repository
  - [ ] 8.3 Run manual backup and verify S3 objects
  - [ ] 8.4 Test restore procedure
  - [ ] 8.5 Trigger failure and verify email notification
  - [ ] 8.6 Document backup/restore procedures

## Dev Notes

### Architecture Alignment

This story implements the **data durability layer** for the AWS migration:

**Backup Architecture (Restic Streaming):**
```
┌─────────────────────────────────────────────────────┐
│  Backup Flow (no local staging)                     │
│                                                     │
│  pg_dump ─────┐                                     │
│               ├──→ restic backup --stdin ──→ S3    │
│  redis-cli ───┘    (encrypted, deduplicated)       │
│                                                     │
│  systemd timer (daily 3 AM) ──→ restic-backup.service
│                                      │              │
│                              OnFailure=email.service│
└─────────────────────────────────────────────────────┘
```

**Why Restic:**
- **Stdin streaming:** No local disk staging needed
- **Deduplication:** Efficient incremental backups
- **Encryption:** AES-256 at rest (Restic-managed)
- **S3 native:** Direct upload via VPC Gateway Endpoint
- **Built-in retention:** `restic forget --keep-daily 7 --keep-weekly 4`

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

# Verify repository integrity (weekly - Sundays)
if [ "$(date +%u)" -eq 7 ]; then
    echo "[$TIMESTAMP] Running integrity check..."
    restic check
fi

echo "[$TIMESTAMP] Backup completed"
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

### S3 Bucket Structure

```
zmanim-backups-prod/          # Restic repository
├── config                    # Restic config
├── data/                     # Encrypted data chunks
├── index/                    # Index files
├── keys/                     # Encryption keys
└── snapshots/                # Snapshot metadata

zmanim-releases-prod/         # API binaries
├── zmanim-api-v1.0.0
├── zmanim-api-v1.0.1
└── latest.txt                # Points to current version

zmanim-static-prod/           # Next.js static export
├── index.html
├── _next/
│   ├── static/
│   └── chunks/
└── assets/
```

### References

- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Story-7.5]
- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Backup-Strategy]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Story-7.5]

## Dev Agent Record

### Context Reference

[Story Context XML](./7-5-s3-buckets-restic-backup.context.xml)

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
