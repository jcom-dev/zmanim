#!/bin/bash
# Add AI-optimized file headers to top 40 critical files
# This script adds standardized headers for AI agent navigation

set -e

echo "Adding file headers to top 40 critical files..."

# Function to check if file already has a header
has_header() {
    local file=$1
    head -n 5 "$file" 2>/dev/null | grep -q -E "(^//.*File:|^/\*\*|Purpose:|@file)" && return 0 || return 1
}

# Function to add Go file header
add_go_header() {
    local file=$1
    local purpose=$2
    local pattern=$3
    local dependencies=$4
    local frequency=$5

    if has_header "$file"; then
        echo "  ⏭️  $file (already has header)"
        return
    fi

    local temp=$(mktemp)
    cat > "$temp" << EOF
// File: $(basename "$file")
// Purpose: $purpose
// Pattern: $pattern
// Dependencies: $dependencies
// Frequency: $frequency
// Compliance: Check docs/adr/ for pattern rationale

EOF
    cat "$file" >> "$temp"
    mv "$temp" "$file"
    echo "  ✅ $file"
}

# Function to add TypeScript/React file header
add_ts_header() {
    local file=$1
    local purpose=$2
    local pattern=$3
    local dependencies=$4
    local frequency=$5

    if has_header "$file"; then
        echo "  ⏭️  $file (already has header)"
        return
    fi

    local temp=$(mktemp)
    cat > "$temp" << EOF
/**
 * @file $(basename "$file")
 * @purpose $purpose
 * @pattern $pattern
 * @dependencies $dependencies
 * @frequency $frequency
 * @compliance Check docs/adr/ for pattern rationale
 */

EOF
    cat "$file" >> "$temp"
    mv "$temp" "$file"
    echo "  ✅ $file"
}

echo ""
echo "=== BACKEND FILES (20) ==="

# Core Infrastructure (5)
add_go_header "api/internal/handlers/response.go" \
    "Standard API response format (RespondJSON, APIResponse, error helpers)" \
    "response-helpers" \
    "Used by all 32 handler files" \
    "critical"

add_go_header "api/internal/handlers/utils.go" \
    "ID conversion helpers (int32 ↔ string, validation)" \
    "utility" \
    "Used by all handlers for type safety" \
    "critical"

add_go_header "api/internal/handlers/publisher_context.go" \
    "Publisher resolver - extracts publisher ID from X-Publisher-Id header with auth" \
    "publisher-resolver" \
    "middleware.GetUserID, Clerk metadata" \
    "high - used by 11 handler files"

add_go_header "api/internal/db/postgres.go" \
    "Database connection initialization and query aggregation (SQLc integration)" \
    "database-lifecycle" \
    "pgxpool, sqlcgen.Queries" \
    "critical"

# Top Handlers (7)
add_go_header "api/internal/handlers/master_registry.go" \
    "Master zmanim registry CRUD - canonical zman definitions for all publishers" \
    "6-step-handler" \
    "Queries: master_zmanim.sql, tags.sql | Services: ClerkService" \
    "critical - 3,255 lines"

add_go_header "api/internal/handlers/publisher_zmanim.go" \
    "Publisher zmanim CRUD, linking, versioning, soft delete, restore" \
    "6-step-handler" \
    "Queries: zmanim.sql, algorithms.sql | Services: Cache" \
    "critical - 1,901 lines"

add_go_header "api/internal/handlers/admin.go" \
    "Admin-only endpoints - publisher/user management, metadata updates" \
    "6-step-handler-admin" \
    "Queries: admin.sql, publishers.sql | Services: ClerkService, EmailService" \
    "high - 1,416 lines"

add_go_header "api/internal/handlers/geo_boundaries.go" \
    "PostGIS geographic queries - country/region/city boundary lookup" \
    "6-step-handler" \
    "Queries: geo_boundaries.sql (PostGIS ST_Contains)" \
    "high - 781 lines"

add_go_header "api/internal/handlers/coverage.go" \
    "Publisher coverage area CRUD - manages geographic service areas" \
    "6-step-handler" \
    "Queries: coverage.sql, geo_boundaries.sql" \
    "high - 777 lines"

add_go_header "api/internal/handlers/publisher_algorithm.go" \
    "Algorithm lifecycle - draft/publish/archive with versioning and rollback" \
    "6-step-handler-transactional" \
    "Queries: algorithms.sql | Services: Cache, SnapshotService" \
    "high - 716 lines"

add_go_header "api/internal/handlers/calendar.go" \
    "Hebrew/Gregorian calendar conversion and date utilities" \
    "utility-handler" \
    "hdate package for Jewish calendar calculations" \
    "medium - 674 lines"

# Services (3)
add_go_header "api/internal/services/email_service.go" \
    "Email sending via SMTP - invitations, notifications, publisher requests" \
    "service" \
    "net/smtp, email templates" \
    "high - used by 6 handlers"

add_go_header "api/internal/services/clerk_service.go" \
    "Clerk API integration - user metadata, role updates, user sync" \
    "service" \
    "Clerk SDK for auth management" \
    "critical - used by all protected routes"

add_go_header "api/internal/services/snapshot_service.go" \
    "Publisher snapshot export/import - algorithm versioning and backups" \
    "service" \
    "JSON serialization, algorithm history" \
    "medium - 419 lines"

# Calculation Engine (3)
add_go_header "api/internal/dsl/executor.go" \
    "DSL formula execution engine - primitives, solar angles, time arithmetic" \
    "calculation-engine" \
    "astro/sun.go for solar calculations" \
    "critical - used by all zmanim calculations"

