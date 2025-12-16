# Story 11.0: Data Foundation & Integrity Audit

**Epic:** Epic 11 - Publisher Zmanim Registry Interface
**Story Points:** 13
**Status:** TODO
**Priority:** CRITICAL - Foundation for entire Epic 11

---

## User Story

As a platform administrator,
I want the master registry documentation fully populated and Publisher 1 data audited for correctness,
So that the registry launches with 100% quality data that new publishers can trust.

---

## Acceptance Criteria

### AC1: Master Zmanim Documentation Completeness

**Given** the master zmanim registry has 172+ entries

**When** Story 11.0 is complete

**Then** ALL master zmanim have populated documentation fields:
- `full_description` (REQUIRED)
- `halachic_source` (REQUIRED)
- `formula_explanation` (REQUIRED)
- `usage_context` (RECOMMENDED)
- `related_zmanim_ids` (NICE TO HAVE)
- `shita` (e.g., "GRA", "MGA", "BAAL_HATANYA")
- `category` (e.g., "ALOS", "SHEMA", "TZAIS")

**And** ALL Publisher 1 zmanim have correct `master_zmanim_id` linkages

**And** Zero formula mismatches between Publisher 1 and linked master entries

**And** Database schema is extended with new fields:
- `master_zmanim_registry`: documentation fields, shita, category
- `publisher_zmanim`: `copied_from_publisher_id`, `linked_from_publisher_zman_id`
- Unique constraint: `(publisher_id, master_zmanim_id) WHERE deleted_at IS NULL`

### AC2: Documentation Backfill Success

**Given** the KosherJava research documents are available

**When** documentation backfill migration runs

**Then** mapping from KosherJava methods to master registry zman_key is complete

**And** all documentation is populated via SQL migration script

**And** validation queries confirm 100% coverage

### AC3: Publisher 1 Audit Report

**Given** Publisher 1 (MH Zmanim) data exists

**When** audit process runs

**Then** audit report is generated showing:
- Total zmanim reviewed
- Exact matches count
- Semantic matches count (with details)
- Mismatches count (with recommended corrections)
- Missing linkages count

**And** correction migration script is created and tested

**And** 100% of Publisher 1 zmanim have correct master linkages after migration

---

## Prerequisites

**NONE** - This is the first story of Epic 11 and establishes the data foundation.

---

## Technical Implementation

### Phase 1: Database Schema Extensions

#### 1.1 Create Migration: Add Registry Documentation Fields

**File:** `db/migrations/YYYYMMDDHHMMSS_add_registry_documentation_fields.sql`

```sql
-- Add documentation fields to master_zmanim_registry
ALTER TABLE master_zmanim_registry
    ADD COLUMN full_description text,
    ADD COLUMN halachic_source text,
    ADD COLUMN formula_explanation text,
    ADD COLUMN usage_context text,
    ADD COLUMN related_zmanim_ids integer[],
    ADD COLUMN shita varchar(50),
    ADD COLUMN category varchar(50);

-- Add tracking fields to publisher_zmanim
ALTER TABLE publisher_zmanim
    ADD COLUMN copied_from_publisher_id integer REFERENCES publishers(id),
    ADD COLUMN linked_from_publisher_zman_id integer REFERENCES publisher_zmanim(id);

-- Add unique constraint to prevent duplicate master imports per publisher
CREATE UNIQUE INDEX idx_publisher_zmanim_master_unique
    ON publisher_zmanim(publisher_id, master_zmanim_id)
    WHERE deleted_at IS NULL;

-- Create indexes for performance
CREATE INDEX idx_master_zmanim_shita
    ON master_zmanim_registry(shita)
    WHERE shita IS NOT NULL;

CREATE INDEX idx_master_zmanim_category
    ON master_zmanim_registry(category)
    WHERE category IS NOT NULL;

CREATE INDEX idx_master_zmanim_related
    ON master_zmanim_registry USING gin(related_zmanim_ids)
    WHERE related_zmanim_ids IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN master_zmanim_registry.full_description IS 'Comprehensive description of the zman including scientific and halachic context';
COMMENT ON COLUMN master_zmanim_registry.halachic_source IS 'Halachic sources and opinions that use this calculation';
COMMENT ON COLUMN master_zmanim_registry.formula_explanation IS 'Plain-language explanation of what the DSL formula calculates';
COMMENT ON COLUMN master_zmanim_registry.usage_context IS 'When and how this zman should be used in practice';
COMMENT ON COLUMN master_zmanim_registry.related_zmanim_ids IS 'Array of master_zmanim_registry IDs for alternative/related calculations';
COMMENT ON COLUMN master_zmanim_registry.shita IS 'Halachic opinion: GRA, MGA, BAAL_HATANYA, RABBEINU_TAM, GEONIM, etc.';
COMMENT ON COLUMN master_zmanim_registry.category IS 'Time category: ALOS, SHEMA, TEFILLA, CHATZOS, MINCHA, TZAIS, etc.';

COMMENT ON COLUMN publisher_zmanim.copied_from_publisher_id IS 'If copied from another publisher, stores the source publisher ID';
COMMENT ON COLUMN publisher_zmanim.linked_from_publisher_zman_id IS 'If linked from another publisher zman, stores the source zman ID';
```

