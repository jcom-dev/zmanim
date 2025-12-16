#!/bin/bash
# Export geographic data to compressed dump for seeding

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

echo "=== Geographic Data Export ==="
echo ""

# Default output location
OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_ROOT/api/data}"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d)
OUTPUT_FILE="${OUTPUT_FILE:-$OUTPUT_DIR/geodata-$TIMESTAMP.dump.zst}"

echo "Output file: $OUTPUT_FILE"
echo ""

# Run export
go run cmd/export-geodata/main.go export \
    --output="$OUTPUT_FILE" \
    "$@"

echo ""
echo "=== Export Complete ==="
echo ""
echo "Next steps:"
echo "1. Upload to S3:"
echo "   aws s3 cp $OUTPUT_FILE s3://YOUR_BUCKET/geo-seed/"
echo "   aws s3 cp $OUTPUT_FILE.sha256 s3://YOUR_BUCKET/geo-seed/"
echo ""
echo "2. Update seed script with S3 URL"
echo ""
