#!/bin/bash
# Export RAG index data to compressed CSV files
# Usage: ./export-rag-index.sh
#
# Creates:
# - ai_content_sources.csv.gz
# - embeddings.csv.gz
#
# Prerequisites:
# - source api/.env (or have DATABASE_URL set)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL not set. Run: source api/.env"
    exit 1
fi

# Create temp directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo "=== RAG Index Export ==="

echo "Exporting ai_content_sources..."
psql "$DATABASE_URL" -c "\COPY ai_content_sources TO '$TMP_DIR/ai_content_sources.csv' WITH CSV HEADER"
gzip -c "$TMP_DIR/ai_content_sources.csv" > "$SCRIPT_DIR/ai_content_sources.csv.gz"

echo "Exporting embeddings..."
psql "$DATABASE_URL" -c "\COPY embeddings TO '$TMP_DIR/embeddings.csv' WITH CSV HEADER"
gzip -c "$TMP_DIR/embeddings.csv" > "$SCRIPT_DIR/embeddings.csv.gz"

echo ""
echo "=== Export Complete ==="
echo "Files created:"
ls -lh "$SCRIPT_DIR"/*.csv.gz

echo ""
psql "$DATABASE_URL" -c "SELECT COUNT(*) as content_sources FROM ai_content_sources;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) as embeddings FROM embeddings;"