#### 1.2 Run SQLc Generation

```bash
cd api && sqlc generate
```

**Expected Output:**
- Updated Go structs in `api/internal/db/sqlcgen/models.go`
- New fields available in query results

---

### Phase 2: Documentation Backfill

#### 2.1 Create KosherJava Mapping Document

**File:** `docs/audit/kosherjava-to-master-registry-mapping.md`

**Content Structure:**
```markdown
# KosherJava to Master Registry Mapping

## Mapping Table

| KosherJava Method | Master Registry zman_key | Match Type | Notes |
|-------------------|--------------------------|------------|-------|
| getAlos72() | alos_72min | EXACT | Dawn 72 minutes before sunrise |
| getAlos16Point1Degrees() | alos_16_1 | EXACT | Dawn at 16.1° solar depression |
| ... | ... | ... | ... |

## Categories

### ALOS (Dawn)
- alos_72min: 72 minutes before sunrise
- alos_16_1: Solar depression angle 16.1°
- ...

### SHEMA (Latest Time for Shema)
- ...

## Shita Classifications

### GRA (Vilna Gaon)
- Zmanim using fixed time offsets
- ...

### MGA (Magen Avraham)
- Zmanim using proportional hours
- ...
```

**Data Sources:**
- `docs/README-KOSHERJAVA-RESEARCH.md`
- `docs/kosherjava-zmanim-complete-extraction.md`
- KosherJava library source code analysis

#### 2.2 Create Documentation Backfill Migration

**File:** `db/migrations/YYYYMMDDHHMMSS_backfill_master_zmanim_documentation.sql`

