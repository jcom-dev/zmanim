#!/bin/bash
set -euo pipefail

echo "============================================"
echo "Configuring systemd services"
echo "============================================"

# Create state directory for firstboot tracking
sudo mkdir -p /var/lib/zmanim
sudo chown zmanim:zmanim /var/lib/zmanim

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

# Install config template (will be replaced by firstboot.sh)
echo "Installing config template..."
sudo mv /tmp/config.env.template /opt/zmanim/config.env.template
sudo chmod 644 /opt/zmanim/config.env.template
sudo chown zmanim:zmanim /opt/zmanim/config.env.template

# Create placeholder config.env (will be populated by firstboot.sh from SSM)
echo "Creating placeholder config.env..."
sudo cp /opt/zmanim/config.env.template /opt/zmanim/config.env
sudo chown zmanim:zmanim /opt/zmanim/config.env
sudo chmod 600 /opt/zmanim/config.env

# Install systemd service files
echo "Installing systemd service files..."
sudo mv /tmp/zmanim-firstboot.service /etc/systemd/system/zmanim-firstboot.service
sudo mv /tmp/zmanim-api.service /etc/systemd/system/zmanim-api.service
sudo mv /tmp/restic-backup.service /etc/systemd/system/restic-backup.service
sudo mv /tmp/restic-backup.timer /etc/systemd/system/restic-backup.timer
sudo mv /tmp/backup-notify@.service /etc/systemd/system/backup-notify@.service

# Set proper permissions on systemd files
sudo chmod 644 /etc/systemd/system/zmanim-firstboot.service
sudo chmod 644 /etc/systemd/system/zmanim-api.service
sudo chmod 644 /etc/systemd/system/restic-backup.service
sudo chmod 644 /etc/systemd/system/restic-backup.timer
sudo chmod 644 /etc/systemd/system/backup-notify@.service

# Reload systemd daemon
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable services (they will start on first boot in correct order)
# Order: firstboot -> postgresql -> redis -> zmanim-api
echo "Enabling services..."
sudo systemctl enable zmanim-firstboot.service  # Runs once, configures everything
sudo systemctl enable postgresql
sudo systemctl enable redis-server
sudo systemctl enable zmanim-api.service
sudo systemctl enable restic-backup.timer

# Note: Services are NOT started during AMI build
# On first boot:
# 1. zmanim-firstboot.service runs (pulls SSM params, creates DB user, generates config.env)
# 2. postgresql.service starts (after firstboot)
# 3. redis-server.service starts (after firstboot)
# 4. zmanim-api.service starts (after postgresql, redis, and firstboot)

echo "============================================"
echo "systemd services configured successfully"
echo "============================================"

# Display enabled services
echo ""
echo "Enabled services:"
systemctl list-unit-files | grep -E "(postgresql|redis|zmanim|restic)" || true
