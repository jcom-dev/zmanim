#!/bin/bash
set -euo pipefail

# ============================================
# Zmanim First Boot Configuration Script
#
# This script is IDEMPOTENT - safe to run multiple times.
# It configures services from SSM Parameter Store and
# prepares the system for the API to start.
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
RESTIC_PASSWORD=$(get_ssm_param "/zmanim/prod/restic-password")
ANTHROPIC_API_KEY=$(get_ssm_param "/zmanim/prod/anthropic-api-key")
OPENAI_API_KEY=$(get_ssm_param "/zmanim/prod/openai-api-key")
RESEND_API_KEY=$(get_ssm_param "/zmanim/prod/resend-api-key")
RESEND_FROM=$(get_ssm_param "/zmanim/prod/resend-from")
RESEND_DOMAIN=$(get_ssm_param "/zmanim/prod/resend-domain")

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: postgres-password not found in SSM"
    echo "Create it: aws ssm put-parameter --name /zmanim/prod/postgres-password --value 'PASSWORD' --type SecureString"
    exit 1
fi

echo "  postgres-password: found"
echo "  redis-password: ${REDIS_PASSWORD:+found}${REDIS_PASSWORD:-NOT SET}"
echo "  clerk-secret-key: ${CLERK_SECRET_KEY:+found}${CLERK_SECRET_KEY:-NOT SET}"
echo "  clerk-publishable-key: ${CLERK_PUBLISHABLE_KEY:+found}${CLERK_PUBLISHABLE_KEY:-NOT SET}"
echo "  restic-password: ${RESTIC_PASSWORD:+found}${RESTIC_PASSWORD:-NOT SET}"
echo "  anthropic-api-key: ${ANTHROPIC_API_KEY:+found}${ANTHROPIC_API_KEY:-NOT SET}"
echo "  openai-api-key: ${OPENAI_API_KEY:+found}${OPENAI_API_KEY:-NOT SET}"
echo "  resend-api-key: ${RESEND_API_KEY:+found}${RESEND_API_KEY:-NOT SET}"
echo "  resend-from: ${RESEND_FROM_EMAIL:+found}${RESEND_FROM:-NOT SET}"
echo "  resend-domain: ${RESEND_REPLY_TO:+found}${RESEND_DOMAIN:-NOT SET}"

# ============================================
# Step 2: Prepare PostgreSQL data directory
# ============================================
echo ""
echo "Step 2: Preparing PostgreSQL..."

mkdir -p /data/postgres
chown postgres:postgres /data/postgres
chmod 700 /data/postgres

# Initialize cluster if needed (idempotent)
if [ ! -f /data/postgres/PG_VERSION ]; then
    echo "  Initializing PostgreSQL cluster..."
    sudo -u postgres /usr/lib/postgresql/17/bin/initdb -D /data/postgres
else
    echo "  PostgreSQL cluster already initialized"
fi

# Write pg_hba.conf (idempotent - always overwrite)
echo "  Writing pg_hba.conf..."
cat > /data/postgres/pg_hba.conf <<'EOHBA'
# PostgreSQL Client Authentication Configuration
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     scram-sha-256
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
EOHBA
chown postgres:postgres /data/postgres/pg_hba.conf
chmod 640 /data/postgres/pg_hba.conf

# Write SQL init script for PostgreSQL to run on startup
echo "  Writing database init script..."
mkdir -p /opt/zmanim
cat > /opt/zmanim/init-db.sql <<EOSQL
-- Idempotent database initialization
-- Run with: sudo -u postgres psql -f /opt/zmanim/init-db.sql

DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zmanim') THEN
        CREATE USER zmanim WITH PASSWORD '${POSTGRES_PASSWORD}' CREATEDB;
        RAISE NOTICE 'Created user zmanim';
    ELSE
        ALTER USER zmanim WITH PASSWORD '${POSTGRES_PASSWORD}';
        RAISE NOTICE 'Updated password for user zmanim';
    END IF;
END
\$\$;

SELECT 'CREATE DATABASE zmanim OWNER zmanim'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zmanim')\gexec

GRANT ALL PRIVILEGES ON DATABASE zmanim TO zmanim;
EOSQL
chmod 600 /opt/zmanim/init-db.sql

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

PORT=8080
GO_ENV=production

# Database
DATABASE_URL=postgresql://zmanim:${POSTGRES_PASSWORD}@localhost:5432/zmanim?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379/0
${REDIS_PASSWORD:+REDIS_PASSWORD=${REDIS_PASSWORD}}

# Clerk Authentication
${CLERK_SECRET_KEY:+CLERK_SECRET_KEY=${CLERK_SECRET_KEY}}
${CLERK_PUBLISHABLE_KEY:+CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}}

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
    source /etc/restic/env
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