```sql
-- Documentation backfill for master_zmanim_registry
-- Source: KosherJava research docs + halachic references

-- ALOS (Dawn) Category
UPDATE master_zmanim_registry
SET
    full_description = 'Dawn when the sun is 16.1 degrees below the horizon. This is the opinion of the GRA (Vilna Gaon) for the earliest time for morning prayers and mitzvos.',
    halachic_source = 'Based on GRA''s calculation of dawn. Used by many Ashkenazi communities for earliest time of tallis, tefillin, and Shema.',
    formula_explanation = 'Calculates the time when the sun reaches 16.1° below the eastern horizon using NOAA Solar Position Algorithm.',
    usage_context = 'Earliest time for morning mitzvos according to GRA. Commonly used for tallis, tefillin, and morning Shema.',
    shita = 'GRA',
    category = 'ALOS',
    related_zmanim_ids = ARRAY(
        SELECT id FROM master_zmanim_registry
        WHERE zman_key IN ('alos_72min', 'alos_90min', 'alos_18')
    )
WHERE zman_key = 'alos_16_1';

UPDATE master_zmanim_registry
SET
    full_description = 'Dawn 72 minutes before sunrise. This fixed-time approach is used by several poskim as an alternative to angular calculations.',
    halachic_source = 'Based on Magen Avraham and other poskim who use fixed-time offsets. Common in many communities.',
    formula_explanation = 'Subtracts 72 minutes from calculated sunrise time.',
    usage_context = 'Alternative calculation for earliest morning mitzvos. Some use this year-round, others only when angular calculation is impractical.',
    shita = 'MGA',
    category = 'ALOS',
    related_zmanim_ids = ARRAY(
        SELECT id FROM master_zmanim_registry
        WHERE zman_key IN ('alos_16_1', 'alos_90min', 'sunrise')
    )
WHERE zman_key = 'alos_72min';

-- SHEMA (Latest Time for Shema) Category
UPDATE master_zmanim_registry
SET
    full_description = 'Latest time to recite Shema according to the GRA, calculated as 3 hours (sha''os zemaniyos) after sunrise.',
    halachic_source = 'GRA calculates sha''os zemaniyos from sunrise to sunset. Latest time for Shema is 3/12 of the day.',
    formula_explanation = 'Divides time from sunrise to sunset by 12 to get one seasonal hour, then adds 3 hours to sunrise.',
    usage_context = 'Most stringent opinion for latest Shema. Used by many Ashkenazi communities.',
    shita = 'GRA',
    category = 'SHEMA',
    related_zmanim_ids = ARRAY(
        SELECT id FROM master_zmanim_registry
        WHERE zman_key IN ('sof_zman_shema_mga', 'sunrise', 'sunset')
    )
WHERE zman_key = 'sof_zman_shema_gra';

UPDATE master_zmanim_registry
SET
    full_description = 'Latest time to recite Shema according to Magen Avraham, calculated from alos to tzais (dawn to nightfall).',
    halachic_source = 'MGA calculates sha''os zemaniyos from alos (dawn) to tzais (nightfall). Provides earlier, more lenient time.',
    formula_explanation = 'Divides time from alos to tzais by 12 to get seasonal hour, then adds 3 hours to alos.',
    usage_context = 'More lenient opinion compared to GRA. Used when morning davening runs late or in extreme latitudes.',
    shita = 'MGA',
    category = 'SHEMA',
    related_zmanim_ids = ARRAY(
        SELECT id FROM master_zmanim_registry
        WHERE zman_key IN ('sof_zman_shema_gra', 'alos_72min', 'tzais_72min')
    )
WHERE zman_key = 'sof_zman_shema_mga';

-- TZAIS (Nightfall) Category
UPDATE master_zmanim_registry
SET
    full_description = 'Nightfall when three medium-sized stars are visible, calculated as 8.5 degrees below the horizon.',
    halachic_source = 'Based on the opinion that tzais kochavim occurs at 8.5° solar depression. Used by many Sephardic communities.',
    formula_explanation = 'Calculates the time when the sun reaches 8.5° below the western horizon.',
    usage_context = 'Earliest acceptable time for nightfall. Used for end of Shabbos, ma''ariv, and counting the Omer.',
    shita = 'GEONIM',
    category = 'TZAIS',
    related_zmanim_ids = ARRAY(
        SELECT id FROM master_zmanim_registry
        WHERE zman_key IN ('tzais_72min', 'tzais_rabbeinu_tam', 'sunset')
    )
WHERE zman_key = 'tzais_8_5';

UPDATE master_zmanim_registry
SET
    full_description = 'Nightfall according to Rabbeinu Tam, 72 minutes after sunset.',
    halachic_source = 'Rabbeinu Tam''s opinion that nightfall is significantly later than other opinions. Used for stringency on Shabbos and Yom Tov.',
    formula_explanation = 'Adds 72 minutes to calculated sunset time.',
    usage_context = 'Stringent opinion used for ending Shabbos and Yom Tov in many Ashkenazi communities. Not used for starting fast days.',
    shita = 'RABBEINU_TAM',
    category = 'TZAIS',
    related_zmanim_ids = ARRAY(
        SELECT id FROM master_zmanim_registry
        WHERE zman_key IN ('tzais_8_5', 'tzais_72min', 'sunset')
    )
WHERE zman_key = 'tzais_rabbeinu_tam';

-- CHATZOS (Midday/Midnight) Category
UPDATE master_zmanim_registry
SET
    full_description = 'Solar noon (chatzos hayom), the exact midpoint between sunrise and sunset.',
    halachic_source = 'Midpoint of the day according to all opinions. Earliest time for mincha gedola, latest for morning Shema in emergencies.',
    formula_explanation = 'Calculates solar noon using NOAA algorithm, or averages sunrise and sunset.',
    usage_context = 'Earliest time for mincha gedola. Also used as reference point for calculating other zmanim.',
    shita = 'UNIVERSAL',
    category = 'CHATZOS',
    related_zmanim_ids = ARRAY(
        SELECT id FROM master_zmanim_registry
        WHERE zman_key IN ('sunrise', 'sunset', 'chatzos_layla')
    )
WHERE zman_key = 'chatzos';

-- Continue for all 172+ master zmanim...
-- (Full migration would include ALL zmanim from mapping document)

-- Validation queries
DO $$
DECLARE
    missing_count integer;
    total_count integer;
BEGIN
    -- Count total master zmanim
    SELECT COUNT(*) INTO total_count FROM master_zmanim_registry;

    -- Count missing required documentation
    SELECT COUNT(*) INTO missing_count FROM master_zmanim_registry
    WHERE full_description IS NULL
       OR halachic_source IS NULL
       OR formula_explanation IS NULL;

    IF missing_count > 0 THEN
        RAISE NOTICE 'WARNING: % of % master zmanim still missing documentation', missing_count, total_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All % master zmanim have complete documentation', total_count;
    END IF;
END $$;
```

#### 2.3 Validation Queries

