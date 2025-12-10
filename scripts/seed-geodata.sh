#!/bin/bash
# Seed geographic data from S3 or local dump

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT/api"

# Load .env if exists
if [ -f ../.env ]; then
    set -a
    source ../.env
    set +a
fi

echo "=== Geographic Data Seed ==="
echo ""

# Default S3 source (update with your actual S3 URL)
DEFAULT_SOURCE="${GEO_SEED_SOURCE:-s3://zmanim/geo-seed/geodata.dump.zst}"

# Use provided source or default
SOURCE="${1:-$DEFAULT_SOURCE}"

echo "Source: $SOURCE"
echo ""

# Confirm if resetting
if [[ "$*" == *"--reset"* ]]; then
    echo "⚠️  WARNING: --reset will DELETE ALL existing geographic data!"
    echo ""
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 1
    fi
    echo ""
fi

# Run seed
go run cmd/seed-geodata/main.go seed \
    --source="$SOURCE" \
    "$@"

echo ""
echo "=== Seed Complete ==="
echo ""
