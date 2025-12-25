#!/bin/bash
# Verification script for hebcal event sync migration
# Run this AFTER applying migration 20251224210000_sync_hebcal_events.sql

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Hebcal Event Sync - Verification Script"
echo "=========================================="
echo ""

# Load database connection
if [ -f "api/.env" ]; then
    source api/.env
else
    echo -e "${RED}Error: api/.env not found${NC}"
    exit 1
fi

# Test 1: Check apostrophe patterns
echo -e "${YELLOW}Test 1: Verifying apostrophe patterns...${NC}"
APOSTROPHE_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM tag_event_mappings
    WHERE hebcal_event_pattern LIKE '%'%'
    AND hebcal_event_pattern NOT LIKE '%''%';
")

if [ "$APOSTROPHE_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ No fancy apostrophes found - all patterns use standard apostrophes${NC}"
else
    echo -e "${RED}✗ Found $APOSTROPHE_COUNT patterns with fancy apostrophes${NC}"
    psql "$DATABASE_URL" -c "
        SELECT id, tag_id, hebcal_event_pattern
        FROM tag_event_mappings
        WHERE hebcal_event_pattern LIKE '%'%'
        AND hebcal_event_pattern NOT LIKE '%''%';
    "
fi
echo ""

# Test 2: Check CH''M patterns
echo -e "${YELLOW}Test 2: Verifying CH''M double apostrophe...${NC}"
CHM_SINGLE=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM tag_event_mappings
    WHERE hebcal_event_pattern LIKE '%(CH''M)%'
    AND hebcal_event_pattern NOT LIKE '%(CH''''M)%';
")

CHM_DOUBLE=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM tag_event_mappings
    WHERE hebcal_event_pattern LIKE '%(CH''''M)%';
")

if [ "$CHM_SINGLE" -eq 0 ] && [ "$CHM_DOUBLE" -gt 0 ]; then
    echo -e "${GREEN}✓ All CH''M patterns use double apostrophe ($CHM_DOUBLE found)${NC}"
else
    echo -e "${RED}✗ Found $CHM_SINGLE patterns with single apostrophe in CH'M${NC}"
    psql "$DATABASE_URL" -c "
        SELECT id, tag_id, hebcal_event_pattern
        FROM tag_event_mappings
        WHERE hebcal_event_pattern LIKE '%(CH''M)%';
    "
fi
echo ""

# Test 3: Verify tag_id 5 only maps to Tzom Tammuz
echo -e "${YELLOW}Test 3: Verifying tag_id 5 (shiva_asar_btamuz) mappings...${NC}"
TAG5_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM tag_event_mappings
    WHERE tag_id = 5;
")

TAG5_CORRECT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM tag_event_mappings
    WHERE tag_id = 5
    AND hebcal_event_pattern = 'Tzom Tammuz';
")

if [ "$TAG5_COUNT" -eq 1 ] && [ "$TAG5_CORRECT" -eq 1 ]; then
    echo -e "${GREEN}✓ tag_id 5 correctly maps only to 'Tzom Tammuz'${NC}"
else
    echo -e "${RED}✗ tag_id 5 has $TAG5_COUNT mappings (expected 1)${NC}"
    psql "$DATABASE_URL" -c "
        SELECT id, tag_id, hebcal_event_pattern
        FROM tag_event_mappings
        WHERE tag_id = 5;
    "
fi
echo ""

# Test 4: Check new tags were added
echo -e "${YELLOW}Test 4: Verifying new event tags (300-316)...${NC}"
NEW_TAGS=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM zman_tags
    WHERE id BETWEEN 300 AND 316;
")

if [ "$NEW_TAGS" -eq 17 ]; then
    echo -e "${GREEN}✓ All 17 new event tags added successfully${NC}"
    psql "$DATABASE_URL" -c "
        SELECT id, tag_key, display_name_english_ashkenazi
        FROM zman_tags
        WHERE id BETWEEN 300 AND 316
        ORDER BY id;
    "
else
    echo -e "${RED}✗ Expected 17 new tags, found $NEW_TAGS${NC}"
fi
echo ""

# Test 5: Check Chanukah mappings
echo -e "${YELLOW}Test 5: Verifying Chanukah day mappings...${NC}"
CHANUKAH_DAYS=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(DISTINCT tag_id)
    FROM tag_event_mappings
    WHERE hebcal_event_pattern LIKE 'Chanukah: % Candle%'
    AND tag_id BETWEEN 308 AND 315;
")

if [ "$CHANUKAH_DAYS" -eq 8 ]; then
    echo -e "${GREEN}✓ All 8 Chanukah days have individual tags${NC}"
else
    echo -e "${RED}✗ Expected 8 Chanukah day tags, found $CHANUKAH_DAYS${NC}"
fi
echo ""

# Test 6: Check metadata fields
echo -e "${YELLOW}Test 6: Verifying metadata (yom_tov_level, fast_start_type)...${NC}"
YOM_TOV_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM tag_event_mappings
    WHERE yom_tov_level = 1;
")

FAST_DAWN_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM tag_event_mappings
    WHERE fast_start_type = 'dawn';
")

FAST_SUNSET_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*)
    FROM tag_event_mappings
    WHERE fast_start_type = 'sunset';
")

echo -e "  Yom Tov level 1: $YOM_TOV_COUNT mappings"
echo -e "  Fasts starting at dawn: $FAST_DAWN_COUNT"
echo -e "  Fasts starting at sunset: $FAST_SUNSET_COUNT"

if [ "$YOM_TOV_COUNT" -gt 0 ] && [ "$FAST_DAWN_COUNT" -gt 0 ] && [ "$FAST_SUNSET_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Metadata fields populated${NC}"
else
    echo -e "${RED}✗ Some metadata fields missing${NC}"
fi
echo ""

# Test 7: Sample pattern matching
echo -e "${YELLOW}Test 7: Sample pattern matching tests...${NC}"
PATTERNS=(
    "Rosh Hashana%"
    "Yom Kippur"
    "Sukkot III (CH''''M)"
    "Ta''anit Esther"
    "Tish''a B''Av"
    "Chanukah: 1 Candle"
)

for pattern in "${PATTERNS[@]}"; do
    COUNT=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*)
        FROM tag_event_mappings
        WHERE hebcal_event_pattern = '$pattern';
    ")

    if [ "$COUNT" -gt 0 ]; then
        echo -e "${GREEN}  ✓ Pattern found: $pattern${NC}"
    else
        echo -e "${RED}  ✗ Pattern missing: $pattern${NC}"
    fi
done
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}Verification Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review any errors above"
echo "2. Test event matching with hebcal API"
echo "3. Check UI displays correct event names"
echo ""
