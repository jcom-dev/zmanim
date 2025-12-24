#!/bin/bash
set -euo pipefail

# ============================================
# Zmanim First Boot Configuration Script
#
# This script is IDEMPOTENT - safe to run multiple times.
# It configures services from SSM Parameter Store and
# prepares the system for the API to start.
#
# CRITICAL SAFETY FEATURES:
# - Waits for /data EBS volume to be mounted (up to 120s)
# - Verifies mount is a real block device (not root filesystem)
# - NEVER initializes PostgreSQL if existing data detected
# - Creates marker file to track initialization state
#
# Run order (via systemd):
#   1. This script (zmanim-firstboot.service)
#   2. PostgreSQL (postgresql.service)
#   3. Redis (redis-server.service)
#   4. Zmanim API (zmanim-api.service)
# ============================================

LOG_FILE="/var/log/zmanim-firstboot.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "============================================"
echo "Zmanim First Boot Configuration"
echo "Started at: $(date)"
echo "============================================"

# ============================================
# CRITICAL: Wait for /data volume to be mounted
# ============================================
echo ""
echo "Step 0: Waiting for /data EBS volume..."

DATA_MOUNT="/data"
MAX_WAIT=120
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
    if mountpoint -q "$DATA_MOUNT"; then
        # Verify it's a real block device mount, not tmpfs or overlay
        MOUNT_DEV=$(findmnt -n -o SOURCE "$DATA_MOUNT" 2>/dev/null || echo "")
        if [[ "$MOUNT_DEV" == /dev/* ]]; then
            echo "  /data mounted on $MOUNT_DEV after ${WAITED}s"
            break
        else
            echo "  /data exists but not on block device (source: $MOUNT_DEV), waiting..."
        fi
    fi
    sleep 1
    WAITED=$((WAITED + 1))
    if [ $((WAITED % 10)) -eq 0 ]; then
        echo "  Waiting for /data mount... (${WAITED}s/${MAX_WAIT}s)"
    fi
done

if ! mountpoint -q "$DATA_MOUNT"; then
    echo "ERROR: /data not mounted after ${MAX_WAIT}s!"
    echo "ERROR: Cannot proceed without persistent storage."
    echo "ERROR: Check user-data script and EBS volume attachment."
    exit 1
fi

# Double-check: verify /data is NOT on the root filesystem
ROOT_DEV=$(findmnt -n -o SOURCE / 2>/dev/null || echo "")
DATA_DEV=$(findmnt -n -o SOURCE "$DATA_MOUNT" 2>/dev/null || echo "")

if [ "$ROOT_DEV" = "$DATA_DEV" ]; then
    echo "ERROR: /data is on the same device as root filesystem!"
    echo "ERROR: This indicates EBS volume is not properly mounted."
    echo "ERROR: Root device: $ROOT_DEV, Data device: $DATA_DEV"
    exit 1
fi

echo "  Verified: /data ($DATA_DEV) is separate from root ($ROOT_DEV)"

# ============================================
# Get AWS metadata (IMDSv2)
# ============================================
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/placement/region)
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/instance-id)

echo "Region: $REGION"
echo "Instance: $INSTANCE_ID"

# ============================================
# Helper: Get SSM parameter
# ============================================
get_ssm_param() {
    local name=$1
    aws ssm get-parameter \
        --name "$name" \
        --with-decryption \
        --query "Parameter.Value" \
        --output text \
        --region "$REGION" 2>/dev/null || echo ""
}

# ============================================
# Step 1: Fetch secrets from SSM
# ============================================
echo ""
echo "Step 1: Fetching secrets from SSM Parameter Store..."

POSTGRES_PASSWORD=$(get_ssm_param "/zmanim/prod/postgres-password")
REDIS_PASSWORD=$(get_ssm_param "/zmanim/prod/redis-password")
CLERK_SECRET_KEY=$(get_ssm_param "/zmanim/prod/clerk-secret-key")
CLERK_PUBLISHABLE_KEY=$(get_ssm_param "/zmanim/prod/clerk-publishable-key")
CLERK_JWKS_URL=$(get_ssm_param "/zmanim/prod/clerk-jwks-url")
CLERK_ISSUER=$(get_ssm_param "/zmanim/prod/clerk-issuer")
RESTIC_PASSWORD=$(get_ssm_param "/zmanim/prod/restic-password")
ANTHROPIC_API_KEY=$(get_ssm_param "/zmanim/prod/anthropic-api-key")
OPENAI_API_KEY=$(get_ssm_param "/zmanim/prod/openai-api-key")
RESEND_API_KEY=$(get_ssm_param "/zmanim/prod/resend-api-key")
RESEND_FROM=$(get_ssm_param "/zmanim/prod/resend-from")
RESEND_DOMAIN=$(get_ssm_param "/zmanim/prod/resend-domain")
JWT_SECRET=$(get_ssm_param "/zmanim/prod/jwt-secret")
ORIGIN_VERIFY_KEY=$(get_ssm_param "/zmanim/prod/origin-verify-key")
RECAPTCHA_SECRET_KEY=$(get_ssm_param "/zmanim/prod/recaptcha-secret-key")
RECAPTCHA_SITE_KEY=$(get_ssm_param "/zmanim/prod/recaptcha-site-key")
MAPBOX_PUBLIC_TOKEN=$(get_ssm_param "/zmanim/prod/mapbox-public-token")
MAPBOX_API_KEY=$(get_ssm_param "/zmanim/prod/mapbox-api-key")


if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: postgres-password not found in SSM"
    echo "Create it: aws ssm put-parameter --name /zmanim/prod/postgres-password --value 'PASSWORD' --type SecureString"
    exit 1
fi

echo "  postgres-password: found"
echo "  redis-password: ${REDIS_PASSWORD:+found}${REDIS_PASSWORD:-NOT SET}"
echo "  clerk-secret-key: ${CLERK_SECRET_KEY:+found}${CLERK_SECRET_KEY:-NOT SET}"
echo "  clerk-publishable-key: ${CLERK_PUBLISHABLE_KEY:+found}${CLERK_PUBLISHABLE_KEY:-NOT SET}"
echo "  clerk-jwks-url: ${CLERK_JWKS_URL:+found}${CLERK_JWKS_URL:-NOT SET}"
echo "  clerk-issuer: ${CLERK_ISSUER:+found}${CLERK_ISSUER:-NOT SET}"
echo "  restic-password: ${RESTIC_PASSWORD:+found}${RESTIC_PASSWORD:-NOT SET}"
echo "  anthropic-api-key: ${ANTHROPIC_API_KEY:+found}${ANTHROPIC_API_KEY:-NOT SET}"
echo "  openai-api-key: ${OPENAI_API_KEY:+found}${OPENAI_API_KEY:-NOT SET}"
echo "  resend-api-key: ${RESEND_API_KEY:+found}${RESEND_API_KEY:-NOT SET}"
echo "  resend-from: ${RESEND_FROM_EMAIL:+found}${RESEND_FROM:-NOT SET}"
echo "  resend-domain: ${RESEND_REPLY_TO:+found}${RESEND_DOMAIN:-NOT SET}"
echo "  origin-verify-key: ${ORIGIN_VERIFY_KEY:+found}${ORIGIN_VERIFY_KEY:-NOT SET (direct EC2 access allowed)}"

# ============================================
# Step 2: Prepare PostgreSQL data directory
# ============================================
echo ""
echo "Step 2: Preparing PostgreSQL..."

# SAFETY CHECK: Detect if this looks like an existing data directory
# Look for multiple indicators, not just PG_VERSION
PG_DATA="/data/postgres"
EXISTING_DATA=false

if [ -d "$PG_DATA" ]; then
    # Check for any PostgreSQL data files
    if [ -f "$PG_DATA/PG_VERSION" ] || \
       [ -f "$PG_DATA/postgresql.conf" ] || \
       [ -d "$PG_DATA/base" ] || \
       [ -d "$PG_DATA/pg_wal" ]; then
        EXISTING_DATA=true
        echo "  Found existing PostgreSQL data directory"
        echo "    PG_VERSION: $([ -f "$PG_DATA/PG_VERSION" ] && echo "exists ($(cat "$PG_DATA/PG_VERSION"))" || echo "missing")"
        echo "    postgresql.conf: $([ -f "$PG_DATA/postgresql.conf" ] && echo "exists" || echo "missing")"
        echo "    base/: $([ -d "$PG_DATA/base" ] && echo "exists" || echo "missing")"
        echo "    pg_wal/: $([ -d "$PG_DATA/pg_wal" ] && echo "exists" || echo "missing")"
    fi
fi

mkdir -p "$PG_DATA"
chown postgres:postgres "$PG_DATA"
chmod 700 "$PG_DATA"

# Clean up stale PID file from previous instance (EBS volume reattach)
if [ -f "$PG_DATA/postmaster.pid" ]; then
    echo "  Removing stale postmaster.pid from previous instance..."
    rm -f "$PG_DATA/postmaster.pid"
fi

# Initialize cluster ONLY if truly empty
if [ "$EXISTING_DATA" = true ]; then
    echo "  PostgreSQL cluster already initialized - preserving existing data"
elif [ -f "$PG_DATA/PG_VERSION" ]; then
    echo "  PostgreSQL cluster already initialized (PG_VERSION exists)"
else
    # Final safety check: directory should be empty or only have lost+found
    FILE_COUNT=$(find "$PG_DATA" -mindepth 1 -maxdepth 1 ! -name 'lost+found' | wc -l)
    if [ "$FILE_COUNT" -gt 0 ]; then
        echo "  WARNING: $PG_DATA contains $FILE_COUNT files but no PG_VERSION"
        echo "  Contents:"
        ls -la "$PG_DATA"
        echo "  REFUSING to initialize - manual intervention required"
        echo "  To force init: rm -rf $PG_DATA/* && systemctl restart zmanim-firstboot"
    else
        echo "  Initializing PostgreSQL cluster (directory is empty)..."
        sudo -u postgres /usr/lib/postgresql/17/bin/initdb -D "$PG_DATA"
        # Create marker file with timestamp
        echo "Initialized by firstboot.sh at $(date) on instance $INSTANCE_ID" > "$PG_DATA/.zmanim-init-marker"
    fi
fi

# Write pg_hba.conf (idempotent - always overwrite)
echo "  Writing pg_hba.conf..."
cat > "$PG_DATA/pg_hba.conf" <<'EOHBA'
# PostgreSQL Client Authentication Configuration
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     scram-sha-256
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
EOHBA
chown postgres:postgres "$PG_DATA/pg_hba.conf"
chmod 640 "$PG_DATA/pg_hba.conf"

# Write SQL init script for PostgreSQL to run on startup
echo "  Writing database init script..."
mkdir -p /opt/zmanim
cat > /opt/zmanim/init-db.sql <<EOSQL
-- Idempotent database initialization
-- Run with: sudo -u postgres psql -f /opt/zmanim/init-db.sql

-- Create user if not exists, always update password
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zmanim') THEN
        CREATE USER zmanim WITH PASSWORD '${POSTGRES_PASSWORD}' SUPERUSER;
        RAISE NOTICE 'Created user zmanim';
    ELSE
        ALTER USER zmanim WITH PASSWORD '${POSTGRES_PASSWORD}';
        RAISE NOTICE 'Updated password for user zmanim';
    END IF;

END
\$\$;

-- Create database if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zmanim') THEN
        PERFORM dblink_exec('dbname=postgres', 'CREATE DATABASE zmanim OWNER zmanim');
        RAISE NOTICE 'Created database zmanim';
    ELSE
        RAISE NOTICE 'Database zmanim already exists';
    END IF;
EXCEPTION
    WHEN undefined_function THEN
        -- dblink not available, try direct creation (will fail if exists, that's ok)
        RAISE NOTICE 'dblink not available, skipping database creation check';
END
\$\$;

-- Grant privileges (idempotent)
GRANT ALL PRIVILEGES ON DATABASE zmanim TO zmanim;
EOSQL
# postgres user needs to read this file
chown postgres:postgres /opt/zmanim/init-db.sql
chmod 400 /opt/zmanim/init-db.sql

# Write a separate script for database creation (runs outside transaction)
cat > /opt/zmanim/create-db.sh <<'EOSH'
#!/bin/bash
# Idempotent database creation
set -e
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw zmanim; then
    echo "Creating database zmanim..."
    sudo -u postgres createdb -O zmanim zmanim
else
    echo "Database zmanim already exists"
fi
EOSH
chmod 755 /opt/zmanim/create-db.sh

echo "  PostgreSQL prepared"

# ============================================
# Step 3: Prepare Redis
# ============================================
echo ""
echo "Step 3: Preparing Redis..."

mkdir -p /data/redis
chown redis:redis /data/redis
chmod 750 /data/redis

# Set Redis password if provided (idempotent)
if [ -n "$REDIS_PASSWORD" ]; then
    if grep -q "^requirepass" /etc/redis/redis.conf; then
        sed -i "s/^requirepass.*/requirepass ${REDIS_PASSWORD}/" /etc/redis/redis.conf
    else
        echo "requirepass ${REDIS_PASSWORD}" >> /etc/redis/redis.conf
    fi
    echo "  Redis password configured"
else
    echo "  Redis password not set (optional)"
fi

echo "  Redis prepared"

# ============================================
# Step 4: Generate API config.env
# ============================================
echo ""
echo "Step 4: Generating API configuration..."

cat > /opt/zmanim/config.env <<EOF
# Zmanim API Configuration
# Generated by firstboot.sh at $(date)
# Regenerate: sudo /opt/zmanim/firstboot.sh

HOST=0.0.0.0
PORT=8080
ENVIRONMENT=production

# Database
DATABASE_URL=postgresql://zmanim:${POSTGRES_PASSWORD}@localhost:5432/zmanim?sslmode=disable

# Redis (password in URL if set)
REDIS_URL=redis://${REDIS_PASSWORD:+:${REDIS_PASSWORD}@}localhost:6379/0

# Clerk Authentication
${CLERK_SECRET_KEY:+CLERK_SECRET_KEY=${CLERK_SECRET_KEY}}
${CLERK_PUBLISHABLE_KEY:+CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}}
${CLERK_JWKS_URL:+CLERK_JWKS_URL=${CLERK_JWKS_URL}}
${CLERK_ISSUER:+CLERK_ISSUER=${CLERK_ISSUER}}

# JWT Secret (required for production)
${JWT_SECRET:+JWT_SECRET=${JWT_SECRET}}

# AI Services
${ANTHROPIC_API_KEY:+ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}}
${OPENAI_API_KEY:+OPENAI_API_KEY=${OPENAI_API_KEY}}