**File:** `scripts/validate-master-documentation.sql`

```sql
-- Validation query 1: Check all required fields populated
SELECT
    COUNT(*) FILTER (WHERE full_description IS NOT NULL) as has_description,
    COUNT(*) FILTER (WHERE halachic_source IS NOT NULL) as has_source,
    COUNT(*) FILTER (WHERE formula_explanation IS NOT NULL) as has_explanation,
    COUNT(*) FILTER (WHERE shita IS NOT NULL) as has_shita,
    COUNT(*) FILTER (WHERE category IS NOT NULL) as has_category,
    COUNT(*) as total
FROM master_zmanim_registry;

-- Expected: All counts should equal total (172+)

-- Validation query 2: Check for invalid related_zmanim_ids
SELECT
    mzr.id,
    mzr.zman_key,
    unnest(mzr.related_zmanim_ids) AS related_id
FROM master_zmanim_registry mzr
WHERE related_zmanim_ids IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM master_zmanim_registry mzr2
      WHERE mzr2.id = unnest(mzr.related_zmanim_ids)
  );

-- Expected: 0 rows (all related IDs should be valid)

-- Validation query 3: Check category distribution
SELECT category, COUNT(*) as count
FROM master_zmanim_registry
GROUP BY category
ORDER BY count DESC;

-- Expected: Reasonable distribution across ALOS, SHEMA, TZAIS, etc.

-- Validation query 4: Check shita distribution
SELECT shita, COUNT(*) as count
FROM master_zmanim_registry
GROUP BY shita
ORDER BY count DESC;

-- Expected: Reasonable distribution across GRA, MGA, GEONIM, etc.
```

---

### Phase 3: Publisher 1 Audit

#### 3.1 Create Audit Script

**File:** `scripts/audit-publisher-1-linkages.ts`

