#!/bin/bash
set -euo pipefail

# Email notification script for backup failures
# Uses AWS SES to send alerts

SERVICE_NAME=${1:-"unknown-service"}
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S UTC")
HOSTNAME=$(hostname)
INSTANCE_ID=$(ec2-metadata --instance-id 2>/dev/null | cut -d " " -f 2 || echo "unknown")

# Get recent logs from the failed service
LOGS=$(journalctl -u "$SERVICE_NAME" -n 50 --no-pager || echo "Could not retrieve logs")

# Email content
EMAIL_SUBJECT="Backup Failed: $SERVICE_NAME on $HOSTNAME"
EMAIL_BODY="Backup service failed on EC2 instance

Service: $SERVICE_NAME
Timestamp: $TIMESTAMP
Hostname: $HOSTNAME
Instance ID: $INSTANCE_ID

Recent logs:
$LOGS

Check full logs with: journalctl -u $SERVICE_NAME

--
Zmanim Automated Alert System"

# Send email via AWS SES
# Note: SES sender email must be verified in AWS console
aws ses send-email \
    --region eu-west-1 \
    --from "backup-alerts@zmanim.shtetl.io" \
    --to "admin@shtetl.io" \
    --subject "$EMAIL_SUBJECT" \
    --text "$EMAIL_BODY" \
    2>&1 | logger -t backup-notify

echo "Failure notification sent for $SERVICE_NAME at $TIMESTAMP"
