#!/bin/bash
# Authentication Testing Script for Shtetl Zmanim API
# Usage: ./test-auth.sh [token] [api_base]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TOKEN="${1:-$CLERK_TEST_TOKEN}"
API_BASE="${2:-http://localhost:8080}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Shtetl Zmanim API Authentication Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "API Base: ${YELLOW}$API_BASE${NC}"

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: No token provided${NC}"
    echo ""
    echo "Usage: $0 <token> [api_base]"
    echo ""
    echo "To get a token:"
    echo "1. Open browser DevTools on the Shtetl Zmanim site"
    echo "2. Go to Application > Local Storage or check Network requests"
    echo "3. Find a request with Authorization header"
    echo "4. Copy the Bearer token (without 'Bearer ' prefix)"
    echo ""
    echo "Or set CLERK_TEST_TOKEN environment variable"
    exit 1
fi

echo -e "Token: ${YELLOW}${TOKEN:0:20}...${NC}"
echo ""

# Function to test an endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local description="$3"
    local data="$4"
    local extra_headers="$5"

    echo -e "${BLUE}Testing: $description${NC}"
    echo -e "  ${method} ${endpoint}"

    local curl_args="-s -w '\n%{http_code}' -X ${method}"
    curl_args="$curl_args -H 'Content-Type: application/json'"
    curl_args="$curl_args -H 'Authorization: Bearer ${TOKEN}'"

    if [ -n "$extra_headers" ]; then
        curl_args="$curl_args $extra_headers"
    fi

    if [ -n "$data" ]; then
        curl_args="$curl_args -d '$data'"
    fi

    # Execute curl and capture response
    local response
    if [ -n "$data" ]; then
        response=$(curl -s -w '\n%{http_code}' -X "${method}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${TOKEN}" \
            ${extra_headers} \
            -d "${data}" \
            "${API_BASE}${endpoint}" 2>&1)
    else
        response=$(curl -s -w '\n%{http_code}' -X "${method}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${TOKEN}" \
            ${extra_headers} \
            "${API_BASE}${endpoint}" 2>&1)
    fi

    # Extract status code (last line) and body (everything else)
    local status_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$status_code" -ge 200 ] && [ "$status_code" -lt 300 ]; then
        echo -e "  ${GREEN}Status: $status_code OK${NC}"
        # Show first 200 chars of response
        echo -e "  Response: ${body:0:200}..."
    elif [ "$status_code" -eq 401 ]; then
        echo -e "  ${RED}Status: $status_code UNAUTHORIZED${NC}"
        echo -e "  ${RED}Response: $body${NC}"
    elif [ "$status_code" -eq 403 ]; then
        echo -e "  ${YELLOW}Status: $status_code FORBIDDEN (missing role?)${NC}"
        echo -e "  Response: $body"
    else
        echo -e "  ${YELLOW}Status: $status_code${NC}"
        echo -e "  Response: $body"
    fi
    echo ""
}

# Test health endpoint (no auth required)
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}1. Health Check (No Auth)${NC}"
echo -e "${BLUE}========================================${NC}"
test_endpoint "GET" "/health" "Health check"

# Test public endpoints
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}2. Public Endpoints${NC}"
echo -e "${BLUE}========================================${NC}"
test_endpoint "GET" "/api/v1/publishers" "List publishers"
test_endpoint "GET" "/api/v1/cities?q=New%20York" "Search cities"

# Test authenticated publisher endpoints
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}3. Publisher Endpoints (Require 'publisher' role)${NC}"
echo -e "${BLUE}========================================${NC}"
test_endpoint "GET" "/api/v1/publisher/accessible" "Get accessible publishers"
test_endpoint "GET" "/api/v1/publisher/algorithm" "Get algorithm (no publisher ID)"
test_endpoint "GET" "/api/v1/publisher/algorithm/templates" "Get algorithm templates"

# Test with a publisher ID header (if we got accessible publishers)
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}4. Publisher Endpoints (with X-Publisher-Id)${NC}"
echo -e "${BLUE}========================================${NC}"

# First, try to get accessible publishers to find a valid ID
echo "Fetching accessible publishers to get a valid publisher ID..."
accessible_response=$(curl -s -X GET \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    "${API_BASE}/api/v1/publisher/accessible" 2>&1)

# Try to extract first publisher ID (basic parsing)
publisher_id=$(echo "$accessible_response" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

if [ -n "$publisher_id" ] && [ "$publisher_id" != "null" ]; then
    echo -e "Found publisher ID: ${GREEN}$publisher_id${NC}"
    echo ""
    test_endpoint "GET" "/api/v1/publisher/algorithm" "Get algorithm with publisher ID" "" "-H 'X-Publisher-Id: ${publisher_id}'"
    test_endpoint "GET" "/api/v1/publisher/coverage" "Get coverage with publisher ID" "" "-H 'X-Publisher-Id: ${publisher_id}'"
else
    echo -e "${YELLOW}No publisher ID found - user may not have publisher access${NC}"
    echo ""
fi

# Test admin endpoints
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}5. Admin Endpoints (Require 'admin' role)${NC}"
echo -e "${BLUE}========================================${NC}"
test_endpoint "GET" "/api/v1/admin/stats" "Admin stats"
test_endpoint "GET" "/api/v1/admin/publishers" "Admin list publishers"

# JWT Token inspection
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}6. JWT Token Inspection${NC}"
echo -e "${BLUE}========================================${NC}"

# Decode JWT payload (base64)
jwt_parts=(${TOKEN//./ })
if [ ${#jwt_parts[@]} -eq 3 ]; then
    # Add padding if needed and decode
    payload="${jwt_parts[1]}"
    # Add padding
    padding=$((4 - ${#payload} % 4))
    if [ $padding -ne 4 ]; then
        payload="${payload}$(printf '=%.0s' $(seq 1 $padding))"
    fi

    decoded=$(echo "$payload" | base64 -d 2>/dev/null || echo "Failed to decode")

    echo "JWT Payload (decoded):"
    echo "$decoded" | python3 -m json.tool 2>/dev/null || echo "$decoded"
    echo ""

    # Check for role in the token
    if echo "$decoded" | grep -q '"role"'; then
        echo -e "${GREEN}Role found in token${NC}"
    else
        echo -e "${YELLOW}No 'role' field found in token - this may cause 401/403 errors${NC}"
        echo "The user needs 'publisher' role in Clerk metadata to access publisher endpoints"
    fi
else
    echo -e "${RED}Invalid JWT format${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Complete${NC}"
echo -e "${BLUE}========================================${NC}"