```typescript
/**
 * Publisher 1 Master Linkage Audit Script
 *
 * Analyzes all Publisher 1 (MH Zmanim) zmanim and compares them
 * to the master registry to identify:
 * - Exact matches (same formula)
 * - Semantic matches (equivalent formula, different syntax)
 * - Mismatches (wrong master linkage)
 * - Missing linkages (no master_zmanim_id)
 */

import { Pool } from 'pg';
import * as fs from 'fs';

interface PublisherZman {
  id: number;
  zman_key: string;
  hebrew_name: string;
  english_name: string;
  formula_dsl: string;
  master_zmanim_id: number | null;
}

interface MasterZman {
  id: number;
  zman_key: string;
  formula_dsl: string;
  hebrew_name: string;
  english_name: string;
}

interface AuditResult {
  total_reviewed: number;
  exact_matches: number;
  semantic_matches: number;
  mismatches: number;
  missing_linkages: number;
  details: AuditDetail[];
}

interface AuditDetail {
  publisher_zman_id: number;
  publisher_zman_key: string;
  publisher_formula: string;
  current_master_id: number | null;
  recommended_master_id: number | null;
  match_type: 'EXACT' | 'SEMANTIC' | 'MISMATCH' | 'MISSING' | 'UNKNOWN';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  notes: string;
}

async function auditPublisher1(): Promise<AuditResult> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Fetch all Publisher 1 zmanim
    const publisherResult = await pool.query<PublisherZman>(`
      SELECT id, zman_key, hebrew_name, english_name, formula_dsl, master_zmanim_id
      FROM publisher_zmanim
      WHERE publisher_id = 1
        AND deleted_at IS NULL
      ORDER BY zman_key
    `);

    // Fetch all master zmanim
    const masterResult = await pool.query<MasterZman>(`
      SELECT id, zman_key, formula_dsl, hebrew_name, english_name
      FROM master_zmanim_registry
      ORDER BY zman_key
    `);

    const publisherZmanim = publisherResult.rows;
    const masterZmanim = masterResult.rows;
    const masterByKey = new Map(masterZmanim.map(m => [m.zman_key, m]));
    const masterById = new Map(masterZmanim.map(m => [m.id, m]));

    const result: AuditResult = {
      total_reviewed: publisherZmanim.length,
      exact_matches: 0,
      semantic_matches: 0,
      mismatches: 0,
      missing_linkages: 0,
      details: [],
    };

    for (const pz of publisherZmanim) {
      const detail: AuditDetail = {
        publisher_zman_id: pz.id,
        publisher_zman_key: pz.zman_key,
        publisher_formula: pz.formula_dsl,
        current_master_id: pz.master_zmanim_id,
        recommended_master_id: null,
        match_type: 'UNKNOWN',
        confidence: 'LOW',
        notes: '',
      };

      // Case 1: No master linkage
      if (!pz.master_zmanim_id) {
        result.missing_linkages++;
        detail.match_type = 'MISSING';

        // Try to find matching master by zman_key
        const masterByKeyMatch = masterByKey.get(pz.zman_key);
        if (masterByKeyMatch) {
          if (normalizeFormula(pz.formula_dsl) === normalizeFormula(masterByKeyMatch.formula_dsl)) {
            detail.recommended_master_id = masterByKeyMatch.id;
            detail.confidence = 'HIGH';
            detail.notes = `Exact match found by zman_key: ${masterByKeyMatch.zman_key}`;
          } else {
            detail.recommended_master_id = masterByKeyMatch.id;
            detail.confidence = 'MEDIUM';
            detail.notes = `Key match but formula differs. Publisher: ${pz.formula_dsl}, Master: ${masterByKeyMatch.formula_dsl}`;
          }
        } else {
          detail.notes = 'No matching master zman found by key. Manual review required.';
          detail.confidence = 'LOW';
        }

        result.details.push(detail);
        continue;
      }

      // Case 2: Has master linkage - validate correctness
      const linkedMaster = masterById.get(pz.master_zmanim_id);
      if (!linkedMaster) {
        result.mismatches++;
        detail.match_type = 'MISMATCH';
        detail.notes = `Linked master_zmanim_id ${pz.master_zmanim_id} does not exist!`;
        detail.confidence = 'HIGH';
        result.details.push(detail);
        continue;
      }

      // Compare formulas
      const normalizedPublisher = normalizeFormula(pz.formula_dsl);
      const normalizedMaster = normalizeFormula(linkedMaster.formula_dsl);

      if (normalizedPublisher === normalizedMaster) {
        result.exact_matches++;
        detail.match_type = 'EXACT';
        detail.recommended_master_id = pz.master_zmanim_id;
        detail.confidence = 'HIGH';
        detail.notes = 'Formula matches exactly.';
      } else if (areSemanticallyEquivalent(normalizedPublisher, normalizedMaster)) {
        result.semantic_matches++;
        detail.match_type = 'SEMANTIC';
        detail.recommended_master_id = pz.master_zmanim_id;
        detail.confidence = 'MEDIUM';
        detail.notes = `Semantically equivalent. Publisher: ${pz.formula_dsl}, Master: ${linkedMaster.formula_dsl}`;
      } else {
        result.mismatches++;
        detail.match_type = 'MISMATCH';
        detail.notes = `Formula mismatch! Publisher: ${pz.formula_dsl}, Master: ${linkedMaster.formula_dsl}`;

        // Try to find correct master
        const correctMaster = findBestMatch(pz, masterZmanim);
        if (correctMaster) {
          detail.recommended_master_id = correctMaster.id;
          detail.confidence = 'MEDIUM';
          detail.notes += ` | Recommended: ${correctMaster.zman_key} (${correctMaster.formula_dsl})`;
        } else {
          detail.confidence = 'LOW';
        }
      }

      result.details.push(detail);
    }

    return result;
  } finally {
    await pool.end();
  }
}

function normalizeFormula(formula: string): string {
  return formula
    .replace(/\s+/g, '')       // Remove whitespace
    .toLowerCase()             // Lowercase
    .replace(/\(+/g, '(')      // Normalize parentheses
    .replace(/\)+/g, ')')
    .replace(/mins?/g, 'min')  // Normalize "mins" to "min"
    .trim();
}

function areSemanticallyEquivalent(f1: string, f2: string): boolean {
  // Handle common equivalent patterns
  const equivalents = [
    [/sunrise\s*\+\s*0min/g, 'sunrise'],
    [/sunset\s*-\s*0min/g, 'sunset'],
    [/(\d+)mins?/g, '$1min'],
  ];

  let norm1 = f1;
  let norm2 = f2;

  for (const [pattern, replacement] of equivalents) {
    norm1 = norm1.replace(pattern, replacement);
    norm2 = norm2.replace(pattern, replacement);
  }

  return norm1 === norm2;
}

function findBestMatch(pz: PublisherZman, masters: MasterZman[]): MasterZman | null {
  // Try exact formula match
  const normalizedPz = normalizeFormula(pz.formula_dsl);

  for (const master of masters) {
    if (normalizeFormula(master.formula_dsl) === normalizedPz) {
      return master;
    }
  }

  // Try semantic match
  for (const master of masters) {
    if (areSemanticallyEquivalent(normalizedPz, normalizeFormula(master.formula_dsl))) {
      return master;
    }
  }

  // Try key-based match
  const keyMatch = masters.find(m => m.zman_key === pz.zman_key);
  if (keyMatch) {
    return keyMatch;
  }

  return null;
}

async function generateReport(result: AuditResult): Promise<void> {
  const reportPath = 'docs/audit/publisher-1-master-linkages-audit.md';

  const report = `# Publisher 1 Master Linkages Audit Report

