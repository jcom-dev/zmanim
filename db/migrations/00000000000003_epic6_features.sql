-- Migration: Epic 6 - Indexes, Location Overrides, and Correction Requests
-- Description: Consolidated migration for Epic 6 features
-- Merged from migrations 003-008 with final schema state (post-cleanup)
--
-- Contains:
-- 1. Lookup table indexes (performance optimization)
-- 2. Publisher Location Overrides table (Story 6.4)
-- 3. City Correction Requests table (Story 6.5)
-- 4. Performance indexes for Epic 6 features (Story 6.6)

-- ============================================================================
-- PART 1: LOOKUP TABLE INDEXES
-- Add indexes to lookup table "key" columns that are frequently joined
-- ============================================================================

-- publisher_statuses.key - Used in AdminListPublishers, AdminCountPublishers,
-- AdminGetPublisherStats, and many status filter queries
CREATE INDEX IF NOT EXISTS idx_publisher_statuses_key ON publisher_statuses (key);

-- algorithm_statuses.key - Used in AdminListAlgorithms, AdminCountAlgorithms,
-- AdminGetStatistics
CREATE INDEX IF NOT EXISTS idx_algorithm_statuses_key ON algorithm_statuses (key);

-- request_statuses.key - Used in CheckExistingPublisherRequest,
-- GetPublisherRequestsByStatus, all request status updates
CREATE INDEX IF NOT EXISTS idx_request_statuses_key ON request_statuses (key);

-- coverage_levels.key - Used in multiple coverage queries
CREATE INDEX IF NOT EXISTS idx_coverage_levels_key ON coverage_levels (key);

-- publisher_roles.key - Used in GetPublisherRoleByKey, invitation queries
CREATE INDEX IF NOT EXISTS idx_publisher_roles_key ON publisher_roles (key);

-- zman_tags.tag_key - Used in GetTagByKey, GetTagsByKeys, GetZmanimByActiveTags
CREATE INDEX IF NOT EXISTS idx_zman_tags_tag_key ON zman_tags (tag_key);

-- zman_source_types.key - Used in zmanim queries for source type resolution
CREATE INDEX IF NOT EXISTS idx_zman_source_types_key ON zman_source_types (key);

-- geo_data_sources.key - Used in GetNameMapping and geo coordinate queries
CREATE INDEX IF NOT EXISTS idx_geo_data_sources_key ON geo_data_sources (key);

-- geo_levels.key - Used in GetBoundaryImportsByLevel, GetNameMappingsByLevel
CREATE INDEX IF NOT EXISTS idx_geo_levels_key ON geo_levels (key);

-- fast_start_types.key - Used in calendar event queries
CREATE INDEX IF NOT EXISTS idx_fast_start_types_key ON fast_start_types (key);

-- publisher_invitations: Optimizes GetPendingInvitations, GetExpiredInvitations
CREATE INDEX IF NOT EXISTS idx_publisher_invitations_publisher_expires
    ON publisher_invitations (publisher_id, expires_at DESC);

-- ai_audit_logs: Optimizes GetAIAuditLogs with request_type filter
CREATE INDEX IF NOT EXISTS idx_ai_audit_type_created
    ON ai_audit_logs (request_type, created_at DESC);

-- ============================================================================
-- PART 2: PUBLISHER LOCATION OVERRIDES TABLE (Story 6.4)
-- Allows publishers to override city coordinates and elevation for their users
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.publisher_location_overrides (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
    city_id integer NOT NULL REFERENCES public.geo_cities(id) ON DELETE CASCADE,

    -- Overrides (NULL = use original city data)
    override_latitude double precision,
    override_longitude double precision,
    override_elevation integer,

    -- Metadata
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Constraints
    UNIQUE(publisher_id, city_id)
);

