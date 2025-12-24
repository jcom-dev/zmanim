#!/bin/bash
# Restore RAG index data from compressed CSV exports
# Usage: ./restore-rag-index.sh
#
# This script:
# 1. TRUNCATES embeddings and ai_content_sources tables
# 2. Bulk loads from compressed CSV files using COPY
#
# Prerequisites:
# - source api/.env (or have DATABASE_URL set)
# - Run from the zmanim project root

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "DATABASE_URL not set. Run: source api/.env"
    exit 1
fi

# Check if data files exist
if [ ! -f "$SCRIPT_DIR/ai_content_sources.csv.gz" ] || [ ! -f "$SCRIPT_DIR/embeddings.csv.gz" ]; then
    echo "Data files not found in $SCRIPT_DIR"
    echo "Expected: ai_content_sources.csv.gz, embeddings.csv.gz"
    exit 1
fi

echo "=== RAG Index Restore ==="
echo "This will TRUNCATE and restore:"
echo "  - embeddings"
echo "  - ai_content_sources"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Create temp directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo "Decompressing data files..."
gunzip -c "$SCRIPT_DIR/ai_content_sources.csv.gz" > "$TMP_DIR/ai_content_sources.csv"
gunzip -c "$SCRIPT_DIR/embeddings.csv.gz" > "$TMP_DIR/embeddings.csv"

echo "Truncating tables and bulk loading..."
psql "$DATABASE_URL" <<EOF
-- Truncate in correct order (embeddings references ai_content_sources)
-- RESTART IDENTITY resets sequences to 1, then setval adjusts after data load
TRUNCATE embeddings RESTART IDENTITY CASCADE;
TRUNCATE ai_content_sources RESTART IDENTITY CASCADE;

-- Bulk load ai_content_sources
\COPY ai_content_sources FROM '$TMP_DIR/ai_content_sources.csv' WITH CSV HEADER

-- Bulk load embeddings
\COPY embeddings FROM '$TMP_DIR/embeddings.csv' WITH CSV HEADER

-- Reset sequences to match restored data (IDs preserved from CSV)
SELECT setval('ai_content_sources_id_seq', (SELECT COALESCE(MAX(id), 1) FROM ai_content_sources));
SELECT setval('embeddings_id_seq', (SELECT COALESCE(MAX(id), 1) FROM embeddings));

-- Show results
SELECT COUNT(*) as content_sources FROM ai_content_sources;
SELECT COUNT(*) as embeddings FROM embeddings;
EOF

echo ""
echo "=== Restore Complete ==="
