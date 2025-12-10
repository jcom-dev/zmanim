#!/bin/bash
set -euo pipefail

# ============================================
# Zmanim First Boot Configuration Script
# Runs once on first boot to configure services from SSM
# ============================================

LOG_FILE="/var/log/zmanim-firstboot.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "============================================"
echo "Zmanim First Boot Configuration"
echo "Started at: $(date)"
echo "============================================"

# Get instance metadata
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)

echo "Region: $REGION"
echo "Instance: $INSTANCE_ID"

# ============================================
# Helper function to get SSM parameters
# ============================================
get_ssm_param() {
    local name=$1
    local decrypt=${2:-true}
    local value

    if [ "$decrypt" = "true" ]; then
        value=$(aws ssm get-parameter --name "$name" --with-decryption --query "Parameter.Value" --output text --region "$REGION" 2>/dev/null || echo "")
    else
        value=$(aws ssm get-parameter --name "$name" --query "Parameter.Value" --output text --region "$REGION" 2>/dev/null || echo "")
    fi
    echo "$value"
}

# ============================================
# Step 1: Fetch secrets from SSM Parameter Store
# ============================================
echo ""
echo "Step 1: Fetching secrets from SSM Parameter Store..."

POSTGRES_PASSWORD=$(get_ssm_param "/zmanim/prod/postgres-password")
REDIS_PASSWORD=$(get_ssm_param "/zmanim/prod/redis-password")
CLERK_SECRET_KEY=$(get_ssm_param "/zmanim/prod/clerk-secret-key")
CLERK_PUBLISHABLE_KEY=$(get_ssm_param "/zmanim/prod/clerk-publishable-key")
RESTIC_PASSWORD=$(get_ssm_param "/zmanim/prod/restic-password")

# Validate required secrets
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: POSTGRES_PASSWORD not found in SSM"
    echo "Please create: aws ssm put-parameter --name /zmanim/prod/postgres-password --value 'YOUR_PASSWORD' --type SecureString"
    exit 1
fi

echo "  - postgres-password: found"
echo "  - redis-password: ${REDIS_PASSWORD:+found}${REDIS_PASSWORD:-NOT SET (optional)}"
echo "  - clerk-secret-key: ${CLERK_SECRET_KEY:+found}${CLERK_SECRET_KEY:-NOT SET}"
echo "  - clerk-publishable-key: ${CLERK_PUBLISHABLE_KEY:+found}${CLERK_PUBLISHABLE_KEY:-NOT SET}"
echo "  - restic-password: ${RESTIC_PASSWORD:+found}${RESTIC_PASSWORD:-NOT SET}"

# ============================================
# Step 2: Configure PostgreSQL
# ============================================
echo ""
echo "Step 2: Configuring PostgreSQL..."

# Ensure data directory exists and has correct permissions
mkdir -p /data/postgres
chown postgres:postgres /data/postgres
chmod 700 /data/postgres

# Initialize PostgreSQL if not already done
if [ ! -f /data/postgres/PG_VERSION ]; then
    echo "  Initializing PostgreSQL cluster..."
    sudo -u postgres /usr/lib/postgresql/17/bin/initdb -D /data/postgres
fi

# Start PostgreSQL temporarily to create user/database
echo "  Starting PostgreSQL temporarily..."
systemctl start postgresql

# Wait for PostgreSQL to be ready
for i in {1..30}; do
    if sudo -u postgres pg_isready -q; then
        echo "  PostgreSQL is ready"
        break
    fi
    echo "  Waiting for PostgreSQL... ($i/30)"
    sleep 1
done

# Create zmanim user and database
echo "  Creating zmanim user and database..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOSQL
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'zmanim') THEN
        CREATE USER zmanim WITH PASSWORD '${POSTGRES_PASSWORD}' CREATEDB;
    ELSE
        ALTER USER zmanim WITH PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE zmanim OWNER zmanim'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zmanim')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE zmanim TO zmanim;
EOSQL

