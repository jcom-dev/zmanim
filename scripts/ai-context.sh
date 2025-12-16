#!/bin/bash
# Generates optimal context package for AI agents
# Usage: ./scripts/ai-context.sh [topic]

set -e

TOPIC=$1

if [ -z "$TOPIC" ]; then
  echo "Usage: ./scripts/ai-context.sh [topic]"
  echo ""
  echo "Available topics:"
  echo "  handlers     - Backend HTTP handlers"
  echo "  queries      - SQLc database queries"
  echo "  components   - Frontend React components"
  echo "  database     - Database schema and standards"
  echo "  api          - API endpoints and contracts"
  echo "  testing      - Testing standards and patterns"
  echo "  compliance   - Coding standards compliance"
  echo "  all          - Complete context (large)"
  echo ""
  exit 1
fi

echo "📦 Generating AI context for: $TOPIC"
echo ""

case $TOPIC in
  "handlers")
    echo "=== BACKEND HANDLERS CONTEXT ==="
    echo ""
    if [ -f "api/internal/handlers/INDEX.md" ]; then
      cat api/internal/handlers/INDEX.md
    fi
    echo ""
    echo "=== HANDLER PATTERN (ADR-003) ==="
    if [ -f "docs/adr/003-publisher-resolver.md" ]; then
      cat docs/adr/003-publisher-resolver.md
    fi
    echo ""
    echo "=== SQLC PATTERN (ADR-001) ==="
    if [ -f "docs/adr/001-sqlc-mandatory.md" ]; then
      cat docs/adr/001-sqlc-mandatory.md
    fi
    echo ""
    echo "=== CODING STANDARDS (Backend Section) ==="
    grep -A 100 "## Backend Standards" docs/coding-standards.md 2>/dev/null || echo "Not found"
    ;;

  "queries")
    echo "=== DATABASE QUERIES CONTEXT ==="
    echo ""
    if [ -f "api/internal/db/queries/INDEX.md" ]; then
      cat api/internal/db/queries/INDEX.md
    fi
    echo ""
    echo "=== SQLC MANDATORY (ADR-001) ==="
    if [ -f "docs/adr/001-sqlc-mandatory.md" ]; then
      cat docs/adr/001-sqlc-mandatory.md
    fi
    echo ""
    echo "=== LOOKUP TABLE PATTERN (ADR-004) ==="
    if [ -f "docs/adr/004-lookup-table-normalization.md" ]; then
      cat docs/adr/004-lookup-table-normalization.md
    fi
    ;;

  "components")
    echo "=== FRONTEND COMPONENTS CONTEXT ==="
    echo ""
    if [ -f "web/components/INDEX.md" ]; then
      cat web/components/INDEX.md
    fi
    echo ""
    echo "=== USE API PATTERN (ADR-002) ==="
    if [ -f "docs/adr/002-use-api-pattern.md" ]; then
      cat docs/adr/002-use-api-pattern.md
    fi
    echo ""
    echo "=== DESIGN TOKENS (ADR-005) ==="
    if [ -f "docs/adr/005-design-tokens-only.md" ]; then
      cat docs/adr/005-design-tokens-only.md
    fi
    echo ""
    echo "=== CODING STANDARDS (Frontend Section) ==="
    grep -A 150 "## Frontend Standards" docs/coding-standards.md 2>/dev/null || echo "Not found"
    ;;

  "database")
    echo "=== DATABASE SCHEMA CONTEXT ==="
    echo ""
    echo "=== SCHEMA STANDARDS ==="
    grep -A 200 "## Database Standards" docs/coding-standards.md 2>/dev/null || echo "Not found"
    echo ""
    echo "=== LOOKUP TABLE NORMALIZATION (ADR-004) ==="
    if [ -f "docs/adr/004-lookup-table-normalization.md" ]; then
      cat docs/adr/004-lookup-table-normalization.md
    fi
    echo ""
    echo "=== MIGRATION PATTERNS ==="
    grep -A 100 "## Database Migrations" docs/coding-standards.md 2>/dev/null || echo "Not found"
    ;;

  "api")
    echo "=== API ENDPOINTS CONTEXT ==="
    echo ""
    echo "=== HANDLER REGISTRY ==="
    if [ -f "api/internal/handlers/INDEX.md" ]; then
      grep -A 100 "## Handler Map" api/internal/handlers/INDEX.md
    fi
    echo ""
    echo "=== API STANDARDS ==="
    grep -A 50 "## API Standards" docs/coding-standards.md 2>/dev/null || echo "Not found"
    echo ""
    echo "=== PUBLISHER RESOLVER (ADR-003) ==="
    if [ -f "docs/adr/003-publisher-resolver.md" ]; then
      cat docs/adr/003-publisher-resolver.md
    fi
    ;;

  "testing")
    echo "=== TESTING CONTEXT ==="
    echo ""
    echo "=== TESTING STANDARDS ==="
    grep -A 100 "## Testing Standards" docs/coding-standards.md 2>/dev/null || echo "Not found"
    echo ""
    echo "=== PLAYWRIGHT CONFIG ==="
    if [ -f "playwright.config.ts" ]; then
      cat playwright.config.ts
    fi
    ;;

  "compliance")
    echo "=== COMPLIANCE CONTEXT ==="
    echo ""
    if [ -f "docs/compliance/status.yaml" ]; then
      cat docs/compliance/status.yaml
    fi
    echo ""
    echo "=== CRITICAL VIOLATIONS ==="
    grep -A 20 "## CRITICAL VIOLATIONS" docs/coding-standards.md 2>/dev/null || echo "Not found"
    echo ""
    echo "=== ALL ADRs ==="
    for adr in docs/adr/*.md; do
      if [ -f "$adr" ]; then
        echo "=== $(basename $adr) ==="
        head -50 "$adr"
        echo ""
      fi
    done
    ;;

  "all")
    echo "=== COMPLETE PROJECT CONTEXT ==="
    echo ""
    echo "=== PROJECT OVERVIEW ==="
    if [ -f "CLAUDE.md" ]; then
      cat CLAUDE.md
    fi
    echo ""
    echo "=== CODING STANDARDS ==="
    if [ -f "docs/coding-standards.md" ]; then
      cat docs/coding-standards.md
    fi
    echo ""
    echo "=== COMPLIANCE STATUS ==="
    if [ -f "docs/compliance/status.yaml" ]; then
      cat docs/compliance/status.yaml
    fi
    echo ""
    echo "=== HANDLERS ==="
    if [ -f "api/internal/handlers/INDEX.md" ]; then
      cat api/internal/handlers/INDEX.md
    fi
    echo ""
    echo "=== QUERIES ==="
    if [ -f "api/internal/db/queries/INDEX.md" ]; then
      cat api/internal/db/queries/INDEX.md
    fi
    echo ""
    echo "=== COMPONENTS ==="
    if [ -f "web/components/INDEX.md" ]; then
      cat web/components/INDEX.md
    fi
    echo ""
    echo "=== ADRs ==="
    for adr in docs/adr/*.md; do
      if [ -f "$adr" ]; then
        echo ""
        echo "=== $(basename $adr) ==="
        cat "$adr"
      fi
    done
    ;;

  *)
    echo "❌ Unknown topic: $TOPIC"
    echo ""
    echo "Available topics:"
    echo "  handlers, queries, components, database, api, testing, compliance, all"
    exit 1
    ;;
esac

echo ""
echo "✅ Context generated for: $TOPIC"
echo ""
echo "💡 Tip: Redirect to file for AI agent:"
echo "   ./scripts/ai-context.sh $TOPIC > /tmp/ai-context.md"
