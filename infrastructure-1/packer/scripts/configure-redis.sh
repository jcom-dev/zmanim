#!/bin/bash
set -euo pipefail

echo "============================================"
echo "Configuring Redis 7"
echo "============================================"

# Copy custom Redis configuration (Ubuntu path)
echo "Installing custom redis.conf..."
sudo cp /tmp/redis.conf /etc/redis/redis.conf
sudo chown redis:redis /etc/redis/redis.conf
sudo chmod 640 /etc/redis/redis.conf

# Create log directory
echo "Creating Redis log directory..."
sudo mkdir -p /var/log/redis
sudo chown redis:redis /var/log/redis

# Ensure data directory exists and has correct permissions
echo "Ensuring Redis data directory permissions..."
sudo mkdir -p /data/redis
sudo chown redis:redis /data/redis
sudo chmod 750 /data/redis

# Note: In production, /data will be a separate EBS volume
# The user-data script will ensure proper permissions on mount

echo "============================================"
echo "Redis 7 configured successfully"
echo "============================================"