add_go_header "api/internal/dsl/validator.go" \
    "DSL formula validation - syntax checking, reference resolution" \
    "validation" \
    "Queries: zmanim.sql for @reference validation" \
    "high - 507 lines"

add_go_header "api/internal/astro/sun.go" \
    "Astronomical calculations - sunrise, sunset, solar angles" \
    "calculation-primitive" \
    "NOAA solar equations" \
    "critical - foundation for DSL primitives"

# Middleware (2)
add_go_header "api/internal/middleware/auth.go" \
    "JWT verification, role enforcement (RequireAuth, RequireRole)" \
    "middleware" \
    "Clerk JWT verification" \
    "critical - protects all authenticated routes"

echo ""
echo "=== FRONTEND FILES (20) ==="

# Foundation (4)
# api-client.ts already has header - skip

add_ts_header "web/providers/PublisherContext.tsx" \
    "Publisher selection state - impersonation, multi-publisher routing" \
    "react-context" \
    "useApi, useUser (Clerk), localStorage for persistence" \
    "critical - used by all publisher pages"

add_ts_header "web/app/layout.tsx" \
    "Root layout - Clerk, React Query, Theme, PublisherContext providers" \
    "next-layout" \
    "ClerkProvider, QueryClient, ThemeProvider" \
    "critical - app initialization"

add_ts_header "web/middleware.ts" \
    "Next.js middleware - auth routing, public/protected route logic" \
    "next-middleware" \
    "Clerk auth(), publicRoutes matcher" \
    "critical - authentication flow"

# Hooks (3)
add_ts_header "web/lib/hooks/useZmanimList.ts" \
    "Zmanim list management - filtering, sorting, grouping, caching" \
    "react-hook-complex" \
    "useApi, React Query, category helpers" \
    "high - 947 lines"

add_ts_header "web/lib/hooks/useApiQuery.ts" \
    "React Query wrapper - auth headers, publisher context, error handling" \
    "react-hook" \
    "useApi, useQuery (React Query)" \
    "critical - used by 30+ pages"

add_ts_header "web/lib/hooks/useCategories.ts" \
    "Zmanim category grouping - display groups, filtering logic" \
    "react-hook" \
    "Category reference data" \
    "medium - 361 lines"

# Utilities (3)
add_ts_header "web/lib/dsl-reference-data.ts" \
    "DSL syntax reference - primitives, operators, functions, examples" \
    "reference-data" \
    "Used by DSL editor, formula builder" \
    "high - 455 lines"

add_ts_header "web/lib/error-humanizer.ts" \
    "API error translation - user-friendly error messages" \
    "utility" \
    "Used by 20+ components for UX" \
    "high - 376 lines"

add_ts_header "web/lib/dsl-context-helper.ts" \
    "DSL validation context - available references, formula templates" \
    "utility" \
    "Used by DSL editor, validation UI" \
    "medium - 354 lines"

# Components (10)
add_ts_header "web/components/publisher/RequestZmanModal.tsx" \
    "Multi-step zman registry request flow - form wizard with validation" \
    "client-component-complex" \
    "useApi, Form (shadcn), DSL editor" \
    "critical - 967 lines"

add_ts_header "web/components/publisher/ZmanCard.tsx" \
    "Individual zman display - versioning, aliasing, actions" \
    "client-component" \
    "useApi, Badge, Dialog (shadcn)" \
    "high - 884 lines, reused 30+ times"

add_ts_header "web/components/editor/CodeMirrorDSLEditor.tsx" \
    "Syntax-highlighted DSL editor - autocomplete, validation, linting" \
    "client-component-editor" \
    "CodeMirror 6, custom DSL language mode" \
    "critical - 779 lines"

add_ts_header "web/components/publisher/WeekPreview.tsx" \
    "7-day zmanim preview - caching, date navigation" \
    "client-component" \
    "useApi, DatePicker, Table (shadcn)" \
    "high - 617 lines"

add_ts_header "web/components/shared/CoverageSelector.tsx" \
    "Multi-level geographic selection - continent → country → region → city" \
    "client-component-complex" \
    "useApi, Select (shadcn), cascading dropdowns" \
    "high - 622 lines, used by 5 pages"

add_ts_header "web/components/publisher/MasterZmanPicker.tsx" \
    "Registry zman search and selection - autocomplete with metadata" \
    "client-component" \
    "useApi, Command (shadcn), search/filter" \
    "medium - 418 lines"

add_ts_header "web/components/shared/LocationPicker.tsx" \
    "City/location search - geolocation, autocomplete" \
    "client-component" \
    "useApi, Geolocation API, Command (shadcn)" \
    "high - 369 lines"

add_ts_header "web/components/zmanim/DatePickerDropdown.tsx" \
    "Date range picker - Hebrew calendar integration" \
    "client-component" \
    "Calendar (shadcn), date-fns, Hebrew date conversion" \
    "medium - 489 lines"

add_ts_header "web/components/publisher/CitySelector.tsx" \
    "City/region search for coverage - hierarchical search" \
    "client-component" \
    "useApi, Command (shadcn), geo API" \
    "medium - 408 lines"

add_ts_header "web/components/publisher/PublisherZmanPicker.tsx" \
    "Publisher zman search - link/copy workflow" \
    "client-component" \
    "useApi, Command (shadcn), publisher filtering" \
    "medium - 389 lines"

echo ""
echo "✅ File headers added to 40 critical files!"
echo ""
echo "Next steps:"
echo "  - Review headers with: git diff"
echo "  - Adjust if needed, then commit"
echo "  - AI agents can now quickly understand file purpose and dependencies"
