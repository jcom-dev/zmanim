#!/bin/bash
set -euo pipefail

echo "============================================"
echo "Installing packages for Zmanim AMI (Ubuntu 24.04)"
echo "============================================"

# Update system packages
echo "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get upgrade -y

# Add PostgreSQL official repository
echo "Adding PostgreSQL PGDG repository..."
sudo apt-get install -y curl ca-certificates unzip tzdata chromium-browser
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update

# Install PostgreSQL 17 and extensions
echo "Installing PostgreSQL 17..."
sudo apt-get install -y postgresql-17 postgresql-contrib-17

# Install PostGIS for PostgreSQL 17
echo "Installing PostGIS 3.5..."
sudo apt-get install -y postgresql-17-postgis-3

# Install pgvector extension for embeddings/RAG
echo "Installing pgvector..."
sudo apt-get install -y postgresql-17-pgvector

# Install Redis
echo "Installing Redis..."
sudo apt-get install -y redis-server

# Install Restic for backups
echo "Installing Restic..."
sudo apt-get install -y restic

# Install AWS CLI v2
echo "Installing AWS CLI v2..."
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "/tmp/awscliv2.zip"
    cd /tmp && unzip -q awscliv2.zip
    sudo /tmp/aws/install
    rm -rf /tmp/awscliv2.zip /tmp/aws
fi

# Install CloudWatch Agent
echo "Installing CloudWatch Agent..."
curl -o /tmp/amazon-cloudwatch-agent.deb https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/arm64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i /tmp/amazon-cloudwatch-agent.deb || sudo apt-get install -f -y
rm /tmp/amazon-cloudwatch-agent.deb

# Create application user for zmanim-api service
echo "Creating zmanim application user..."
sudo useradd -r -s /bin/false -d /opt/zmanim zmanim || true

# Create directory structure
echo "Creating directory structure..."
sudo mkdir -p /opt/zmanim
sudo mkdir -p /data/postgres
sudo mkdir -p /data/redis
sudo mkdir -p /etc/restic

# Set ownership
sudo chown -R zmanim:zmanim /opt/zmanim
sudo chown -R postgres:postgres /data/postgres
sudo chown -R redis:redis /data/redis

# Clean up apt cache
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*

echo "============================================"
echo "Package installation completed successfully"
echo "============================================"

# Display installed versions
echo ""
echo "Installed versions:"
psql --version
redis-server --version
restic version
aws --version