**Generated:** ${new Date().toISOString()}
**Publisher:** Publisher 1 (MH Zmanim)
**Total Zmanim Reviewed:** ${result.total_reviewed}

---

## Summary

| Category | Count | Percentage |
|----------|-------|------------|
| Exact Matches | ${result.exact_matches} | ${((result.exact_matches / result.total_reviewed) * 100).toFixed(1)}% |
| Semantic Matches | ${result.semantic_matches} | ${((result.semantic_matches / result.total_reviewed) * 100).toFixed(1)}% |
| Mismatches | ${result.mismatches} | ${((result.mismatches / result.total_reviewed) * 100).toFixed(1)}% |
| Missing Linkages | ${result.missing_linkages} | ${((result.missing_linkages / result.total_reviewed) * 100).toFixed(1)}% |

---

## Detailed Findings

### Exact Matches (${result.exact_matches})

${result.details
  .filter(d => d.match_type === 'EXACT')
  .map(d => `- \`${d.publisher_zman_key}\` → Master ID ${d.current_master_id} ✓`)
  .join('\n') || 'None'}

---

### Semantic Matches (${result.semantic_matches})

${result.details
  .filter(d => d.match_type === 'SEMANTIC')
  .map(d => `
#### ${d.publisher_zman_key}
- **Publisher Zman ID:** ${d.publisher_zman_id}
- **Current Master ID:** ${d.current_master_id}
- **Confidence:** ${d.confidence}
- **Notes:** ${d.notes}
`)
  .join('\n') || 'None'}

---

### Mismatches (${result.mismatches})

${result.details
  .filter(d => d.match_type === 'MISMATCH')
  .map(d => `
#### ${d.publisher_zman_key}
- **Publisher Zman ID:** ${d.publisher_zman_id}
- **Current Master ID:** ${d.current_master_id}
- **Recommended Master ID:** ${d.recommended_master_id || 'NONE'}
- **Confidence:** ${d.confidence}
- **Notes:** ${d.notes}
`)
  .join('\n') || 'None'}

---

### Missing Linkages (${result.missing_linkages})

${result.details
  .filter(d => d.match_type === 'MISSING')
  .map(d => `
#### ${d.publisher_zman_key}
- **Publisher Zman ID:** ${d.publisher_zman_id}
- **Publisher Formula:** \`${d.publisher_formula}\`
- **Recommended Master ID:** ${d.recommended_master_id || 'NONE'}
- **Confidence:** ${d.confidence}
- **Notes:** ${d.notes}
`)
  .join('\n') || 'None'}

---

## Recommended Actions

### High Confidence Corrections (${result.details.filter(d => d.confidence === 'HIGH' && d.recommended_master_id).length})

These can be automatically migrated:

\`\`\`sql
${result.details
  .filter(d => d.confidence === 'HIGH' && d.recommended_master_id)
  .map(d => `UPDATE publisher_zmanim SET master_zmanim_id = ${d.recommended_master_id} WHERE id = ${d.publisher_zman_id};`)
  .join('\n') || '-- None'}
\`\`\`

### Medium Confidence Corrections (${result.details.filter(d => d.confidence === 'MEDIUM' && d.recommended_master_id).length})

Review before migrating:

${result.details
  .filter(d => d.confidence === 'MEDIUM' && d.recommended_master_id)
  .map(d => `- ID ${d.publisher_zman_id} (\`${d.publisher_zman_key}\`): ${d.notes}`)
  .join('\n') || 'None'}

### Manual Review Required (${result.details.filter(d => d.confidence === 'LOW').length})

${result.details
  .filter(d => d.confidence === 'LOW')
  .map(d => `- ID ${d.publisher_zman_id} (\`${d.publisher_zman_key}\`): ${d.notes}`)
  .join('\n') || 'None'}

---

_Generated by audit-publisher-1-linkages.ts_
`;

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`Audit report written to ${reportPath}`);
}

// Run audit
auditPublisher1()
  .then(result => {
    console.log('\n=== AUDIT RESULTS ===');
    console.log(`Total Reviewed: ${result.total_reviewed}`);
    console.log(`Exact Matches: ${result.exact_matches}`);
    console.log(`Semantic Matches: ${result.semantic_matches}`);
    console.log(`Mismatches: ${result.mismatches}`);
    console.log(`Missing Linkages: ${result.missing_linkages}`);
    console.log('=====================\n');

    return generateReport(result);
  })
  .then(() => {
    console.log('Audit complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
```

