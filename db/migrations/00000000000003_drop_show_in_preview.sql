-- Migration: Drop show_in_preview column from publisher_zmanim
-- Date: 2025-12-29
--
-- This migration removes the show_in_preview column which was incorrectly
-- implemented as a database flag. Event filtering is now purely tag-based
-- using ShouldShowZman(tags, activeEventCodes) in the service layer.
--
-- The computed field is_active_today indicates if a zman is relevant for
-- the current day based on tag matching.

-- Drop the column from publisher_zmanim table
ALTER TABLE publisher_zmanim DROP COLUMN IF EXISTS show_in_preview;
