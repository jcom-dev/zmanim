#!/bin/bash
set -euo pipefail

echo "============================================"
echo "Configuring systemd services"
echo "============================================"

# Create directories
sudo mkdir -p /var/lib/zmanim /opt/zmanim
sudo chown zmanim:zmanim /var/lib/zmanim /opt/zmanim

# Install Go API binary
echo "Installing Go API binary..."
sudo mv /tmp/zmanim-api /opt/zmanim/zmanim-api
sudo chmod +x /opt/zmanim/zmanim-api
sudo chown zmanim:zmanim /opt/zmanim/zmanim-api

# Install firstboot script
echo "Installing firstboot script..."
sudo mv /tmp/firstboot.sh /opt/zmanim/firstboot.sh
sudo chmod +x /opt/zmanim/firstboot.sh
sudo chown root:root /opt/zmanim/firstboot.sh

# Install backup scripts
echo "Installing backup scripts..."
sudo mv /tmp/backup.sh /opt/zmanim/backup.sh
sudo chmod +x /opt/zmanim/backup.sh
sudo chown root:root /opt/zmanim/backup.sh

sudo mv /tmp/notify-failure.sh /opt/zmanim/notify-failure.sh
sudo chmod +x /opt/zmanim/notify-failure.sh
sudo chown root:root /opt/zmanim/notify-failure.sh

sudo mv /tmp/download-latest.sh /opt/zmanim/download-latest.sh
sudo chmod +x /opt/zmanim/download-latest.sh
sudo chown zmanim:zmanim /opt/zmanim/download-latest.sh

# Install config template
echo "Installing config template..."
sudo mv /tmp/config.env.template /opt/zmanim/config.env.template
sudo chmod 644 /opt/zmanim/config.env.template
sudo chown zmanim:zmanim /opt/zmanim/config.env.template

# Create placeholder config.env (will be populated by firstboot.sh)
echo "Creating placeholder config.env..."
sudo cp /opt/zmanim/config.env.template /opt/zmanim/config.env
sudo chown zmanim:zmanim /opt/zmanim/config.env
sudo chmod 600 /opt/zmanim/config.env

# Install systemd service files
echo "Installing systemd service files..."
sudo mv /tmp/zmanim-firstboot.service /etc/systemd/system/
sudo mv /tmp/zmanim-db-init.service /etc/systemd/system/
sudo mv /tmp/zmanim-api.service /etc/systemd/system/
sudo mv /tmp/restic-backup.service /etc/systemd/system/
sudo mv /tmp/restic-backup.timer /etc/systemd/system/
sudo mv /tmp/backup-notify@.service /etc/systemd/system/

# Install PostgreSQL override to wait for firstboot
echo "Installing PostgreSQL service override..."
sudo mkdir -p /etc/systemd/system/postgresql.service.d
sudo mv /tmp/postgresql-override.conf /etc/systemd/system/postgresql.service.d/override.conf
sudo chmod 644 /etc/systemd/system/postgresql.service.d/override.conf

# Set proper permissions
sudo chmod 644 /etc/systemd/system/zmanim-*.service
sudo chmod 644 /etc/systemd/system/restic-backup.service
sudo chmod 644 /etc/systemd/system/restic-backup.timer
sudo chmod 644 /etc/systemd/system/backup-notify@.service

# Reload systemd
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable services
# Boot order:
#   1. zmanim-firstboot.service (prepares config files from SSM)
#   2. postgresql.service (starts database)
#   3. zmanim-db-init.service (creates user/database - idempotent)
#   4. redis-server.service (starts cache)
#   5. zmanim-api.service (starts API)
echo "Enabling services..."
sudo systemctl enable zmanim-firstboot.service
sudo systemctl enable postgresql
sudo systemctl enable zmanim-db-init.service
sudo systemctl enable redis-server
sudo systemctl enable zmanim-api.service
sudo systemctl enable restic-backup.timer

echo "============================================"
echo "systemd services configured"
echo "============================================"

echo ""
echo "Enabled services:"
systemctl list-unit-files | grep -E "(postgresql|redis|zmanim|restic)" || true
