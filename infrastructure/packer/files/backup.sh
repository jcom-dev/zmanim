#!/bin/bash
set -euo pipefail

# Restic Backup Script for Zmanim
# Streams PostgreSQL and Redis backups directly to S3 via Restic
# No local staging required

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_PREFIX="[$TIMESTAMP] Backup:"

echo "$LOG_PREFIX Starting Restic backup to S3..."

# Ensure Restic environment is loaded
if [ ! -f /etc/restic/env ]; then
    echo "$LOG_PREFIX ERROR: /etc/restic/env not found"
    exit 1
fi

# Export all variables from the env file
set -a
source /etc/restic/env
set +a

# Verify Restic repository is accessible
echo "$LOG_PREFIX Verifying Restic repository..."
if ! restic snapshots --quiet &> /dev/null; then
    echo "$LOG_PREFIX ERROR: Cannot access Restic repository"
    exit 1
fi

# Backup PostgreSQL (streaming pg_dump directly to S3)
echo "$LOG_PREFIX Backing up PostgreSQL database..."
if sudo -u postgres pg_dump -Fc zmanim | restic backup --stdin --stdin-filename "postgres_zmanim.dump" --tag postgresql --tag daily; then
    echo "$LOG_PREFIX PostgreSQL backup completed successfully"
else
    echo "$LOG_PREFIX ERROR: PostgreSQL backup failed"
    exit 1
fi

# Backup Redis (streaming RDB directly to S3)
echo "$LOG_PREFIX Backing up Redis database..."
# Get Redis password from config.env if set
REDIS_AUTH=""
if grep -q "^REDIS_URL=.*:.*@" /opt/zmanim/config.env 2>/dev/null; then
    REDIS_PASS=$(grep "^REDIS_URL=" /opt/zmanim/config.env | sed -n 's/.*:\/\/:\([^@]*\)@.*/\1/p')
    if [ -n "$REDIS_PASS" ]; then
        REDIS_AUTH="-a $REDIS_PASS --no-auth-warning"
    fi
fi
if redis-cli $REDIS_AUTH --rdb - | restic backup --stdin --stdin-filename "redis.rdb" --tag redis --tag daily; then
    echo "$LOG_PREFIX Redis backup completed successfully"
else
    echo "$LOG_PREFIX ERROR: Redis backup failed"
    exit 1
fi

# Prune old backups according to retention policy
# Keep: 7 daily, 4 weekly, 3 monthly snapshots
echo "$LOG_PREFIX Pruning old snapshots..."
if restic forget \
    --keep-daily 7 \
    --keep-weekly 4 \
    --keep-monthly 3 \
    --prune \
    --cleanup-cache; then
    echo "$LOG_PREFIX Prune completed successfully"
else
    echo "$LOG_PREFIX WARNING: Prune failed but backups succeeded"
fi

# Run integrity check weekly (Sunday)
if [ "$(date +%u)" -eq 7 ]; then
    echo "$LOG_PREFIX Running weekly integrity check..."
    if restic check --read-data-subset=5%; then
        echo "$LOG_PREFIX Integrity check passed"
    else
        echo "$LOG_PREFIX WARNING: Integrity check failed"
    fi
fi

# Display snapshot statistics
echo "$LOG_PREFIX Current snapshot statistics:"
restic snapshots --compact

echo "$LOG_PREFIX Backup completed successfully at $(date)"