# Email (Resend)
${RESEND_API_KEY:+RESEND_API_KEY=${RESEND_API_KEY}}
${RESEND_FROM:+RESEND_FROM=${RESEND_FROM}}
${RESEND_DOMAIN:+RESEND_DOMAIN=${RESEND_DOMAIN}}

# AWS
AWS_REGION=${REGION}

# CORS
ALLOWED_ORIGINS=https://zmanim.shtetl.io,https://shtetl.io

# Origin Verification (blocks direct EC2 access - API Gateway injects this header)
${ORIGIN_VERIFY_KEY:+ORIGIN_VERIFY_KEY=${ORIGIN_VERIFY_KEY}}
EOF

chown zmanim:zmanim /opt/zmanim/config.env
chmod 600 /opt/zmanim/config.env
echo "  config.env created"

# ============================================
# Step 5: Configure Restic backup
# ============================================
echo ""
echo "Step 5: Configuring Restic backup..."

mkdir -p /etc/restic
cat > /etc/restic/env <<EOF
RESTIC_REPOSITORY=s3:s3.${REGION}.amazonaws.com/zmanim-backups-prod
RESTIC_PASSWORD=${RESTIC_PASSWORD:-changeme}
AWS_DEFAULT_REGION=${REGION}
EOF
chmod 600 /etc/restic/env

# Initialize restic repo (idempotent - will fail silently if exists)
if [ -n "$RESTIC_PASSWORD" ]; then
    set -a
    source /etc/restic/env
    set +a
    restic init 2>/dev/null || true
fi

echo "  Restic configured"

# ============================================
# Step 6: Configure CloudWatch Agent
# ============================================
echo ""
echo "Step 6: Configuring CloudWatch Agent..."

mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'EOF'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "metrics": {
    "namespace": "Zmanim",
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_user", "cpu_usage_system"]
      },
      "mem": {
        "measurement": ["mem_used_percent"]
      },
      "disk": {
        "measurement": ["disk_used_percent"],
        "resources": ["/", "/data"]
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/zmanim-firstboot.log",
            "log_group_name": "/zmanim/firstboot",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config -m ec2 -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json 2>/dev/null || true

echo "  CloudWatch Agent configured"

# ============================================
# Done
# ============================================
echo ""
echo "============================================"
echo "First boot configuration completed at $(date)"
echo "============================================"