# Enable PostGIS extension
echo "  Enabling PostGIS extension..."
sudo -u postgres psql -d zmanim -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>/dev/null || echo "  PostGIS already enabled or not available"

# Configure pg_hba.conf for password authentication
echo "  Configuring pg_hba.conf..."
cat > /etc/postgresql/17/main/pg_hba.conf <<'EOHBA'
# PostgreSQL Client Authentication Configuration
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
local   all             postgres                                peer
local   all             all                                     scram-sha-256

# IPv4 local connections
host    all             all             127.0.0.1/32            scram-sha-256

# IPv6 local connections
host    all             all             ::1/128                 scram-sha-256
EOHBA

chown postgres:postgres /etc/postgresql/17/main/pg_hba.conf
chmod 640 /etc/postgresql/17/main/pg_hba.conf

# Stop PostgreSQL (will be started by systemd after firstboot)
systemctl stop postgresql
echo "  PostgreSQL configured successfully"

# ============================================
# Step 3: Configure Redis
# ============================================
echo ""
echo "Step 3: Configuring Redis..."

mkdir -p /data/redis
chown redis:redis /data/redis
chmod 750 /data/redis

# Update Redis password if set
if [ -n "$REDIS_PASSWORD" ]; then
    echo "  Setting Redis password..."
    if grep -q "^requirepass" /etc/redis/redis.conf; then
        sed -i "s/^requirepass.*/requirepass ${REDIS_PASSWORD}/" /etc/redis/redis.conf
    else
        echo "requirepass ${REDIS_PASSWORD}" >> /etc/redis/redis.conf
    fi
fi

echo "  Redis configured successfully"

# ============================================
# Step 4: Generate Zmanim API config.env
# ============================================
echo ""
echo "Step 4: Generating Zmanim API configuration..."

mkdir -p /opt/zmanim
cat > /opt/zmanim/config.env <<EOF
# Zmanim API Configuration
# Generated by firstboot.sh at $(date)
# DO NOT EDIT - regenerate by deleting /var/lib/zmanim/.firstboot-complete and rebooting

# Server
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

# AWS
AWS_REGION=${REGION}

# CORS
ALLOWED_ORIGINS=https://zmanim.shtetl.io,https://shtetl.io
EOF

chown zmanim:zmanim /opt/zmanim/config.env
chmod 600 /opt/zmanim/config.env
echo "  config.env created successfully"

# ============================================
# Step 5: Configure Restic backup
# ============================================
echo ""
echo "Step 5: Configuring Restic backup..."

mkdir -p /etc/restic
cat > /etc/restic/env <<EOF
# Restic backup configuration
RESTIC_REPOSITORY=s3:s3.${REGION}.amazonaws.com/zmanim-backups-prod
RESTIC_PASSWORD=${RESTIC_PASSWORD:-changeme}
AWS_DEFAULT_REGION=${REGION}
EOF

chmod 600 /etc/restic/env
echo "  Restic configured successfully"

# ============================================
# Step 6: Initialize Restic repository (if needed)
# ============================================
if [ -n "$RESTIC_PASSWORD" ]; then
    echo ""
    echo "Step 6: Initializing Restic repository..."
    source /etc/restic/env
    restic init 2>/dev/null || echo "  Repository already initialized or S3 not accessible yet"
fi

# ============================================
# Step 7: Configure CloudWatch Agent
# ============================================
echo ""
echo "Step 7: Configuring CloudWatch Agent..."

mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'CWEOF'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "metrics": {
    "namespace": "Zmanim",
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_user", "cpu_usage_system"],
        "metrics_collection_interval": 60
      },
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": ["disk_used_percent"],
        "resources": ["/", "/data"],
        "metrics_collection_interval": 60
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
CWEOF

# Start CloudWatch Agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json || true

echo "  CloudWatch Agent configured"

# ============================================
# Complete
# ============================================
echo ""
echo "============================================"
echo "First boot configuration completed at $(date)"
echo "Services will be started by systemd"
echo "============================================"
