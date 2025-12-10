#!/bin/bash
set -euo pipefail

echo "============================================"
echo "Configuring PostgreSQL 17 (Ubuntu)"
echo "============================================"

# PostgreSQL 17 paths on Ubuntu
PG_DATA=/var/lib/postgresql/17/main
PG_CONF=/etc/postgresql/17/main

# Stop PostgreSQL to configure it
echo "Stopping PostgreSQL service..."
sudo systemctl stop postgresql

# Copy custom configuration files
echo "Installing custom postgresql.conf..."
sudo cp /tmp/postgresql.conf ${PG_CONF}/conf.d/99-zmanim.conf
sudo chown postgres:postgres ${PG_CONF}/conf.d/99-zmanim.conf

echo "Installing custom pg_hba.conf..."
sudo cp /tmp/pg_hba.conf ${PG_CONF}/pg_hba.conf
sudo chown postgres:postgres ${PG_CONF}/pg_hba.conf

# Note: In production, the user-data script will:
# 1. Mount /data EBS volume
# 2. Move PostgreSQL data to /data/postgres
# 3. Update data_directory in postgresql.conf
# For the AMI, we configure it in the default location

echo "PostgreSQL configuration files installed"

# Do NOT start PostgreSQL yet - it will start via systemd on first boot

echo "============================================"
echo "PostgreSQL 17 configured successfully"
echo "============================================"