#### 3.2 Run Audit Script

```bash
# Set database connection
source api/.env

# Run audit
npx ts-node scripts/audit-publisher-1-linkages.ts

# Review generated report
cat docs/audit/publisher-1-master-linkages-audit.md
```

#### 3.3 Create Correction Migration

**File:** `db/migrations/YYYYMMDDHHMMSS_fix_publisher_1_master_linkages.sql`

```sql
-- Publisher 1 Master Linkage Corrections
-- Based on audit report: docs/audit/publisher-1-master-linkages-audit.md
-- CRITICAL: Review audit report before running this migration!

-- High confidence corrections (auto-generated from audit)
-- [Populated after audit runs with HIGH confidence recommendations]

UPDATE publisher_zmanim SET master_zmanim_id = 123 WHERE id = 456;  -- Example
UPDATE publisher_zmanim SET master_zmanim_id = 789 WHERE id = 012;  -- Example

-- Validation: Check all Publisher 1 zmanim now have master linkages
DO $$
DECLARE
    missing_count integer;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM publisher_zmanim
    WHERE publisher_id = 1
      AND master_zmanim_id IS NULL
      AND deleted_at IS NULL;

    IF missing_count > 0 THEN
        RAISE EXCEPTION 'Still have % Publisher 1 zmanim without master linkage!', missing_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All Publisher 1 zmanim have master linkages';
    END IF;
END $$;
```

---

## Testing Requirements

### Unit Tests

**None required** - This story is primarily data migration and validation.

### Integration Tests

**File:** `tests/sql/registry-data-validation.sql`

```sql
-- Test 1: All master zmanim have required documentation
SELECT
    'Test 1: Required documentation' as test_name,
    CASE
        WHEN COUNT(*) FILTER (WHERE full_description IS NULL) = 0
         AND COUNT(*) FILTER (WHERE halachic_source IS NULL) = 0
         AND COUNT(*) FILTER (WHERE formula_explanation IS NULL) = 0
        THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as total_zmanim,
    COUNT(*) FILTER (WHERE full_description IS NULL) as missing_description,
    COUNT(*) FILTER (WHERE halachic_source IS NULL) as missing_source,
    COUNT(*) FILTER (WHERE formula_explanation IS NULL) as missing_explanation
FROM master_zmanim_registry;

-- Test 2: All related_zmanim_ids are valid
SELECT
    'Test 2: Valid related_zmanim_ids' as test_name,
    CASE
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as invalid_references
FROM (
    SELECT mzr.id, unnest(mzr.related_zmanim_ids) AS related_id
    FROM master_zmanim_registry mzr
    WHERE related_zmanim_ids IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM master_zmanim_registry mzr2
          WHERE mzr2.id = unnest(mzr.related_zmanim_ids)
      )
) invalid;

-- Test 3: All Publisher 1 zmanim have master linkages
SELECT
    'Test 3: Publisher 1 master linkages' as test_name,
    CASE
        WHEN COUNT(*) FILTER (WHERE master_zmanim_id IS NULL) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as total_zmanim,
    COUNT(*) FILTER (WHERE master_zmanim_id IS NULL) as missing_linkages
FROM publisher_zmanim
WHERE publisher_id = 1
  AND deleted_at IS NULL;

-- Test 4: Unique constraint prevents duplicates
SELECT
    'Test 4: No duplicate master imports per publisher' as test_name,
    CASE
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as duplicate_count
FROM (
    SELECT publisher_id, master_zmanim_id, COUNT(*) as cnt
    FROM publisher_zmanim
    WHERE deleted_at IS NULL
      AND master_zmanim_id IS NOT NULL
    GROUP BY publisher_id, master_zmanim_id
    HAVING COUNT(*) > 1
) duplicates;

-- Test 5: Indexes exist
SELECT
    'Test 5: Performance indexes exist' as test_name,
    CASE
        WHEN COUNT(*) = 4 THEN 'PASS'
        ELSE 'FAIL'
    END as result,
    COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
      'idx_master_zmanim_shita',
      'idx_master_zmanim_category',
      'idx_master_zmanim_related',
      'idx_publisher_zmanim_master_unique'
  );
```

### Manual QA

1. **Review KosherJava mapping document** - Verify all 172+ zmanim mapped correctly
2. **Review documentation backfill migration** - Spot-check 10 random zmanim for accuracy
3. **Review audit report** - Verify counts make sense, check mismatch examples
4. **Review correction migration** - Verify SQL statements match audit recommendations
5. **Run validation queries** - All should return 100% coverage

