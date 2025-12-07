-- Migration: Schema
-- Description: Core database schema for Zmanim Lab

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE FUNCTION public.cleanup_expired_explanations() RETURNS integer
    LANGUAGE plpgsql AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM explanation_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

CREATE FUNCTION public.get_next_zman_version(p_publisher_zman_id uuid) RETURNS integer
    LANGUAGE plpgsql AS $$
DECLARE max_version INT;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) INTO max_version
    FROM publisher_zman_versions WHERE publisher_zman_id = p_publisher_zman_id;
    RETURN max_version + 1;
END;
$$;

CREATE FUNCTION public.prune_publisher_snapshots() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM publisher_snapshots WHERE id IN (
        SELECT id FROM publisher_snapshots
        WHERE publisher_id = NEW.publisher_id
        ORDER BY created_at DESC OFFSET 20
    );
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.prune_zman_versions() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM publisher_zman_versions
    WHERE publisher_zman_id = NEW.publisher_zman_id
    AND id NOT IN (
        SELECT id FROM publisher_zman_versions
        WHERE publisher_zman_id = NEW.publisher_zman_id
        ORDER BY version_number DESC LIMIT 7
    );
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_embeddings_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE FUNCTION public.update_geo_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE FUNCTION public.update_master_registry_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE FUNCTION public.update_publisher_zman_day_types_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE FUNCTION public.update_publisher_zman_events_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE FUNCTION public.update_publisher_zmanim_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ============================================================================
-- COORDINATE/ELEVATION PRIORITY RESOLUTION FUNCTIONS (geo-data-accuracy-enhancement)
-- ============================================================================

