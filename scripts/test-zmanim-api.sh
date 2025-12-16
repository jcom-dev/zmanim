#!/bin/bash
# Test Zmanim API with fresh token

cd /home/coder/workspace/zmanim
source api/.env

# Get fresh 30-min token
TOKEN=$(node scripts/get-test-token.js 2>&1 | grep "^eyJ")

if [ -z "$TOKEN" ]; then
    echo "ERROR: Failed to get token"
    exit 1
fi

echo "Token obtained (length: ${#TOKEN})"

# Test endpoint
PUBLISHER_ID="${1:-2}"
ENDPOINT="${2:-/api/v1/publisher/accessible}"

echo "Testing: $ENDPOINT with Publisher-Id: $PUBLISHER_ID"

curl -s \
    -H "Authorization: Bearer $TOKEN" \
    -H "X-Publisher-Id: $PUBLISHER_ID" \
    "http://localhost:8080${ENDPOINT}" | jq '.'