---

## Definition of Done

- [ ] Database schema extended with all new fields (documentation, tracking, unique constraint)
- [ ] KosherJava mapping document complete (172+ zmanim mapped)
- [ ] Documentation backfill migration created and tested locally
- [ ] All 172+ master zmanim have `full_description`, `halachic_source`, `formula_explanation`
- [ ] All 172+ master zmanim have `shita` and `category` classified
- [ ] Related zmanim linkages populated (where applicable)
- [ ] Publisher 1 audit script created and executed
- [ ] Audit report generated and reviewed
- [ ] Correction migration created based on HIGH confidence recommendations
- [ ] All Publisher 1 zmanim have correct `master_zmanim_id` after correction
- [ ] Zero formula mismatches between Publisher 1 and master (after correction)
- [ ] All validation SQL tests pass (100% coverage)
- [ ] Performance indexes created and verified
- [ ] Unique constraint prevents duplicate imports (tested)
- [ ] `sqlc generate` executed successfully
- [ ] Documentation updated:
  - [ ] `docs/audit/kosherjava-to-master-registry-mapping.md` created
  - [ ] `docs/audit/publisher-1-master-linkages-audit.md` generated
  - [ ] Migration notes added to README if needed
- [ ] Code reviewed by tech lead
- [ ] Merged to `dev` branch

---

## Dependencies

**Upstream:** None (this is the foundation story)

**Downstream:**
- Story 11.1: Master Registry Browser (depends on documentation fields)
- Story 11.2: Master Zman Documentation Modal (depends on documentation content)
- Story 11.3: Publisher Examples Browser (depends on tracking fields)
- All subsequent Epic 11 stories depend on this data foundation

---

## Risks & Mitigation

### Risk 1: Incomplete KosherJava Documentation
**Impact:** Some master zmanim may lack comprehensive documentation
**Mitigation:**
- Prioritize REQUIRED fields (description, source, explanation)
- Mark incomplete entries for follow-up
- Launch with 90%+ coverage acceptable, complete post-launch

### Risk 2: Publisher 1 Audit Finds Many Mismatches
**Impact:** Correction migration becomes complex and risky
**Mitigation:**
- Only auto-migrate HIGH confidence corrections
- Manual review for MEDIUM/LOW confidence
- Test correction migration on staging first
- Keep audit report for reference

### Risk 3: Related Zmanim Cycles
**Impact:** Circular references in `related_zmanim_ids`
**Mitigation:**
- Validation query checks for invalid IDs
- Frontend (Story 11.2) implements cycle detection
- Not a blocker for data foundation

---

## Notes

### Data Sources Priority
1. **Primary:** `docs/kosherjava-zmanim-complete-extraction.md`
2. **Secondary:** KosherJava library source code
3. **Tertiary:** Halachic references (Shulchan Aruch, poskim)

### Shita Classifications
- **GRA** (Vilna Gaon): Fixed sunrise-to-sunset calculations
- **MGA** (Magen Avraham): Alos-to-tzais calculations
- **BAAL_HATANYA**: Chabad tradition
- **RABBEINU_TAM**: Late nightfall opinions
- **GEONIM**: Early nightfall opinions
- **UNIVERSAL**: Applies to all opinions (e.g., noon)

### Category Classifications
- **ALOS**: Dawn times
- **SHEMA**: Latest time for Shema
- **TEFILLA**: Latest time for Shacharis
- **CHATZOS**: Midday/midnight
- **MINCHA**: Afternoon prayer times
- **TZAIS**: Nightfall times
- **OTHER**: Special zmanim (fast start/end, candle lighting, etc.)

### Migration Order (CRITICAL)
1. Schema changes FIRST (add columns, indexes, constraints)
2. Documentation backfill SECOND (populate master registry)
3. Audit THIRD (analyze Publisher 1)
4. Corrections FOURTH (fix Publisher 1 linkages)

This order prevents foreign key violations and ensures data integrity.

---

## Success Metrics

### Quantitative
- **100%** of master zmanim have required documentation fields populated
- **100%** of Publisher 1 zmanim have correct `master_zmanim_id`
- **0** formula mismatches between Publisher 1 and linked master entries
- **<5 minutes** total migration runtime
- **0** rollbacks required

### Qualitative
- Audit report provides clear, actionable recommendations
- Documentation is accurate and helpful for publishers
- Schema extensions support all Epic 11 requirements
- Foundation enables Stories 11.1-11.6 without schema changes

---

_Story created: 2025-12-22_
_Epic: 11 - Publisher Zmanim Registry Interface_
_Part of BMad Method - BMM Workflow_