-- Get the best available coordinates for a city based on source priority from geo_data_sources table
CREATE OR REPLACE FUNCTION public.get_effective_geo_city_coordinates(p_city_id uuid, p_publisher_id uuid DEFAULT NULL)
RETURNS TABLE (
    latitude double precision,
    longitude double precision,
    source_id varchar(20),
    accuracy_m integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT cc.latitude, cc.longitude, cc.source_id, COALESCE(cc.accuracy_m, s.default_accuracy_m)
    FROM geo_city_coordinates cc
    JOIN geo_data_sources s ON s.id = cc.source_id
    WHERE cc.city_id = p_city_id
      AND s.is_active = true
      AND (
          -- Include publisher overrides only for the specified publisher
          (cc.source_id = 'publisher' AND cc.publisher_id = p_publisher_id)
          -- Include all non-publisher sources
          OR (cc.source_id != 'publisher')
      )
    ORDER BY
        s.priority,
        cc.verified_at DESC NULLS LAST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_effective_geo_city_coordinates IS 'Returns best available coordinates based on source priority from geo_data_sources table';

-- Get the best available elevation for a city based on source priority from geo_data_sources table
CREATE OR REPLACE FUNCTION public.get_effective_city_elevation(
    p_city_id uuid,
    p_coordinate_source_id varchar(20) DEFAULT NULL,
    p_publisher_id uuid DEFAULT NULL
)
RETURNS TABLE (
    elevation_m integer,
    source_id varchar(20),
    accuracy_m integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT ce.elevation_m, ce.source_id, COALESCE(ce.accuracy_m, s.default_accuracy_m)
    FROM geo_city_elevations ce
    JOIN geo_data_sources s ON s.id = ce.source_id
    WHERE ce.city_id = p_city_id
      AND s.is_active = true
      AND (p_coordinate_source_id IS NULL OR ce.coordinate_source_id = p_coordinate_source_id)
      AND (
          (ce.source_id = 'publisher' AND ce.publisher_id = p_publisher_id)
          OR (ce.source_id != 'publisher')
      )
    ORDER BY
        s.priority,
        ce.verified_at DESC NULLS LAST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_effective_city_elevation IS 'Returns best available elevation based on source priority from geo_data_sources table';

-- Update the effective coordinates/elevation for a city based on current sources
-- NOTE: This EXCLUDES publisher-specific overrides. The effective_* columns store
-- the best "global" coordinates that all publishers share as a baseline.
-- Publishers get their overrides via get_effective_geo_city_coordinates() at query time.
CREATE OR REPLACE FUNCTION public.update_effective_city_data(p_city_id uuid)
RETURNS void AS $$
DECLARE
    v_lat double precision;
    v_lng double precision;
    v_coord_source_id varchar(20);
    v_elev integer;
    v_elev_source_id varchar(20);
BEGIN
    -- Get best NON-PUBLISHER coordinates (community > simplemaps > wof)
    SELECT cc.latitude, cc.longitude, cc.source_id
    INTO v_lat, v_lng, v_coord_source_id
    FROM geo_city_coordinates cc
    JOIN geo_data_sources s ON s.id = cc.source_id
    WHERE cc.city_id = p_city_id
      AND s.is_active = true
      AND cc.source_id != 'publisher'  -- Exclude publisher overrides
    ORDER BY s.priority, cc.verified_at DESC NULLS LAST
    LIMIT 1;

    -- Get best NON-PUBLISHER elevation for the best coordinate source
    SELECT ce.elevation_m, ce.source_id
    INTO v_elev, v_elev_source_id
    FROM geo_city_elevations ce
    JOIN geo_data_sources s ON s.id = ce.source_id
    WHERE ce.city_id = p_city_id
      AND s.is_active = true
      AND ce.source_id != 'publisher'  -- Exclude publisher overrides
      AND (v_coord_source_id IS NULL OR ce.coordinate_source_id = v_coord_source_id)
    ORDER BY s.priority, ce.verified_at DESC NULLS LAST
    LIMIT 1;

    -- Update geo_cities latitude/longitude/elevation_m with best global (non-publisher) values
    -- Only update if we found a better source (don't overwrite with NULL)
    UPDATE geo_cities
    SET latitude = COALESCE(v_lat, latitude),
        longitude = COALESCE(v_lng, longitude),
        elevation_m = COALESCE(v_elev, elevation_m),
        coordinate_source = COALESCE(v_coord_source_id, coordinate_source),
        elevation_source = COALESCE(v_elev_source_id, elevation_source),
        updated_at = now()
    WHERE id = p_city_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_effective_city_data IS 'Updates geo_cities latitude/longitude/elevation_m from best non-publisher sources in geo_city_coordinates/geo_city_elevations';

-- Trigger function to update geo_cities.latitude/longitude when geo_city_coordinates change
CREATE OR REPLACE FUNCTION public.trg_update_effective_geo_city_coordinates()
RETURNS trigger AS $$
BEGIN
    -- Skip publisher overrides - they don't affect the global baseline
    IF NEW.source_id = 'publisher' THEN
        RETURN NEW;
    END IF;

    -- Update latitude/longitude on geo_cities from best source
    PERFORM update_effective_city_data(NEW.city_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update geo_cities.elevation_m when geo_city_elevations change
CREATE OR REPLACE FUNCTION public.trg_update_effective_city_elevation()
RETURNS trigger AS $$
BEGIN
    -- Skip publisher overrides - they don't affect the global baseline
    IF NEW.source_id = 'publisher' THEN
        RETURN NEW;
    END IF;

    -- Update elevation_m on geo_cities from best source
    PERFORM update_effective_city_data(NEW.city_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GEO HIERARCHY ASSIGNMENT FUNCTIONS
-- ============================================================================

CREATE FUNCTION public.assign_cities_to_countries() RETURNS TABLE(updated_count integer, unmatched_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_updated integer := 0;
    v_unmatched integer := 0;
BEGIN
    ALTER TABLE geo_cities DISABLE TRIGGER trg_validate_city_hierarchy;

    WITH matches AS (
        UPDATE geo_cities c
        SET country_id = cb.country_id,
            updated_at = now()
        FROM geo_country_boundaries cb
        WHERE ST_Contains(cb.boundary::geometry, c.location::geometry)
          AND c.country_id != cb.country_id
        RETURNING c.id
    )
    SELECT COUNT(*) INTO v_updated FROM matches;

    SELECT COUNT(*) INTO v_unmatched
    FROM geo_cities c
    WHERE NOT EXISTS (
        SELECT 1 FROM geo_country_boundaries cb
        WHERE ST_Contains(cb.boundary::geometry, c.location::geometry)
    );

    ALTER TABLE geo_cities ENABLE TRIGGER trg_validate_city_hierarchy;

    RETURN QUERY SELECT v_updated, v_unmatched;
END;
$$;

CREATE FUNCTION public.assign_cities_to_regions() RETURNS TABLE(updated_count integer, unmatched_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_updated integer := 0;
    v_unmatched integer := 0;
BEGIN
    ALTER TABLE geo_cities DISABLE TRIGGER trg_validate_city_hierarchy;

    WITH matches AS (
        UPDATE geo_cities c
        SET region_id = r.id,
            updated_at = now()
        FROM geo_region_boundaries rb
        JOIN geo_regions r ON rb.region_id = r.id
        WHERE ST_Contains(rb.boundary::geometry, c.location::geometry)
          AND r.country_id = c.country_id
          AND (c.region_id IS NULL OR c.region_id != r.id)
        RETURNING c.id
    )
    SELECT COUNT(*) INTO v_updated FROM matches;

    SELECT COUNT(*) INTO v_unmatched
    FROM geo_cities c
    JOIN geo_countries co ON c.country_id = co.id
    WHERE co.has_adm1 = true
      AND c.region_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM geo_region_boundaries rb
        JOIN geo_regions r ON rb.region_id = r.id
        WHERE ST_Contains(rb.boundary::geometry, c.location::geometry)
          AND r.country_id = c.country_id
    );

    ALTER TABLE geo_cities ENABLE TRIGGER trg_validate_city_hierarchy;

    RETURN QUERY SELECT v_updated, v_unmatched;
END;
$$;

CREATE FUNCTION public.assign_cities_to_districts() RETURNS TABLE(updated_count integer, unmatched_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_updated integer := 0;
    v_unmatched integer := 0;
BEGIN
    ALTER TABLE geo_cities DISABLE TRIGGER trg_validate_city_hierarchy;

    WITH matches AS (
        UPDATE geo_cities c
        SET district_id = d.id,
            updated_at = now()
        FROM geo_district_boundaries db
        JOIN geo_districts d ON db.district_id = d.id
        WHERE ST_Contains(db.boundary::geometry, c.location::geometry)
          AND d.region_id = c.region_id
          AND c.region_id IS NOT NULL
          AND (c.district_id IS NULL OR c.district_id != d.id)
        RETURNING c.id
    )
    SELECT COUNT(*) INTO v_updated FROM matches;

    SELECT COUNT(*) INTO v_unmatched
    FROM geo_cities c
    JOIN geo_countries co ON c.country_id = co.id
    WHERE co.has_adm2 = true
      AND c.region_id IS NOT NULL
      AND c.district_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM geo_district_boundaries db
        JOIN geo_districts d ON db.district_id = d.id
        WHERE ST_Contains(db.boundary::geometry, c.location::geometry)
          AND d.region_id = c.region_id
    );

    ALTER TABLE geo_cities ENABLE TRIGGER trg_validate_city_hierarchy;

    RETURN QUERY SELECT v_updated, v_unmatched;
END;
$$;

CREATE FUNCTION public.assign_all_city_hierarchy() RETURNS TABLE(level text, updated_count integer, unmatched_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_country_updated integer;
    v_country_unmatched integer;
    v_region_updated integer;
    v_region_unmatched integer;
    v_district_updated integer;
    v_district_unmatched integer;
BEGIN
    RAISE NOTICE 'Starting city hierarchy assignment via point-in-polygon...';

    RAISE NOTICE 'Step 1/3: Assigning cities to countries...';
    SELECT * INTO v_country_updated, v_country_unmatched FROM assign_cities_to_countries();
    RAISE NOTICE 'Countries: % updated, % unmatched', v_country_updated, v_country_unmatched;

    RAISE NOTICE 'Step 2/3: Assigning cities to regions...';
    SELECT * INTO v_region_updated, v_region_unmatched FROM assign_cities_to_regions();
    RAISE NOTICE 'Regions: % updated, % unmatched', v_region_updated, v_region_unmatched;

    RAISE NOTICE 'Step 3/3: Assigning cities to districts...';
    SELECT * INTO v_district_updated, v_district_unmatched FROM assign_cities_to_districts();
    RAISE NOTICE 'Districts: % updated, % unmatched', v_district_updated, v_district_unmatched;

    RAISE NOTICE 'City hierarchy assignment complete.';

    RETURN QUERY VALUES
        ('country'::text, v_country_updated, v_country_unmatched),
        ('region'::text, v_region_updated, v_region_unmatched),
        ('district'::text, v_district_updated, v_district_unmatched);
END;
$$;

COMMENT ON FUNCTION public.assign_all_city_hierarchy() IS 'Assigns all cities to countries/regions/districts based on point-in-polygon. Run after importing boundaries.';

CREATE FUNCTION public.get_publishers_for_city(p_city_id uuid) RETURNS TABLE(publisher_id uuid, publisher_name text, coverage_level text, priority integer, match_type text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_city RECORD;
BEGIN
    SELECT
        c.id,
        c.country_id,
        c.region_id,
        c.district_id,
        co.continent_id,
        cont.code as continent_code
    INTO v_city
    FROM geo_cities c
    JOIN geo_countries co ON c.country_id = co.id
    JOIN geo_continents cont ON co.continent_id = cont.id
    WHERE c.id = p_city_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT DISTINCT ON (pc.publisher_id)
        pc.publisher_id,
        p.name::TEXT as publisher_name,
        pc.coverage_level,
        pc.priority,
        CASE pc.coverage_level
            WHEN 'city' THEN 'exact_city'
            WHEN 'district' THEN 'district_match'
            WHEN 'region' THEN 'region_match'
            WHEN 'country' THEN 'country_match'
            WHEN 'continent' THEN 'continent_match'
        END as match_type
    FROM publisher_coverage pc
    JOIN publishers p ON p.id = pc.publisher_id
    WHERE pc.is_active = TRUE
      AND p.status = 'active'
      AND (
        (pc.coverage_level = 'city' AND pc.city_id = p_city_id)
        OR (pc.coverage_level = 'district' AND pc.district_id = v_city.district_id AND v_city.district_id IS NOT NULL)
        OR (pc.coverage_level = 'region' AND pc.region_id = v_city.region_id AND v_city.region_id IS NOT NULL)
        OR (pc.coverage_level = 'country' AND pc.country_id = v_city.country_id)
        OR (pc.coverage_level = 'continent' AND pc.continent_code = v_city.continent_code)
      )
    ORDER BY pc.publisher_id,
             CASE pc.coverage_level
                 WHEN 'city' THEN 1
                 WHEN 'district' THEN 2
                 WHEN 'region' THEN 3
                 WHEN 'country' THEN 4
                 WHEN 'continent' THEN 5
             END,
             pc.priority DESC;
END;
$$;

COMMENT ON FUNCTION public.get_publishers_for_city(p_city_id uuid) IS 'Find publishers serving a city based on geographic hierarchy (city > district > region > country > continent)';

-- ============================================================================
-- HIERARCHY VALIDATION FUNCTIONS
-- ============================================================================

CREATE FUNCTION public.validate_all_city_hierarchies() RETURNS TABLE(city_id bigint, city_name text, error_type text, details text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.name::text, 'country_continent_mismatch'::text,
           format('Country %s belongs to continent %s, not %s', c.country_id, gc.continent_id, c.continent_id)
    FROM geo_cities c
    JOIN geo_countries gc ON c.country_id = gc.id
    WHERE c.country_id IS NOT NULL AND gc.continent_id != c.continent_id;

    RETURN QUERY
    SELECT c.id, c.name::text, 'region_continent_mismatch'::text,
           format('Region %s belongs to continent %s, not %s', c.region_id, r.continent_id, c.continent_id)
    FROM geo_cities c
    JOIN geo_regions r ON c.region_id = r.id
    WHERE c.region_id IS NOT NULL AND r.continent_id != c.continent_id;

    RETURN QUERY
    SELECT c.id, c.name::text, 'region_country_mismatch'::text,
           format('Region %s has country %s, city has country %s', c.region_id, r.country_id, c.country_id)
    FROM geo_cities c
    JOIN geo_regions r ON c.region_id = r.id
    WHERE c.region_id IS NOT NULL
      AND r.country_id IS NOT NULL
      AND (c.country_id IS NULL OR c.country_id != r.country_id);

    RETURN QUERY
    SELECT c.id, c.name::text, 'district_continent_mismatch'::text,
           format('District %s belongs to continent %s, not %s', c.district_id, d.continent_id, c.continent_id)
    FROM geo_cities c
    JOIN geo_districts d ON c.district_id = d.id
    WHERE c.district_id IS NOT NULL AND d.continent_id != c.continent_id;

    RETURN QUERY
    SELECT c.id, c.name::text, 'district_region_mismatch'::text,
           format('District %s has region %s, city has region %s', c.district_id, d.region_id, c.region_id)
    FROM geo_cities c
    JOIN geo_districts d ON c.district_id = d.id
    WHERE c.district_id IS NOT NULL
      AND d.region_id IS NOT NULL
      AND (c.region_id IS NULL OR c.region_id != d.region_id);

    RETURN QUERY
    SELECT c.id, c.name::text, 'district_country_mismatch'::text,
           format('District %s has country %s, city has country %s', c.district_id, d.country_id, c.country_id)
    FROM geo_cities c
    JOIN geo_districts d ON c.district_id = d.id
    WHERE c.district_id IS NOT NULL
      AND d.country_id IS NOT NULL
      AND (c.country_id IS NULL OR c.country_id != d.country_id);
END;
$$;

CREATE FUNCTION public.validate_all_city_hierarchy() RETURNS TABLE(issue_type text, city_id uuid, city_name text, details text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        'region_mismatch'::text,
        c.id,
        c.name,
        format('Assigned to region %s (%s) but coordinates are in region %s (%s)',
               c.region_id, r1.name, r2.id, r2.name)
    FROM geo_cities c
    JOIN geo_regions r1 ON c.region_id = r1.id
    JOIN geo_region_boundaries rb ON ST_Contains(rb.boundary::geometry, c.location::geometry)
    JOIN geo_regions r2 ON rb.region_id = r2.id AND r2.country_id = c.country_id
    WHERE c.region_id != r2.id;

    RETURN QUERY
    SELECT
        'district_mismatch'::text,
        c.id,
        c.name,
        format('Assigned to district %s (%s) but coordinates are in district %s (%s)',
               c.district_id, d1.name, d2.id, d2.name)
    FROM geo_cities c
    JOIN geo_districts d1 ON c.district_id = d1.id
    JOIN geo_district_boundaries db ON ST_Contains(db.boundary::geometry, c.location::geometry)
    JOIN geo_districts d2 ON db.district_id = d2.id AND d2.region_id = c.region_id
    WHERE c.district_id != d2.id;

    RETURN QUERY
    SELECT
        'missing_region'::text,
        c.id,
        c.name,
        format('In country %s which has_adm1=true but no region assigned', co.name)
    FROM geo_cities c
    JOIN geo_countries co ON c.country_id = co.id
    WHERE co.has_adm1 = true
      AND c.region_id IS NULL;

    RETURN QUERY
    SELECT
        'missing_district'::text,
        c.id,
        c.name,
        format('In country %s which has_adm2=true but no district assigned', co.name)
    FROM geo_cities c
    JOIN geo_countries co ON c.country_id = co.id
    WHERE co.has_adm2 = true
      AND c.region_id IS NOT NULL
      AND c.district_id IS NULL;
END;
$$;

COMMENT ON FUNCTION public.validate_all_city_hierarchy() IS 'Validates that all city hierarchy assignments match point-in-polygon results';

CREATE FUNCTION public.validate_all_district_hierarchies() RETURNS TABLE(district_id integer, district_name text, error_type text, details text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.name::text, 'country_continent_mismatch'::text,
           format('Country %s belongs to continent %s, not %s', d.country_id, c.continent_id, d.continent_id)
    FROM geo_districts d
    JOIN geo_countries c ON d.country_id = c.id
    WHERE d.country_id IS NOT NULL AND c.continent_id != d.continent_id;

    RETURN QUERY
    SELECT d.id, d.name::text, 'region_continent_mismatch'::text,
           format('Region %s belongs to continent %s, not %s', d.region_id, r.continent_id, d.continent_id)
    FROM geo_districts d
    JOIN geo_regions r ON d.region_id = r.id
    WHERE d.region_id IS NOT NULL AND r.continent_id != d.continent_id;

    RETURN QUERY
    SELECT d.id, d.name::text, 'region_country_mismatch'::text,
           format('Region %s has country %s, district has country %s', d.region_id, r.country_id, d.country_id)
    FROM geo_districts d
    JOIN geo_regions r ON d.region_id = r.id
    WHERE d.region_id IS NOT NULL
      AND r.country_id IS NOT NULL
      AND (d.country_id IS NULL OR d.country_id != r.country_id);
END;
$$;

CREATE FUNCTION public.validate_all_region_hierarchies() RETURNS TABLE(region_id integer, region_name text, error_type text, details text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.name::text, 'country_continent_mismatch'::text,
           format('Country %s belongs to continent %s, not %s', r.country_id, c.continent_id, r.continent_id)
    FROM geo_regions r
    JOIN geo_countries c ON r.country_id = c.id
    WHERE r.country_id IS NOT NULL AND c.continent_id != r.continent_id;
END;
$$;

-- ============================================================================
-- LANGUAGES TABLE (for multi-language name support)
-- ============================================================================

CREATE TABLE public.languages (
    code varchar(3) NOT NULL,
    name text NOT NULL,
    native_name text,
    script varchar(4),
    direction varchar(3) DEFAULT 'ltr',
    is_active boolean DEFAULT true
);
COMMENT ON TABLE public.languages IS 'ISO 639-3 language codes for multi-language name support';

-- ============================================================================
-- GEOGRAPHIC TABLES (Level 0-3)
-- ============================================================================

CREATE TABLE public.geo_continents (
    id smallint NOT NULL,
    code varchar(2) NOT NULL,
    name text NOT NULL,
    wof_id bigint
);
COMMENT ON TABLE public.geo_continents IS 'Level 0: 7 continents with ISO codes';

CREATE SEQUENCE public.geo_continents_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER TABLE public.geo_continents ALTER COLUMN id SET DEFAULT nextval('public.geo_continents_id_seq'::regclass);

CREATE TABLE public.geo_countries (
    id smallint NOT NULL GENERATED ALWAYS AS IDENTITY,
    code varchar(2) NOT NULL,
    code_iso3 varchar(3),
    name text NOT NULL,
    continent_id smallint NOT NULL,
    adm1_label text DEFAULT 'Region',
    adm2_label text DEFAULT 'District',
    has_adm1 boolean DEFAULT true,
    has_adm2 boolean DEFAULT false,
    is_city_state boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    wof_id bigint
);
COMMENT ON TABLE public.geo_countries IS 'Level 1 (ADM0): Countries with ISO 3166-1 codes';

CREATE TABLE public.geo_regions (
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY,
    country_id smallint,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    wof_id bigint,
    continent_id smallint NOT NULL
);
COMMENT ON TABLE public.geo_regions IS 'Level 2 (ADM1): States, provinces, regions';

CREATE TABLE public.geo_districts (
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY,
    region_id integer,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    wof_id bigint,
    continent_id smallint NOT NULL,
    country_id smallint
);
COMMENT ON TABLE public.geo_districts IS 'Level 3 (ADM2): Counties, boroughs, districts';

CREATE TABLE public.geo_cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_id integer,
    district_id integer,
    name text NOT NULL,
    name_ascii text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    location geography(Point,4326) GENERATED ALWAYS AS ((st_setsrid(st_makepoint(longitude, latitude), 4326))::geography) STORED,
    timezone text NOT NULL,
    elevation_m integer DEFAULT 0,
    population integer,
    geonameid integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    wof_id bigint,
    continent_id smallint,
    country_id integer,
    -- Multi-source coordinate/elevation support (Phase 1 geo-data-accuracy-enhancement)
    -- latitude/longitude are updated by trigger to best non-publisher source
    -- Original WOF coordinates are stored in geo_city_coordinates table with source='wof'
    coordinate_source varchar(20) DEFAULT 'wof',
    elevation_source varchar(20)
);
COMMENT ON TABLE public.geo_cities IS 'Level 4: Cities with coordinates for zmanim calculations';
COMMENT ON COLUMN public.geo_cities.latitude IS 'Best available latitude (auto-updated by trigger from geo_city_coordinates, excludes publisher overrides)';
COMMENT ON COLUMN public.geo_cities.longitude IS 'Best available longitude (auto-updated by trigger from geo_city_coordinates, excludes publisher overrides)';
COMMENT ON COLUMN public.geo_cities.elevation_m IS 'Best available elevation (auto-updated by trigger from geo_city_elevations, excludes publisher overrides)';
COMMENT ON COLUMN public.geo_cities.coordinate_source IS 'Source of latitude/longitude: community, simplemaps, wof (not publisher)';
COMMENT ON COLUMN public.geo_cities.elevation_source IS 'Source of elevation_m: community, glo90 (not publisher)';

-- ============================================================================
-- GEO NAMES TABLE (multi-language support)
-- ============================================================================

CREATE TABLE public.geo_names (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
    entity_type varchar(20) NOT NULL,
    entity_id text NOT NULL,
    language_code varchar(3) NOT NULL,
    name text NOT NULL,
    is_preferred boolean DEFAULT true,
    source varchar(20) DEFAULT 'wof',
    created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.geo_names IS 'Multi-language names for geographic entities';
COMMENT ON COLUMN public.geo_names.entity_type IS 'continent, country, region, district, city';
COMMENT ON COLUMN public.geo_names.entity_id IS 'ID of the entity (text to support both integer and uuid)';
COMMENT ON COLUMN public.geo_names.is_preferred IS 'True if this is the preferred name for this language';

-- Boundary tables
CREATE TABLE public.geo_country_boundaries (
    country_id smallint NOT NULL,
    boundary geography(MultiPolygon,4326) NOT NULL,
    boundary_simplified geography(MultiPolygon,4326),
    area_km2 double precision,
    centroid geography(Point,4326),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.geo_region_boundaries (
    region_id integer NOT NULL,
    boundary geography(MultiPolygon,4326) NOT NULL,
    boundary_simplified geography(MultiPolygon,4326),
    area_km2 double precision,
    centroid geography(Point,4326),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.geo_district_boundaries (
    district_id integer NOT NULL,
    boundary geography(MultiPolygon,4326) NOT NULL,
    boundary_simplified geography(MultiPolygon,4326),
    area_km2 double precision,
    centroid geography(Point,4326),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.geo_city_boundaries (
    city_id uuid NOT NULL,
    boundary geography(MultiPolygon,4326) NOT NULL,
    boundary_simplified geography(MultiPolygon,4326),
    area_km2 double precision,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.geo_city_boundaries IS 'City/locality boundaries from WOF';

CREATE TABLE public.geo_boundary_imports (
    id integer NOT NULL,
    source text NOT NULL,
    level text NOT NULL,
    country_code varchar(2),
    version text,
    records_imported integer DEFAULT 0,
    records_matched integer DEFAULT 0,
    records_unmatched integer DEFAULT 0,
    imported_at timestamptz DEFAULT now(),
    notes text
);
CREATE SEQUENCE public.geo_boundary_imports_id_seq AS integer START WITH 1;
ALTER TABLE public.geo_boundary_imports ALTER COLUMN id SET DEFAULT nextval('public.geo_boundary_imports_id_seq'::regclass);
ALTER SEQUENCE public.geo_boundary_imports_id_seq OWNED BY public.geo_boundary_imports.id;

CREATE TABLE public.geo_name_mappings (
    id integer NOT NULL,
    level text NOT NULL CHECK (level IN ('country', 'region', 'district', 'city')),
    source text NOT NULL,
    source_name text NOT NULL,
    source_country_code varchar(2),
    target_id integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    notes text
);
CREATE SEQUENCE public.geo_name_mappings_id_seq AS integer START WITH 1;
ALTER TABLE public.geo_name_mappings ALTER COLUMN id SET DEFAULT nextval('public.geo_name_mappings_id_seq'::regclass);
ALTER SEQUENCE public.geo_name_mappings_id_seq OWNED BY public.geo_name_mappings.id;

-- ============================================================================
-- MULTI-SOURCE COORDINATE/ELEVATION TABLES (geo-data-accuracy-enhancement)
-- ============================================================================

-- geo_data_sources: Lookup table for coordinate and elevation data sources
CREATE TABLE public.geo_data_sources (
    id varchar(20) PRIMARY KEY,
    name text NOT NULL,
    description text,
    data_type varchar(20) NOT NULL CHECK (data_type IN ('coordinates', 'elevation', 'both')),
    priority smallint NOT NULL, -- Lower = higher priority (1 = highest)
    default_accuracy_m integer, -- Default accuracy estimate in meters
    attribution text, -- Required attribution text
    url text, -- Source URL
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.geo_data_sources IS 'Lookup table for geographic data sources with priority and metadata';

-- geo_city_coordinates: Multiple coordinate sources per city with priority system
CREATE TABLE public.geo_city_coordinates (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id uuid NOT NULL, -- FK added later (geo_cities PK not yet defined)
    source_id varchar(20) NOT NULL REFERENCES geo_data_sources(id),
    external_id text, -- External ID from source (e.g., simplemaps id, wof_id)
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy_m integer, -- Estimated accuracy in meters (NULL = use source default)

    -- For publisher/community sources
    submitted_by text, -- clerk_user_id or publisher_id
    publisher_id uuid, -- FK added later (publishers table not yet defined)
    verified_at timestamptz,
    verified_by text,

    -- Metadata
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.geo_city_coordinates IS 'Multiple coordinate sources per city with priority system';
COMMENT ON COLUMN public.geo_city_coordinates.accuracy_m IS 'Estimated accuracy in meters. If NULL, use geo_data_sources.default_accuracy_m';

-- Unique constraint: one coordinate per city/source/publisher combination
-- Uses COALESCE to treat NULL publisher_id as a single value for non-publisher sources
CREATE UNIQUE INDEX idx_geo_city_coordinates_unique ON geo_city_coordinates(city_id, source_id, COALESCE(publisher_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Primary lookup: get best coordinates for a city (covers get_effective_geo_city_coordinates query)
-- Covering index includes all columns needed so query is index-only scan
CREATE INDEX idx_geo_city_coordinates_priority_lookup ON geo_city_coordinates(city_id, source_id)
    INCLUDE (latitude, longitude, accuracy_m, publisher_id, verified_at);

-- Publisher override lookups (for publisher-specific coordinates)
CREATE INDEX idx_geo_city_coordinates_publisher_override ON geo_city_coordinates(city_id, publisher_id)
    WHERE source_id = 'publisher';

-- Admin: list all coordinates by source type
CREATE INDEX idx_geo_city_coordinates_source ON geo_city_coordinates(source_id);

-- geo_city_elevations: Multiple elevation sources per coordinate
CREATE TABLE public.geo_city_elevations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id uuid NOT NULL, -- FK added later (geo_cities PK not yet defined)
    coordinate_source_id varchar(20) NOT NULL REFERENCES geo_data_sources(id), -- Which coordinate set this elevation is for
    source_id varchar(20) NOT NULL REFERENCES geo_data_sources(id),

    elevation_m integer NOT NULL,
    accuracy_m integer, -- Estimated accuracy (NULL = use source default)

    -- For publisher/community sources
    submitted_by text,
    publisher_id uuid, -- FK added later (publishers table not yet defined)
    verified_at timestamptz,
    verified_by text,

    -- Metadata
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.geo_city_elevations IS 'Elevation data from multiple sources linked to coordinate sources';
COMMENT ON COLUMN public.geo_city_elevations.coordinate_source_id IS 'Which coordinate source this elevation was looked up for';

-- Unique constraint: one elevation per city/coordinate_source/source/publisher combination
CREATE UNIQUE INDEX idx_geo_city_elevations_unique ON geo_city_elevations(city_id, coordinate_source_id, source_id, COALESCE(publisher_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Primary lookup: get best elevation for a city+coordinate_source (covers get_effective_city_elevation query)
-- Covering index includes all columns needed so query is index-only scan
CREATE INDEX idx_geo_city_elevations_priority_lookup ON geo_city_elevations(city_id, coordinate_source_id, source_id)
    INCLUDE (elevation_m, accuracy_m, publisher_id, verified_at);

-- Publisher override lookups (for publisher-specific elevations)
CREATE INDEX idx_geo_city_elevations_publisher_override ON geo_city_elevations(city_id, publisher_id)
    WHERE source_id = 'publisher';

-- Admin: list all elevations by source type
CREATE INDEX idx_geo_city_elevations_source ON geo_city_elevations(source_id);

-- geo_data_imports: Audit log of geographic data imports
CREATE TABLE public.geo_data_imports (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source varchar(20) NOT NULL, -- 'wof', 'simplemaps', 'glo90'
    import_type varchar(20) NOT NULL, -- 'coordinates', 'elevation', 'hierarchy', 'full'
    version text,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    records_processed integer DEFAULT 0,
    records_imported integer DEFAULT 0,
    records_updated integer DEFAULT 0,
    records_skipped integer DEFAULT 0,
    errors text[],
    notes text
);

COMMENT ON TABLE public.geo_data_imports IS 'Audit log of geographic data imports';

-- Index for listing recent imports
CREATE INDEX idx_geo_data_imports_source_started ON geo_data_imports(source, started_at DESC);

-- ============================================================================
-- CORE DOMAIN TABLES
-- ============================================================================

CREATE TABLE public.publishers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    website text,
    description text,
    logo_url text,
    location geography(Point,4326),
    latitude double precision,
    longitude double precision,
    timezone text,
    status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'active', 'suspended')),
    verification_token text,
    verified_at timestamptz,
    clerk_user_id text,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    bio text,
    slug text,
    is_verified boolean DEFAULT false NOT NULL,
    logo_data text,
    is_certified boolean DEFAULT false NOT NULL,
    suspension_reason text,
    deleted_at timestamptz,
    deleted_by text
);
COMMENT ON TABLE public.publishers IS 'Publishers who provide zmanim calculations';

CREATE TABLE public.algorithms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    configuration jsonb,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'deprecated')),
    is_public boolean DEFAULT false,
    forked_from uuid,
    attribution_text text,
    fork_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.algorithm_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_key text NOT NULL,
    name text NOT NULL,
    description text,
    configuration jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.day_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name varchar(100) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    parent_type varchar(100),
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.day_types IS 'DEPRECATED: Use jewish_events instead';

CREATE TABLE public.jewish_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code varchar(50) NOT NULL,
    name_hebrew text NOT NULL,
    name_english text NOT NULL,
    event_type varchar(30) NOT NULL CHECK (event_type IN ('weekly', 'yom_tov', 'fast', 'informational')),
    duration_days_israel integer DEFAULT 1,
    duration_days_diaspora integer DEFAULT 1,
    fast_start_type varchar(20) CHECK (fast_start_type IS NULL OR fast_start_type IN ('dawn', 'sunset')),
    parent_event_code varchar(50),
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.zman_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tag_key varchar(50) NOT NULL,
    name varchar(100) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    tag_type varchar(50) NOT NULL CHECK (tag_type IN ('event', 'timing', 'behavior', 'shita', 'calculation', 'category', 'jewish_day')),
    description text,
    color varchar(7),
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.tag_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key varchar(50) NOT NULL,
    display_name_hebrew varchar(100) NOT NULL,
    display_name_english varchar(100) NOT NULL,
    color varchar(255),
    sort_order integer NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.tag_event_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tag_id uuid NOT NULL,
    hebcal_event_pattern varchar(100),
    hebrew_month integer,
    hebrew_day_start integer,
    hebrew_day_end integer,
    priority integer DEFAULT 100,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT valid_mapping CHECK (hebcal_event_pattern IS NOT NULL OR (hebrew_month IS NOT NULL AND hebrew_day_start IS NOT NULL))
);

CREATE TABLE public.time_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key varchar(50) NOT NULL,
    display_name_hebrew varchar(100) NOT NULL,
    display_name_english varchar(100) NOT NULL,
    description varchar(255),
    icon_name varchar(50),
    color varchar(50),
    sort_order integer NOT NULL,
    is_everyday boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.display_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key varchar(50) NOT NULL,
    display_name_hebrew varchar(100) NOT NULL,
    display_name_english varchar(100) NOT NULL,
    description varchar(255),
    icon_name varchar(50),
    color varchar(50),
    sort_order integer NOT NULL,
    time_categories text[] NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.event_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key varchar(50) NOT NULL,
    display_name_hebrew varchar(100) NOT NULL,
    display_name_english varchar(100) NOT NULL,
    description varchar(255),
    icon_name varchar(50),
    color varchar(50),
    sort_order integer NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- MASTER ZMANIM REGISTRY
-- ============================================================================

CREATE TABLE public.master_zmanim_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zman_key varchar(100) NOT NULL,
    canonical_hebrew_name text NOT NULL,
    canonical_english_name text NOT NULL,
    transliteration text,
    description text,
    halachic_source text,
    halachic_notes text,
    time_category varchar(50),
    default_formula_dsl text,
    is_hidden boolean DEFAULT false NOT NULL,
    is_core boolean DEFAULT false,
    aliases text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.astronomical_primitives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variable_name varchar(50) NOT NULL,
    display_name text NOT NULL,
    description text,
    formula_dsl text NOT NULL,
    category varchar(50) NOT NULL,
    calculation_type varchar(20) NOT NULL CHECK (calculation_type IN ('horizon', 'solar_angle', 'transit', 'fixed_minutes')),
    solar_angle numeric(5,2),
    is_dawn boolean,
    edge_type varchar(20) CHECK (edge_type IS NULL OR edge_type IN ('center', 'top_edge', 'bottom_edge')),
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.master_zman_day_types (
    master_zman_id uuid NOT NULL,
    day_type_id uuid NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.master_zman_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    master_zman_id uuid NOT NULL,
    jewish_event_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    override_hebrew_name text,
    override_english_name text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.master_zman_tags (
    master_zman_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    is_negated boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.zman_display_contexts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    master_zman_id uuid NOT NULL,
    context_code varchar(50) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- PUBLISHER ZMANIM
-- ============================================================================

CREATE TABLE public.publisher_zmanim (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_id uuid NOT NULL,
    zman_key varchar(100) NOT NULL,
    hebrew_name text NOT NULL,
    english_name text DEFAULT '' NOT NULL,
    transliteration text,
    description text,
    formula_dsl text DEFAULT '' NOT NULL,
    ai_explanation text,
    publisher_comment text,
    master_zman_id uuid,
    halachic_notes text,
    is_enabled boolean DEFAULT true NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    is_beta boolean DEFAULT false NOT NULL,
    is_custom boolean DEFAULT false NOT NULL,
    category text DEFAULT 'essential' NOT NULL,
    aliases text[] DEFAULT '{}',
    dependencies text[] DEFAULT '{}',
    linked_publisher_zman_id uuid,
    current_version integer DEFAULT 1,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    deleted_by text,
    certified_at timestamptz,
    source_type varchar(20) DEFAULT 'custom' NOT NULL CHECK (source_type IN ('custom', 'registry', 'linked')),
    display_name_hebrew text,
    display_name_english text
);

CREATE TABLE public.publisher_zman_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_zman_id uuid NOT NULL,
    publisher_id uuid NOT NULL,
    alias_hebrew text NOT NULL,
    alias_english text,
    alias_transliteration text,
    context varchar(100),
    is_primary boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.publisher_zman_day_types (
    publisher_zman_id uuid NOT NULL,
    day_type_id uuid NOT NULL,
    override_formula_dsl text,
    override_hebrew_name text,
    override_english_name text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.publisher_zman_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_zman_id uuid NOT NULL,
    jewish_event_id uuid NOT NULL,
    override_formula_dsl text,
    override_hebrew_name text,
    override_english_name text,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.publisher_zman_tags (
    publisher_zman_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    is_negated boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.publisher_zman_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_zman_id uuid NOT NULL,
    version_number integer NOT NULL,
    hebrew_name text NOT NULL,
    english_name text,
    formula_dsl text,
    halachic_notes text,
    created_by text,
    change_reason text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.publisher_coverage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_id uuid NOT NULL,
    coverage_level text NOT NULL CHECK (coverage_level IN ('city', 'district', 'region', 'country', 'continent')),
    city_id uuid,
    district_id integer,
    region_id integer,
    country_id smallint,
    continent_code varchar(2),
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.publisher_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_id uuid NOT NULL,
    description text,
    snapshot_data jsonb NOT NULL,
    created_by text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.publisher_onboarding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_id uuid NOT NULL,
    profile_complete boolean DEFAULT false,
    algorithm_selected boolean DEFAULT false,
    zmanim_configured boolean DEFAULT false,
    coverage_set boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.publisher_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'editor' NOT NULL CHECK (role IN ('editor', 'admin')),
    token text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.publisher_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    organization text,
    message text,
    status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by text,
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- ZMAN REGISTRY REQUESTS
-- ============================================================================

CREATE TABLE public.zman_registry_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_id uuid NOT NULL,
    requested_key varchar(100) NOT NULL,
    requested_hebrew_name text NOT NULL,
    requested_english_name text NOT NULL,
    requested_formula_dsl text,
    time_category varchar(50) NOT NULL,
    status varchar(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by varchar(255),
    reviewed_at timestamptz,
    reviewer_notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    transliteration text,
    description text,
    halachic_notes text,
    halachic_source text,
    publisher_email text,
    publisher_name text,
    auto_add_on_approval boolean DEFAULT true
);

CREATE TABLE public.zman_request_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    tag_id uuid,
    requested_tag_name text,
    requested_tag_type text CHECK (requested_tag_type IS NULL OR requested_tag_type IN ('event', 'timing', 'behavior', 'shita', 'method')),
    is_new_tag_request boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT tag_reference_check CHECK (
        (tag_id IS NOT NULL AND requested_tag_name IS NULL AND is_new_tag_request = false) OR
        (tag_id IS NULL AND requested_tag_name IS NOT NULL AND is_new_tag_request = true)
    )
);

-- ============================================================================
-- SUPPORT TABLES
-- ============================================================================

CREATE TABLE public.zmanim_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zman_key text NOT NULL,
    hebrew_name text NOT NULL,
    english_name text NOT NULL,
    formula_dsl text NOT NULL,
    category text NOT NULL CHECK (category IN ('essential', 'optional')),
    description text,
    is_required boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.system_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- AI/EMBEDDINGS TABLES
-- ============================================================================

CREATE TABLE public.embeddings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    content_type varchar(50) NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.ai_index_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    total_chunks integer DEFAULT 0 NOT NULL,
    last_indexed_at timestamptz,
    status varchar(20) DEFAULT 'pending' NOT NULL,
    error_message text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    publisher_id uuid,
    user_id text,
    request_type varchar(50) NOT NULL,
    input_text text,
    output_text text,
    tokens_used integer DEFAULT 0,
    model varchar(100),
    confidence numeric(3,3),
    success boolean DEFAULT true,
    error_message text,
    duration_ms integer,
    rag_context_used boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.explanation_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    formula_hash varchar(32) NOT NULL,
    language varchar(10) DEFAULT 'mixed' NOT NULL,
    explanation text NOT NULL,
    source varchar(20) DEFAULT 'ai' NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    expires_at timestamptz NOT NULL
);

-- ============================================================================
-- VALIDATION FUNCTIONS FOR GEO HIERARCHY
-- ============================================================================

CREATE FUNCTION public.validate_city_hierarchy() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    v_district_region_id integer;
    v_district_country_id smallint;
    v_district_continent_id smallint;
    v_region_country_id smallint;
    v_region_continent_id smallint;
    v_country_continent_id smallint;
BEGIN
    -- Continent is mandatory
    IF NEW.continent_id IS NULL THEN
        RAISE EXCEPTION 'City must have continent_id';
    END IF;

    -- If district is set, validate it matches other set fields
    IF NEW.district_id IS NOT NULL THEN
        SELECT region_id, country_id, continent_id
        INTO v_district_region_id, v_district_country_id, v_district_continent_id
        FROM geo_districts WHERE id = NEW.district_id;

        IF NEW.region_id IS NOT NULL AND v_district_region_id IS NOT NULL AND NEW.region_id != v_district_region_id THEN
            RAISE EXCEPTION 'City region_id does not match district region_id';
        END IF;
        IF NEW.country_id IS NOT NULL AND v_district_country_id IS NOT NULL AND NEW.country_id != v_district_country_id THEN
            RAISE EXCEPTION 'City country_id does not match district country_id';
        END IF;
        IF v_district_continent_id IS NOT NULL AND NEW.continent_id != v_district_continent_id THEN
            RAISE EXCEPTION 'City continent_id does not match district continent_id';
        END IF;
    END IF;

    -- If region is set, validate it matches other set fields
    IF NEW.region_id IS NOT NULL THEN
        SELECT country_id, continent_id
        INTO v_region_country_id, v_region_continent_id
        FROM geo_regions WHERE id = NEW.region_id;

        IF NEW.country_id IS NOT NULL AND v_region_country_id IS NOT NULL AND NEW.country_id != v_region_country_id THEN
            RAISE EXCEPTION 'City country_id does not match region country_id';
        END IF;
        IF v_region_continent_id IS NOT NULL AND NEW.continent_id != v_region_continent_id THEN
            RAISE EXCEPTION 'City continent_id does not match region continent_id';
        END IF;
    END IF;

    -- If country is set, validate continent matches
    IF NEW.country_id IS NOT NULL THEN
        SELECT continent_id INTO v_country_continent_id
        FROM geo_countries WHERE id = NEW.country_id;

        IF v_country_continent_id IS NOT NULL AND NEW.continent_id != v_country_continent_id THEN
            RAISE EXCEPTION 'City continent_id does not match country continent_id';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION public.validate_district_hierarchy() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    v_region_country_id smallint;
    v_region_continent_id smallint;
    v_country_continent_id smallint;
BEGIN
    -- Continent is mandatory
    IF NEW.continent_id IS NULL THEN
        RAISE EXCEPTION 'District must have continent_id';
    END IF;

    -- If region is set, validate it matches other set fields
    IF NEW.region_id IS NOT NULL THEN
        SELECT country_id, continent_id
        INTO v_region_country_id, v_region_continent_id
        FROM geo_regions WHERE id = NEW.region_id;

        IF NEW.country_id IS NOT NULL AND v_region_country_id IS NOT NULL AND NEW.country_id != v_region_country_id THEN
            RAISE EXCEPTION 'District country_id does not match region country_id';
        END IF;
        IF v_region_continent_id IS NOT NULL AND NEW.continent_id != v_region_continent_id THEN
            RAISE EXCEPTION 'District continent_id does not match region continent_id';
        END IF;
    END IF;

    -- If country is set, validate continent matches
    IF NEW.country_id IS NOT NULL THEN
        SELECT continent_id INTO v_country_continent_id
        FROM geo_countries WHERE id = NEW.country_id;

        IF v_country_continent_id IS NOT NULL AND NEW.continent_id != v_country_continent_id THEN
            RAISE EXCEPTION 'District continent_id does not match country continent_id';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION public.validate_region_hierarchy() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    v_country_continent_id smallint;
BEGIN
    -- Continent is mandatory
    IF NEW.continent_id IS NULL THEN
        RAISE EXCEPTION 'Region must have continent_id';
    END IF;

    -- If country is set, validate continent matches
    IF NEW.country_id IS NOT NULL THEN
        SELECT continent_id INTO v_country_continent_id
        FROM geo_countries WHERE id = NEW.country_id;

        IF v_country_continent_id IS NOT NULL AND NEW.continent_id != v_country_continent_id THEN
            RAISE EXCEPTION 'Region continent_id does not match country continent_id';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================================
-- PRIMARY KEYS
-- ============================================================================

ALTER TABLE ONLY public.ai_audit_logs ADD CONSTRAINT ai_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ai_index_status ADD CONSTRAINT ai_index_status_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ai_index_status ADD CONSTRAINT ai_index_status_source_key UNIQUE (source);
ALTER TABLE ONLY public.algorithm_templates ADD CONSTRAINT algorithm_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.algorithm_templates ADD CONSTRAINT algorithm_templates_template_key_key UNIQUE (template_key);
ALTER TABLE ONLY public.algorithms ADD CONSTRAINT algorithms_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.astronomical_primitives ADD CONSTRAINT astronomical_primitives_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.astronomical_primitives ADD CONSTRAINT astronomical_primitives_variable_name_key UNIQUE (variable_name);
ALTER TABLE ONLY public.geo_cities ADD CONSTRAINT geo_cities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.geo_cities ADD CONSTRAINT geo_cities_geonameid_key UNIQUE (geonameid);
ALTER TABLE ONLY public.geo_cities ADD CONSTRAINT geo_cities_wof_id_key UNIQUE (wof_id);
ALTER TABLE ONLY public.day_types ADD CONSTRAINT day_types_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.day_types ADD CONSTRAINT day_types_name_key UNIQUE (name);
ALTER TABLE ONLY public.display_groups ADD CONSTRAINT display_groups_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.embeddings ADD CONSTRAINT embeddings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.embeddings ADD CONSTRAINT embeddings_source_chunk_index_key UNIQUE (source, chunk_index);
ALTER TABLE ONLY public.event_categories ADD CONSTRAINT event_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.event_categories ADD CONSTRAINT event_categories_key_key UNIQUE (key);
ALTER TABLE ONLY public.explanation_cache ADD CONSTRAINT explanation_cache_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.geo_boundary_imports ADD CONSTRAINT geo_boundary_imports_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.geo_boundary_imports ADD CONSTRAINT geo_boundary_imports_source_level_key UNIQUE (source, level, country_code);
ALTER TABLE ONLY public.geo_continents ADD CONSTRAINT geo_continents_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.geo_continents ADD CONSTRAINT geo_continents_code_key UNIQUE (code);
ALTER TABLE ONLY public.geo_continents ADD CONSTRAINT geo_continents_wof_id_key UNIQUE (wof_id);
ALTER TABLE ONLY public.geo_countries ADD CONSTRAINT geo_countries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.geo_countries ADD CONSTRAINT geo_countries_code_key UNIQUE (code);
ALTER TABLE ONLY public.geo_names ADD CONSTRAINT geo_names_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.geo_names ADD CONSTRAINT geo_names_unique UNIQUE (entity_type, entity_id, language_code);
ALTER TABLE ONLY public.geo_country_boundaries ADD CONSTRAINT geo_country_boundaries_pkey PRIMARY KEY (country_id);
ALTER TABLE ONLY public.geo_district_boundaries ADD CONSTRAINT geo_district_boundaries_pkey PRIMARY KEY (district_id);
ALTER TABLE ONLY public.geo_city_boundaries ADD CONSTRAINT geo_city_boundaries_pkey PRIMARY KEY (city_id);
ALTER TABLE ONLY public.geo_districts ADD CONSTRAINT geo_districts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.geo_districts ADD CONSTRAINT geo_districts_region_id_code_key UNIQUE (region_id, code);
ALTER TABLE ONLY public.geo_districts ADD CONSTRAINT geo_districts_wof_id_key UNIQUE (wof_id);
ALTER TABLE ONLY public.geo_name_mappings ADD CONSTRAINT geo_name_mappings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.geo_name_mappings ADD CONSTRAINT geo_name_mappings_level_source_key UNIQUE (level, source, source_name, source_country_code);
ALTER TABLE ONLY public.geo_region_boundaries ADD CONSTRAINT geo_region_boundaries_pkey PRIMARY KEY (region_id);
ALTER TABLE ONLY public.geo_regions ADD CONSTRAINT geo_regions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.geo_regions ADD CONSTRAINT geo_regions_country_id_code_key UNIQUE (country_id, code);
ALTER TABLE ONLY public.geo_regions ADD CONSTRAINT geo_regions_wof_id_key UNIQUE (wof_id);
ALTER TABLE ONLY public.jewish_events ADD CONSTRAINT jewish_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.jewish_events ADD CONSTRAINT jewish_events_code_key UNIQUE (code);
ALTER TABLE ONLY public.languages ADD CONSTRAINT languages_pkey PRIMARY KEY (code);
ALTER TABLE ONLY public.master_zman_day_types ADD CONSTRAINT master_zman_day_types_pkey PRIMARY KEY (master_zman_id, day_type_id);
ALTER TABLE ONLY public.master_zman_events ADD CONSTRAINT master_zman_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.master_zman_events ADD CONSTRAINT master_zman_events_unique UNIQUE (master_zman_id, jewish_event_id);
ALTER TABLE ONLY public.master_zman_tags ADD CONSTRAINT master_zman_tags_pkey PRIMARY KEY (master_zman_id, tag_id);
ALTER TABLE ONLY public.master_zmanim_registry ADD CONSTRAINT master_zmanim_registry_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.master_zmanim_registry ADD CONSTRAINT master_zmanim_registry_zman_key_key UNIQUE (zman_key);
ALTER TABLE ONLY public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_coverage ADD CONSTRAINT publisher_coverage_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_invitations ADD CONSTRAINT publisher_invitations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_invitations ADD CONSTRAINT publisher_invitations_token_key UNIQUE (token);
ALTER TABLE ONLY public.publisher_onboarding ADD CONSTRAINT publisher_onboarding_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_onboarding ADD CONSTRAINT publisher_onboarding_publisher_id_key UNIQUE (publisher_id);
ALTER TABLE ONLY public.publisher_requests ADD CONSTRAINT publisher_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_snapshots ADD CONSTRAINT publisher_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_zman_aliases ADD CONSTRAINT publisher_zman_aliases_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_zman_aliases ADD CONSTRAINT publisher_zman_aliases_unique UNIQUE (publisher_id, alias_hebrew);
ALTER TABLE ONLY public.publisher_zman_day_types ADD CONSTRAINT publisher_zman_day_types_pkey PRIMARY KEY (publisher_zman_id, day_type_id);
ALTER TABLE ONLY public.publisher_zman_events ADD CONSTRAINT publisher_zman_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_zman_events ADD CONSTRAINT publisher_zman_events_unique UNIQUE (publisher_zman_id, jewish_event_id);
ALTER TABLE ONLY public.publisher_zman_tags ADD CONSTRAINT publisher_zman_tags_pkey PRIMARY KEY (publisher_zman_id, tag_id);
ALTER TABLE ONLY public.publisher_zman_versions ADD CONSTRAINT publisher_zman_versions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_zman_versions ADD CONSTRAINT publisher_zman_versions_unique UNIQUE (publisher_zman_id, version_number);
ALTER TABLE ONLY public.publisher_zmanim ADD CONSTRAINT publisher_zmanim_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publisher_zmanim ADD CONSTRAINT publisher_zmanim_unique_key UNIQUE (publisher_id, zman_key);
ALTER TABLE ONLY public.publishers ADD CONSTRAINT publishers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.publishers ADD CONSTRAINT publishers_email_key UNIQUE (email);
ALTER TABLE ONLY public.system_config ADD CONSTRAINT system_config_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.system_config ADD CONSTRAINT system_config_key_key UNIQUE (key);
ALTER TABLE ONLY public.tag_event_mappings ADD CONSTRAINT tag_event_mappings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tag_event_mappings ADD CONSTRAINT tag_event_mappings_tag_id_hebcal_key UNIQUE (tag_id, hebcal_event_pattern);
ALTER TABLE ONLY public.tag_types ADD CONSTRAINT tag_types_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tag_types ADD CONSTRAINT tag_types_key_key UNIQUE (key);
ALTER TABLE ONLY public.time_categories ADD CONSTRAINT time_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.time_categories ADD CONSTRAINT time_categories_key_key UNIQUE (key);
ALTER TABLE ONLY public.zman_display_contexts ADD CONSTRAINT zman_display_contexts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.zman_display_contexts ADD CONSTRAINT zman_display_contexts_unique UNIQUE (master_zman_id, context_code);
ALTER TABLE ONLY public.zman_registry_requests ADD CONSTRAINT zman_registry_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.zman_request_tags ADD CONSTRAINT zman_request_tags_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.zman_request_tags ADD CONSTRAINT zman_request_tags_unique UNIQUE (request_id, tag_id);
ALTER TABLE ONLY public.zman_tags ADD CONSTRAINT zman_tags_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.zman_tags ADD CONSTRAINT zman_tags_tag_key_key UNIQUE (tag_key);
ALTER TABLE ONLY public.zmanim_templates ADD CONSTRAINT zmanim_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.zmanim_templates ADD CONSTRAINT zmanim_templates_zman_key_key UNIQUE (zman_key);

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

ALTER TABLE ONLY public.ai_audit_logs ADD CONSTRAINT ai_audit_logs_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.algorithms ADD CONSTRAINT algorithms_forked_from_fkey FOREIGN KEY (forked_from) REFERENCES public.algorithms(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.algorithms ADD CONSTRAINT algorithms_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.geo_cities ADD CONSTRAINT geo_cities_continent_id_fkey FOREIGN KEY (continent_id) REFERENCES public.geo_continents(id);
ALTER TABLE ONLY public.geo_cities ADD CONSTRAINT geo_cities_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);
ALTER TABLE ONLY public.geo_cities ADD CONSTRAINT geo_cities_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id);
ALTER TABLE ONLY public.geo_cities ADD CONSTRAINT geo_cities_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.geo_regions(id);
ALTER TABLE ONLY public.geo_countries ADD CONSTRAINT geo_countries_continent_id_fkey FOREIGN KEY (continent_id) REFERENCES public.geo_continents(id);
ALTER TABLE ONLY public.geo_country_boundaries ADD CONSTRAINT geo_country_boundaries_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.geo_district_boundaries ADD CONSTRAINT geo_district_boundaries_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.geo_city_boundaries ADD CONSTRAINT geo_city_boundaries_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.geo_cities(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.geo_districts ADD CONSTRAINT geo_districts_continent_id_fkey FOREIGN KEY (continent_id) REFERENCES public.geo_continents(id);
ALTER TABLE ONLY public.geo_districts ADD CONSTRAINT geo_districts_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);
ALTER TABLE ONLY public.geo_districts ADD CONSTRAINT geo_districts_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.geo_regions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.geo_names ADD CONSTRAINT geo_names_language_code_fkey FOREIGN KEY (language_code) REFERENCES public.languages(code) ON DELETE CASCADE;
ALTER TABLE ONLY public.geo_region_boundaries ADD CONSTRAINT geo_region_boundaries_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.geo_regions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.geo_regions ADD CONSTRAINT geo_regions_continent_id_fkey FOREIGN KEY (continent_id) REFERENCES public.geo_continents(id);
ALTER TABLE ONLY public.geo_regions ADD CONSTRAINT geo_regions_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id) ON DELETE CASCADE;
-- Multi-source coordinate/elevation FKs (geo-data-accuracy-enhancement)
ALTER TABLE ONLY public.geo_city_coordinates ADD CONSTRAINT geo_city_coordinates_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.geo_cities(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.geo_city_coordinates ADD CONSTRAINT geo_city_coordinates_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.geo_city_elevations ADD CONSTRAINT geo_city_elevations_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.geo_cities(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.geo_city_elevations ADD CONSTRAINT geo_city_elevations_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.master_zman_day_types ADD CONSTRAINT master_zman_day_types_day_type_id_fkey FOREIGN KEY (day_type_id) REFERENCES public.day_types(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.master_zman_day_types ADD CONSTRAINT master_zman_day_types_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.master_zman_events ADD CONSTRAINT master_zman_events_jewish_event_id_fkey FOREIGN KEY (jewish_event_id) REFERENCES public.jewish_events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.master_zman_events ADD CONSTRAINT master_zman_events_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.master_zman_tags ADD CONSTRAINT master_zman_tags_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.master_zman_tags ADD CONSTRAINT master_zman_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.zman_tags(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_coverage ADD CONSTRAINT publisher_coverage_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.geo_cities(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_coverage ADD CONSTRAINT publisher_coverage_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_coverage ADD CONSTRAINT publisher_coverage_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_coverage ADD CONSTRAINT publisher_coverage_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_coverage ADD CONSTRAINT publisher_coverage_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.geo_regions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_invitations ADD CONSTRAINT publisher_invitations_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_onboarding ADD CONSTRAINT publisher_onboarding_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_snapshots ADD CONSTRAINT publisher_snapshots_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zman_aliases ADD CONSTRAINT publisher_zman_aliases_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zman_aliases ADD CONSTRAINT publisher_zman_aliases_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zman_day_types ADD CONSTRAINT publisher_zman_day_types_day_type_id_fkey FOREIGN KEY (day_type_id) REFERENCES public.day_types(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zman_day_types ADD CONSTRAINT publisher_zman_day_types_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zman_events ADD CONSTRAINT publisher_zman_events_jewish_event_id_fkey FOREIGN KEY (jewish_event_id) REFERENCES public.jewish_events(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zman_events ADD CONSTRAINT publisher_zman_events_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zman_tags ADD CONSTRAINT publisher_zman_tags_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zman_tags ADD CONSTRAINT publisher_zman_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.zman_tags(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zman_versions ADD CONSTRAINT publisher_zman_versions_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.publisher_zmanim ADD CONSTRAINT publisher_zmanim_linked_publisher_zman_id_fkey FOREIGN KEY (linked_publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.publisher_zmanim ADD CONSTRAINT publisher_zmanim_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id);
ALTER TABLE ONLY public.publisher_zmanim ADD CONSTRAINT publisher_zmanim_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.tag_event_mappings ADD CONSTRAINT tag_event_mappings_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.zman_tags(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.zman_display_contexts ADD CONSTRAINT zman_display_contexts_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.zman_registry_requests ADD CONSTRAINT zman_registry_requests_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.zman_request_tags ADD CONSTRAINT zman_request_tags_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.zman_registry_requests(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.zman_request_tags ADD CONSTRAINT zman_request_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.zman_tags(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Embeddings
CREATE INDEX embeddings_content_type_idx ON public.embeddings USING btree (content_type);
CREATE INDEX embeddings_source_idx ON public.embeddings USING btree (source);
CREATE INDEX embeddings_vector_idx ON public.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');

-- AI Audit
CREATE INDEX idx_ai_audit_created ON public.ai_audit_logs USING btree (created_at DESC);
CREATE INDEX idx_ai_audit_publisher ON public.ai_audit_logs USING btree (publisher_id);
CREATE INDEX idx_ai_audit_success ON public.ai_audit_logs USING btree (success);
CREATE INDEX idx_ai_audit_type ON public.ai_audit_logs USING btree (request_type);
CREATE INDEX idx_ai_audit_user ON public.ai_audit_logs USING btree (user_id);

-- Algorithm Templates
CREATE INDEX idx_algorithm_templates_active ON public.algorithm_templates USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_algorithm_templates_key ON public.algorithm_templates USING btree (template_key);

-- Algorithms
CREATE INDEX idx_algorithms_forked_from ON public.algorithms USING btree (forked_from) WHERE (forked_from IS NOT NULL);
CREATE INDEX idx_algorithms_public ON public.algorithms USING btree (is_public) WHERE (is_public = true);
CREATE INDEX idx_algorithms_publisher_id ON public.algorithms USING btree (publisher_id);
CREATE INDEX idx_algorithms_publisher_status ON public.algorithms USING btree (publisher_id, status);
CREATE INDEX idx_algorithms_publisher_status_created ON public.algorithms USING btree (publisher_id, status, created_at DESC);
CREATE INDEX idx_algorithms_status ON public.algorithms USING btree (status);

-- Astronomical Primitives
CREATE INDEX idx_astronomical_primitives_category ON public.astronomical_primitives USING btree (category);
CREATE INDEX idx_astronomical_primitives_variable_name ON public.astronomical_primitives USING btree (variable_name);

-- Cities
CREATE INDEX idx_geo_cities_continent_id ON public.geo_cities USING btree (continent_id);
CREATE INDEX idx_geo_cities_country_id ON public.geo_cities USING btree (country_id);
CREATE INDEX idx_geo_cities_district ON public.geo_cities USING btree (district_id);
CREATE INDEX idx_geo_cities_location ON public.geo_cities USING gist (location);
CREATE INDEX idx_geo_cities_name_ascii_trgm ON public.geo_cities USING gin (name_ascii gin_trgm_ops);
CREATE INDEX idx_geo_cities_name_trgm ON public.geo_cities USING gin (name gin_trgm_ops);
CREATE INDEX idx_geo_cities_population ON public.geo_cities USING btree (population DESC NULLS LAST);
CREATE INDEX idx_geo_cities_region ON public.geo_cities USING btree (region_id);
-- Composite indexes for ListCitiesByRegion and ListCitiesByDistrict queries (with ORDER BY population, name)
CREATE INDEX idx_geo_cities_region_population ON public.geo_cities USING btree (region_id, population DESC NULLS LAST, name) WHERE (region_id IS NOT NULL);
CREATE INDEX idx_geo_cities_district_population ON public.geo_cities USING btree (district_id, population DESC NULLS LAST, name) WHERE (district_id IS NOT NULL);
CREATE INDEX idx_geo_cities_wof_id ON public.geo_cities USING btree (wof_id) WHERE (wof_id IS NOT NULL);
-- Covering index for fast zmanim lookups - includes all data needed for calculations (geo-data-accuracy-enhancement)
CREATE INDEX idx_geo_cities_zmanim_lookup ON public.geo_cities(id)
    INCLUDE (latitude, longitude, elevation_m, timezone, coordinate_source, elevation_source);
-- Coordinate source filtering (admin queries - find cities with enhanced data)
CREATE INDEX idx_geo_cities_coord_source ON public.geo_cities(coordinate_source) WHERE coordinate_source != 'wof';

-- Day Types
CREATE INDEX idx_day_types_name ON public.day_types USING btree (name);
CREATE INDEX idx_day_types_parent ON public.day_types USING btree (parent_type);

-- Display Groups & Categories
CREATE INDEX idx_display_groups_key ON public.display_groups USING btree (key);
CREATE INDEX idx_display_groups_sort ON public.display_groups USING btree (sort_order);
CREATE INDEX idx_event_categories_key ON public.event_categories USING btree (key);
CREATE INDEX idx_event_categories_sort ON public.event_categories USING btree (sort_order);

-- Explanation Cache
CREATE INDEX idx_explanation_cache_expiry ON public.explanation_cache USING btree (expires_at);
CREATE INDEX idx_explanation_cache_lookup ON public.explanation_cache USING btree (formula_hash, language);

-- Geo tables
CREATE INDEX idx_geo_continents_wof_id ON public.geo_continents USING btree (wof_id) WHERE (wof_id IS NOT NULL);
CREATE INDEX idx_geo_countries_continent ON public.geo_countries USING btree (continent_id);
CREATE INDEX idx_geo_countries_name_trgm ON public.geo_countries USING gin (name gin_trgm_ops);
CREATE INDEX idx_geo_countries_wof_id ON public.geo_countries USING btree (wof_id) WHERE (wof_id IS NOT NULL);
-- Composite index for GetCountries query (join + ORDER BY name)
CREATE INDEX idx_geo_countries_continent_name ON public.geo_countries USING btree (continent_id, name);
CREATE INDEX idx_geo_districts_continent ON public.geo_districts USING btree (continent_id);
CREATE INDEX idx_geo_districts_country ON public.geo_districts USING btree (country_id);
CREATE INDEX idx_geo_districts_name_trgm ON public.geo_districts USING gin (name gin_trgm_ops);
CREATE INDEX idx_geo_districts_region ON public.geo_districts USING btree (region_id);
CREATE INDEX idx_geo_districts_wof_id ON public.geo_districts USING btree (wof_id) WHERE (wof_id IS NOT NULL);
-- Composite index for GetDistrictsByRegion (region_id + ORDER BY name)
CREATE INDEX idx_geo_districts_region_name ON public.geo_districts USING btree (region_id, name);
CREATE INDEX idx_geo_regions_continent ON public.geo_regions USING btree (continent_id);
CREATE INDEX idx_geo_regions_country ON public.geo_regions USING btree (country_id);
CREATE INDEX idx_geo_regions_name_trgm ON public.geo_regions USING gin (name gin_trgm_ops);
CREATE INDEX idx_geo_regions_wof_id ON public.geo_regions USING btree (wof_id) WHERE (wof_id IS NOT NULL);
-- Composite index for GetRegionsByCountry (country_id + ORDER BY name)
CREATE INDEX idx_geo_regions_country_name ON public.geo_regions USING btree (country_id, name);

-- Geo names (multi-language)
CREATE INDEX idx_geo_names_entity ON public.geo_names USING btree (entity_type, entity_id);
CREATE INDEX idx_geo_names_language ON public.geo_names USING btree (language_code);
CREATE INDEX idx_geo_names_name_trgm ON public.geo_names USING gin (name gin_trgm_ops);

-- Geo boundaries
CREATE INDEX idx_country_boundaries_centroid ON public.geo_country_boundaries USING gist (centroid);
CREATE INDEX idx_country_boundaries_geom ON public.geo_country_boundaries USING gist (boundary);
CREATE INDEX idx_country_boundaries_simplified ON public.geo_country_boundaries USING gist (boundary_simplified);
CREATE INDEX idx_region_boundaries_centroid ON public.geo_region_boundaries USING gist (centroid);
CREATE INDEX idx_region_boundaries_geom ON public.geo_region_boundaries USING gist (boundary);
CREATE INDEX idx_region_boundaries_simplified ON public.geo_region_boundaries USING gist (boundary_simplified);
CREATE INDEX idx_district_boundaries_centroid ON public.geo_district_boundaries USING gist (centroid);
CREATE INDEX idx_district_boundaries_geom ON public.geo_district_boundaries USING gist (boundary);
CREATE INDEX idx_district_boundaries_simplified ON public.geo_district_boundaries USING gist (boundary_simplified);
CREATE INDEX idx_city_boundaries_geom ON public.geo_city_boundaries USING gist (boundary);
CREATE INDEX idx_city_boundaries_simplified ON public.geo_city_boundaries USING gist (boundary_simplified);

-- Jewish Events
CREATE INDEX idx_jewish_events_code ON public.jewish_events USING btree (code);
CREATE INDEX idx_jewish_events_parent ON public.jewish_events USING btree (parent_event_code);
CREATE INDEX idx_jewish_events_type ON public.jewish_events USING btree (event_type);

-- Master Registry
CREATE INDEX idx_master_registry_category ON public.master_zmanim_registry USING btree (time_category);
CREATE INDEX idx_master_registry_english_name_trgm ON public.master_zmanim_registry USING gin (canonical_english_name gin_trgm_ops);
CREATE INDEX idx_master_registry_hebrew_name_trgm ON public.master_zmanim_registry USING gin (canonical_hebrew_name gin_trgm_ops);
CREATE INDEX idx_master_registry_hidden ON public.master_zmanim_registry USING btree (is_hidden);
CREATE INDEX idx_master_registry_transliteration_trgm ON public.master_zmanim_registry USING gin (transliteration gin_trgm_ops);
CREATE INDEX idx_master_registry_visible_by_category ON public.master_zmanim_registry USING btree (time_category, canonical_hebrew_name) WHERE (is_hidden = false);

-- Master Zman associations
CREATE INDEX idx_master_zman_day_types_day ON public.master_zman_day_types USING btree (day_type_id);
CREATE INDEX idx_master_zman_day_types_zman ON public.master_zman_day_types USING btree (master_zman_id);
CREATE INDEX idx_master_zman_events_event ON public.master_zman_events USING btree (jewish_event_id);
CREATE INDEX idx_master_zman_events_zman ON public.master_zman_events USING btree (master_zman_id);
CREATE INDEX idx_master_zman_tags_covering ON public.master_zman_tags USING btree (master_zman_id) INCLUDE (tag_id);
CREATE INDEX idx_master_zman_tags_negated ON public.master_zman_tags USING btree (master_zman_id, is_negated);
CREATE INDEX idx_master_zman_tags_tag ON public.master_zman_tags USING btree (tag_id);
CREATE INDEX idx_master_zman_tags_zman ON public.master_zman_tags USING btree (master_zman_id);

-- Password Reset Tokens
CREATE INDEX idx_password_reset_tokens_email ON public.password_reset_tokens USING btree (email);
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);

-- Publisher Onboarding
CREATE INDEX idx_onboarding_publisher ON public.publisher_onboarding USING btree (publisher_id);

-- Publisher Coverage
CREATE INDEX idx_publisher_coverage_active ON public.publisher_coverage USING btree (publisher_id, is_active) WHERE (is_active = true);
CREATE INDEX idx_publisher_coverage_city ON public.publisher_coverage USING btree (city_id) WHERE (coverage_level = 'city');
CREATE INDEX idx_publisher_coverage_continent ON public.publisher_coverage USING btree (continent_code) WHERE (coverage_level = 'continent');
CREATE INDEX idx_publisher_coverage_country ON public.publisher_coverage USING btree (country_id) WHERE (coverage_level = 'country');
CREATE INDEX idx_publisher_coverage_district ON public.publisher_coverage USING btree (district_id) WHERE (coverage_level = 'district');
CREATE INDEX idx_publisher_coverage_publisher ON public.publisher_coverage USING btree (publisher_id);
CREATE INDEX idx_publisher_coverage_region ON public.publisher_coverage USING btree (region_id) WHERE (coverage_level = 'region');
CREATE UNIQUE INDEX idx_publisher_coverage_unique_city ON public.publisher_coverage USING btree (publisher_id, city_id) WHERE (coverage_level = 'city');
CREATE UNIQUE INDEX idx_publisher_coverage_unique_continent ON public.publisher_coverage USING btree (publisher_id, continent_code) WHERE (coverage_level = 'continent');
CREATE UNIQUE INDEX idx_publisher_coverage_unique_country ON public.publisher_coverage USING btree (publisher_id, country_id) WHERE (coverage_level = 'country');
CREATE UNIQUE INDEX idx_publisher_coverage_unique_district ON public.publisher_coverage USING btree (publisher_id, district_id) WHERE (coverage_level = 'district');
CREATE UNIQUE INDEX idx_publisher_coverage_unique_region ON public.publisher_coverage USING btree (publisher_id, region_id) WHERE (coverage_level = 'region');

-- Publisher Invitations
CREATE INDEX idx_publisher_invitations_email ON public.publisher_invitations USING btree (email, publisher_id);
CREATE INDEX idx_publisher_invitations_publisher ON public.publisher_invitations USING btree (publisher_id);
CREATE INDEX idx_publisher_invitations_token ON public.publisher_invitations USING btree (token);

-- Publisher Requests
CREATE UNIQUE INDEX idx_publisher_requests_email_pending ON public.publisher_requests USING btree (email) WHERE (status = 'pending');
CREATE INDEX idx_publisher_requests_status ON public.publisher_requests USING btree (status);

-- Publisher Snapshots
CREATE INDEX idx_publisher_snapshots_publisher_created ON public.publisher_snapshots USING btree (publisher_id, created_at DESC);

-- Publisher Zman Aliases
CREATE INDEX idx_publisher_zman_aliases_publisher ON public.publisher_zman_aliases USING btree (publisher_id);
CREATE INDEX idx_publisher_zman_aliases_zman ON public.publisher_zman_aliases USING btree (publisher_zman_id);

-- Publisher Zman Day Types
CREATE INDEX idx_pub_zman_day_types_day ON public.publisher_zman_day_types USING btree (day_type_id);
CREATE INDEX idx_pub_zman_day_types_zman ON public.publisher_zman_day_types USING btree (publisher_zman_id);

-- Publisher Zman Events
CREATE INDEX idx_publisher_zman_events_composite ON public.publisher_zman_events USING btree (publisher_zman_id, jewish_event_id);
CREATE INDEX idx_publisher_zman_events_event ON public.publisher_zman_events USING btree (jewish_event_id);
CREATE INDEX idx_publisher_zman_events_zman ON public.publisher_zman_events USING btree (publisher_zman_id);

-- Publisher Zman Tags
CREATE INDEX idx_publisher_zman_tags_negated ON public.publisher_zman_tags USING btree (publisher_zman_id, is_negated);
CREATE INDEX idx_publisher_zman_tags_tag ON public.publisher_zman_tags USING btree (tag_id);
CREATE INDEX idx_publisher_zman_tags_zman ON public.publisher_zman_tags USING btree (publisher_zman_id);

-- Publisher Zman Versions
CREATE INDEX idx_publisher_zman_versions_zman_version ON public.publisher_zman_versions USING btree (publisher_zman_id, version_number DESC);

-- Publisher Zmanim
CREATE INDEX idx_publisher_zmanim_active ON public.publisher_zmanim USING btree (publisher_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_publisher_zmanim_active_enabled ON public.publisher_zmanim USING btree (publisher_id, is_enabled) WHERE (deleted_at IS NULL);
CREATE INDEX idx_publisher_zmanim_beta ON public.publisher_zmanim USING btree (publisher_id, is_beta) WHERE (is_beta = true);
CREATE INDEX idx_publisher_zmanim_category ON public.publisher_zmanim USING btree (category);
CREATE INDEX idx_publisher_zmanim_custom ON public.publisher_zmanim USING btree (publisher_id, is_custom) WHERE (is_custom = true);
CREATE INDEX idx_publisher_zmanim_deleted ON public.publisher_zmanim USING btree (publisher_id, deleted_at) WHERE (deleted_at IS NOT NULL);
CREATE INDEX idx_publisher_zmanim_enabled ON public.publisher_zmanim USING btree (publisher_id, is_enabled) WHERE (is_enabled = true);
CREATE INDEX idx_publisher_zmanim_english_name_trgm ON public.publisher_zmanim USING gin (english_name gin_trgm_ops) WHERE (is_published = true AND is_visible = true);
CREATE INDEX idx_publisher_zmanim_hebrew_name_trgm ON public.publisher_zmanim USING gin (hebrew_name gin_trgm_ops) WHERE (is_published = true AND is_visible = true);
CREATE INDEX idx_publisher_zmanim_key_lookup ON public.publisher_zmanim USING btree (publisher_id, zman_key) WHERE (deleted_at IS NULL);
CREATE INDEX idx_publisher_zmanim_linked ON public.publisher_zmanim USING btree (linked_publisher_zman_id);
CREATE INDEX idx_publisher_zmanim_linked_source ON public.publisher_zmanim USING btree (publisher_id, source_type, linked_publisher_zman_id) WHERE (source_type = 'linked');
CREATE INDEX idx_publisher_zmanim_master ON public.publisher_zmanim USING btree (master_zman_id);
CREATE INDEX idx_publisher_zmanim_public_search ON public.publisher_zmanim USING btree (is_published, is_visible, category) WHERE (is_published = true AND is_visible = true);
CREATE INDEX idx_publisher_zmanim_published ON public.publisher_zmanim USING btree (publisher_id, is_published) WHERE (is_published = true);
CREATE INDEX idx_publisher_zmanim_source_type ON public.publisher_zmanim USING btree (source_type);

-- Publishers
CREATE INDEX idx_publishers_clerk_user_id ON public.publishers USING btree (clerk_user_id);
CREATE INDEX idx_publishers_deleted_at ON public.publishers USING btree (deleted_at) WHERE (deleted_at IS NULL);
CREATE INDEX idx_publishers_id_name ON public.publishers USING btree (id) INCLUDE (name, status, is_verified);
CREATE INDEX idx_publishers_is_certified ON public.publishers USING btree (is_certified);
CREATE INDEX idx_publishers_location ON public.publishers USING gist (location);
CREATE UNIQUE INDEX idx_publishers_slug ON public.publishers USING btree (slug) WHERE (slug IS NOT NULL);
CREATE INDEX idx_publishers_status ON public.publishers USING btree (status);
CREATE INDEX idx_publishers_verified ON public.publishers USING btree (is_verified) WHERE (is_verified = true);

-- System Config
CREATE INDEX idx_system_config_key ON public.system_config USING btree (key);

-- Tag Event Mappings
CREATE INDEX idx_tag_event_mappings_hebrew_date ON public.tag_event_mappings USING btree (hebrew_month, hebrew_day_start) WHERE (hebrew_month IS NOT NULL);
CREATE INDEX idx_tag_event_mappings_pattern ON public.tag_event_mappings USING btree (hebcal_event_pattern) WHERE (hebcal_event_pattern IS NOT NULL);
CREATE INDEX idx_tag_event_mappings_tag ON public.tag_event_mappings USING btree (tag_id);

-- Tag Types
CREATE INDEX idx_tag_types_key ON public.tag_types USING btree (key);
CREATE INDEX idx_tag_types_sort ON public.tag_types USING btree (sort_order);

-- Time Categories
CREATE INDEX idx_time_categories_key ON public.time_categories USING btree (key);
CREATE INDEX idx_time_categories_sort ON public.time_categories USING btree (sort_order);

-- Zman Registry Requests
CREATE INDEX idx_zman_registry_requests_pending ON public.zman_registry_requests USING btree (created_at DESC) WHERE (status = 'pending');
CREATE INDEX idx_zman_registry_requests_publisher ON public.zman_registry_requests USING btree (publisher_id);
CREATE INDEX idx_zman_registry_requests_publisher_created ON public.zman_registry_requests USING btree (publisher_id, created_at DESC);
CREATE INDEX idx_zman_registry_requests_status ON public.zman_registry_requests USING btree (status);

-- Zman Request Tags
CREATE INDEX idx_zman_request_tags_request ON public.zman_request_tags USING btree (request_id);
CREATE INDEX idx_zman_request_tags_tag ON public.zman_request_tags USING btree (tag_id) WHERE (tag_id IS NOT NULL);

-- Zman Tags
CREATE INDEX idx_zman_tags_type ON public.zman_tags USING btree (tag_type);

-- Zmanim Templates
CREATE INDEX idx_zmanim_templates_key ON public.zmanim_templates USING btree (zman_key);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER ai_index_status_updated_at BEFORE UPDATE ON public.ai_index_status FOR EACH ROW EXECUTE FUNCTION public.update_embeddings_updated_at();
CREATE TRIGGER embeddings_updated_at BEFORE UPDATE ON public.embeddings FOR EACH ROW EXECUTE FUNCTION public.update_embeddings_updated_at();
CREATE TRIGGER master_registry_updated_at BEFORE UPDATE ON public.master_zmanim_registry FOR EACH ROW EXECUTE FUNCTION public.update_master_registry_updated_at();
CREATE TRIGGER prune_versions_trigger AFTER INSERT ON public.publisher_zman_versions FOR EACH ROW EXECUTE FUNCTION public.prune_zman_versions();
CREATE TRIGGER publisher_zman_day_types_updated_at BEFORE UPDATE ON public.publisher_zman_day_types FOR EACH ROW EXECUTE FUNCTION public.update_publisher_zman_day_types_updated_at();
CREATE TRIGGER publisher_zman_events_updated_at BEFORE UPDATE ON public.publisher_zman_events FOR EACH ROW EXECUTE FUNCTION public.update_publisher_zman_events_updated_at();
CREATE TRIGGER publisher_zmanim_updated_at BEFORE UPDATE ON public.publisher_zmanim FOR EACH ROW EXECUTE FUNCTION public.update_publisher_zmanim_updated_at();
CREATE TRIGGER trg_validate_city_hierarchy BEFORE INSERT OR UPDATE ON public.geo_cities FOR EACH ROW EXECUTE FUNCTION public.validate_city_hierarchy();
CREATE TRIGGER trg_validate_district_hierarchy BEFORE INSERT OR UPDATE ON public.geo_districts FOR EACH ROW EXECUTE FUNCTION public.validate_district_hierarchy();
CREATE TRIGGER trg_validate_region_hierarchy BEFORE INSERT OR UPDATE ON public.geo_regions FOR EACH ROW EXECUTE FUNCTION public.validate_region_hierarchy();
CREATE TRIGGER trigger_prune_publisher_snapshots AFTER INSERT ON public.publisher_snapshots FOR EACH ROW EXECUTE FUNCTION public.prune_publisher_snapshots();
CREATE TRIGGER update_algorithms_updated_at BEFORE UPDATE ON public.algorithms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_geo_cities_updated_at BEFORE UPDATE ON public.geo_cities FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();
CREATE TRIGGER update_geo_countries_updated_at BEFORE UPDATE ON public.geo_countries FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();
CREATE TRIGGER update_geo_country_boundaries_updated_at BEFORE UPDATE ON public.geo_country_boundaries FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();
CREATE TRIGGER update_geo_district_boundaries_updated_at BEFORE UPDATE ON public.geo_district_boundaries FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();
CREATE TRIGGER update_geo_districts_updated_at BEFORE UPDATE ON public.geo_districts FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();
CREATE TRIGGER update_geo_region_boundaries_updated_at BEFORE UPDATE ON public.geo_region_boundaries FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();
CREATE TRIGGER update_geo_regions_updated_at BEFORE UPDATE ON public.geo_regions FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();
CREATE TRIGGER update_publisher_coverage_updated_at BEFORE UPDATE ON public.publisher_coverage FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();

-- Triggers to auto-update geo_cities.effective_* columns when coordinates/elevations change
-- These only fire for non-publisher sources (community, simplemaps, wof, glo90)
CREATE TRIGGER trg_geo_city_coordinates_update_effective AFTER INSERT OR UPDATE ON public.geo_city_coordinates FOR EACH ROW EXECUTE FUNCTION public.trg_update_effective_geo_city_coordinates();
CREATE TRIGGER trg_geo_city_elevations_update_effective AFTER INSERT OR UPDATE ON public.geo_city_elevations FOR EACH ROW EXECUTE FUNCTION public.trg_update_effective_city_elevation();

-- ============================================================================
-- Data Migration: Populate is_city_state for existing countries
-- Run this once after migration to update existing data
-- ============================================================================
-- UPDATE geo_countries SET is_city_state = true WHERE code IN (
--   'MC', -- Monaco
--   'VA', -- Vatican City
--   'SM', -- San Marino
--   'LI', -- Liechtenstein
--   'AD', -- Andorra
--   'MT', -- Malta
--   'SG', -- Singapore
--   'BH', -- Bahrain
--   'HK', -- Hong Kong
--   'MO', -- Macau
--   'GI'  -- Gibraltar
-- );