-- Indexes for publisher_location_overrides
CREATE INDEX IF NOT EXISTS idx_publisher_overrides_publisher ON public.publisher_location_overrides(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_overrides_city ON public.publisher_location_overrides(city_id);

-- Covering index for zmanim calculation lookups - enables index-only scans
CREATE INDEX IF NOT EXISTS idx_publisher_location_overrides_calculation
  ON publisher_location_overrides(publisher_id, city_id)
  INCLUDE (override_latitude, override_longitude, override_elevation);

COMMENT ON TABLE public.publisher_location_overrides IS 'Publisher-specific location data overrides (lat/lon/elevation only) for accurate zmanim calculations';
COMMENT ON COLUMN public.publisher_location_overrides.override_latitude IS 'Override latitude in decimal degrees (-90 to 90)';
COMMENT ON COLUMN public.publisher_location_overrides.override_longitude IS 'Override longitude in decimal degrees (-180 to 180)';
COMMENT ON COLUMN public.publisher_location_overrides.override_elevation IS 'Override elevation in meters';
COMMENT ON COLUMN public.publisher_location_overrides.reason IS 'Optional explanation for the override';

-- ============================================================================
-- PART 3: CITY CORRECTION REQUESTS TABLE (Story 6.5)
-- Community-submitted corrections to global city data
-- ============================================================================

CREATE TABLE IF NOT EXISTS city_correction_requests (
  id SERIAL PRIMARY KEY,
  city_id BIGINT NOT NULL REFERENCES geo_cities(id) ON DELETE CASCADE,
  publisher_id INTEGER REFERENCES publishers(id) ON DELETE SET NULL,

  -- Requester info (from Clerk user)
  requester_email TEXT NOT NULL,
  requester_name TEXT,

  -- Proposed corrections (NULL = no change proposed)
  proposed_latitude DOUBLE PRECISION,
  proposed_longitude DOUBLE PRECISION,
  proposed_elevation INTEGER,

  -- Request details
  correction_reason TEXT NOT NULL,
  evidence_urls TEXT[],

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Admin review
  reviewed_by TEXT,  -- Clerk user ID
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- At least one proposed value must be non-null
  CONSTRAINT at_least_one_proposed_value CHECK (
    proposed_latitude IS NOT NULL OR
    proposed_longitude IS NOT NULL OR
    proposed_elevation IS NOT NULL
  )
);

-- Indexes for city_correction_requests
CREATE INDEX IF NOT EXISTS idx_correction_requests_status ON city_correction_requests(status);
CREATE INDEX IF NOT EXISTS idx_correction_requests_city ON city_correction_requests(city_id);
CREATE INDEX IF NOT EXISTS idx_correction_requests_publisher ON city_correction_requests(publisher_id);
CREATE INDEX IF NOT EXISTS idx_correction_requests_created_at ON city_correction_requests(created_at DESC);

-- Partial index for pending requests (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_city_correction_requests_pending
  ON city_correction_requests(status, created_at DESC)
  WHERE status = 'pending';

-- Composite index for publisher-specific requests
CREATE INDEX IF NOT EXISTS idx_city_correction_requests_publisher_created
  ON city_correction_requests(publisher_id, created_at DESC)
  WHERE publisher_id IS NOT NULL;

COMMENT ON TABLE city_correction_requests IS 'Community-submitted corrections to global city data';
COMMENT ON COLUMN city_correction_requests.publisher_id IS 'Publisher who submitted the request (nullable for anonymous)';
COMMENT ON COLUMN city_correction_requests.requester_email IS 'Email of the person who submitted the request';
COMMENT ON COLUMN city_correction_requests.correction_reason IS 'Explanation of why the correction is needed';
COMMENT ON COLUMN city_correction_requests.evidence_urls IS 'Links to supporting evidence (surveys, official sources, etc.)';
COMMENT ON COLUMN city_correction_requests.reviewed_by IS 'Clerk user ID of admin who reviewed the request';

-- ============================================================================
-- PART 4: PERFORMANCE INDEXES FOR EPIC 6 FEATURES (Story 6.6)
-- ============================================================================

-- Tag Event Mappings: Priority index for ORDER BY clauses
CREATE INDEX IF NOT EXISTS idx_tag_event_mappings_priority
  ON tag_event_mappings(priority DESC)
  WHERE hebrew_month IS NOT NULL;

COMMENT ON INDEX idx_tag_event_mappings_priority IS
  'Optimizes ORDER BY priority DESC in GetTagsForHebrewDate query';

-- Publisher Zman Tags: Covering index for tag lookups
CREATE INDEX IF NOT EXISTS idx_publisher_zman_tags_covering
  ON publisher_zman_tags(publisher_zman_id, tag_id)
  INCLUDE (is_negated);

COMMENT ON INDEX idx_publisher_zman_tags_covering IS
  'Covering index for GetZmanTags query - avoids heap lookups';

-- Tag Event Mappings: Composite index for range queries
CREATE INDEX IF NOT EXISTS idx_tag_event_mappings_date_range
  ON tag_event_mappings(hebrew_month, hebrew_day_start, COALESCE(hebrew_day_end, hebrew_day_start))
  WHERE hebrew_month IS NOT NULL;

COMMENT ON INDEX idx_tag_event_mappings_date_range IS
  'Optimizes BETWEEN queries on hebrew_day_start and hebrew_day_end';

-- ============================================================================
-- PART 5: UPDATE STATISTICS
-- ============================================================================

-- Update statistics for query planner on affected tables
-- Note: These only run if the tables have data
DO $$
BEGIN
  -- Only analyze tables that exist and have data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tag_event_mappings') THEN
    ANALYZE tag_event_mappings;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_zman_tags') THEN
    ANALYZE master_zman_tags;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'publisher_zman_tags') THEN
    ANALYZE publisher_zman_tags;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'publisher_location_overrides') THEN
    ANALYZE publisher_location_overrides;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'city_correction_requests') THEN
    ANALYZE city_correction_requests;
  END IF;
END $$;
