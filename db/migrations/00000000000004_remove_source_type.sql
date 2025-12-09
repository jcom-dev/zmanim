-- Migration: Remove source_type from publisher_zmanim
-- The source_type column is redundant because:
-- - is_linked=true means the zman is linked to another publisher
-- - is_linked=false (linked_publisher_zman_id IS NULL) means it's from registry
-- No need to track this separately.

-- Step 1: Drop the foreign key constraint
ALTER TABLE publisher_zmanim DROP CONSTRAINT IF EXISTS publisher_zmanim_source_type_id_fkey;

-- Step 2: Drop the source_type_id column
ALTER TABLE publisher_zmanim DROP COLUMN IF EXISTS source_type_id;

-- Step 3: Drop the zman_source_types lookup table (no longer needed)
DROP TABLE IF EXISTS zman_source_types CASCADE;

-- Step 4: Remove index if exists
DROP INDEX IF EXISTS idx_zman_source_types_key;
