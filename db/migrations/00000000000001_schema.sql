-- Migration: Initial Schema
-- Generated from database dump on 2025-12-23
-- This migration creates the complete database schema for the Zmanim application

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;







-- Name: display_status; Type: TYPE; Schema: public; Owner: -

CREATE TYPE public.display_status AS ENUM (
    'core',
    'optional',
    'hidden'
);


-- Name: assign_all_city_hierarchy(); Type: FUNCTION; Schema: public; Owner: -

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


-- Name: assign_and_validate_city_hierarchy(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.assign_and_validate_city_hierarchy(p_import_id uuid DEFAULT gen_random_uuid()) RETURNS TABLE(import_id uuid, countries_updated integer, countries_unmatched integer, regions_updated integer, regions_unmatched integer, districts_updated integer, districts_unmatched integer, validation_errors integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_import_id UUID := p_import_id;
    v_countries_updated INTEGER;
    v_countries_unmatched INTEGER;
    v_regions_updated INTEGER;
    v_regions_unmatched INTEGER;
    v_districts_updated INTEGER;
    v_districts_unmatched INTEGER;
    v_validation_errors INTEGER;
BEGIN
    -- Step 1: Assign cities to countries
    SELECT * INTO v_countries_updated, v_countries_unmatched
    FROM assign_cities_to_countries();

    RAISE NOTICE 'Countries: % updated, % unmatched', v_countries_updated, v_countries_unmatched;

    -- Step 2: Assign cities to regions
    SELECT * INTO v_regions_updated, v_regions_unmatched
    FROM assign_cities_to_regions();

    RAISE NOTICE 'Regions: % updated, % unmatched', v_regions_updated, v_regions_unmatched;

    -- Step 3: Assign cities to districts
    SELECT * INTO v_districts_updated, v_districts_unmatched
    FROM assign_cities_to_districts();

    RAISE NOTICE 'Districts: % updated, % unmatched', v_districts_updated, v_districts_unmatched;

    -- Step 4: Validate and log errors
    INSERT INTO geo_import_errors (import_id, error_type, entity_type, entity_id, details)
    SELECT
        v_import_id,
        v.issue_type,
        'city'::VARCHAR(20),
        v.city_id,
        jsonb_build_object(
            'city_name', v.city_name,
            'details', v.details
        )
    FROM validate_all_city_hierarchy() v;

    GET DIAGNOSTICS v_validation_errors = ROW_COUNT;

    RAISE NOTICE 'Validation: % errors logged to geo_import_errors', v_validation_errors;

    -- Return summary
    RETURN QUERY SELECT
        v_import_id,
        v_countries_updated,
        v_countries_unmatched,
        v_regions_updated,
        v_regions_unmatched,
        v_districts_updated,
        v_districts_unmatched,
        v_validation_errors;
END;
$$;


-- Name: FUNCTION assign_and_validate_city_hierarchy(p_import_id uuid); Type: COMMENT; Schema: public; Owner: -

COMMENT ON FUNCTION public.assign_and_validate_city_hierarchy(p_import_id uuid) IS 'Runs complete hierarchy assignment (countries, regions, districts) and logs validation errors to geo_import_errors. Returns summary of updates, unmatched entities, and errors logged.';


-- Name: assign_cities_to_countries(); Type: FUNCTION; Schema: public; Owner: -

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


-- Name: assign_cities_to_districts(); Type: FUNCTION; Schema: public; Owner: -

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


-- Name: assign_cities_to_regions(); Type: FUNCTION; Schema: public; Owner: -

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


-- Name: cleanup_expired_explanations(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.cleanup_expired_explanations() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM explanation_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


-- Name: complete_action(uuid, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.complete_action(p_action_id uuid, p_result jsonb, p_status text DEFAULT 'completed'::text, p_error_message text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE public.actions
    SET
        status = p_status,
        result = p_result,
        error_message = p_error_message,
        completed_at = now(),
        duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::integer * 1000
    WHERE id = p_action_id;
END;
$$;


-- Name: find_or_create_geo_location(smallint, smallint, smallint, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.find_or_create_geo_location(p_coverage_level_id smallint, p_continent_id smallint DEFAULT NULL::smallint, p_country_id smallint DEFAULT NULL::smallint, p_region_id integer DEFAULT NULL::integer, p_district_id integer DEFAULT NULL::integer, p_city_id integer DEFAULT NULL::integer) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_location_id uuid;
BEGIN
    SELECT id INTO v_location_id
    FROM public.geo_location_references
    WHERE
        coverage_level_id = p_coverage_level_id
        AND (continent_id = p_continent_id OR (continent_id IS NULL AND p_continent_id IS NULL))
        AND (country_id = p_country_id OR (country_id IS NULL AND p_country_id IS NULL))
        AND (region_id = p_region_id OR (region_id IS NULL AND p_region_id IS NULL))
        AND (district_id = p_district_id OR (district_id IS NULL AND p_district_id IS NULL))
        AND (city_id = p_city_id OR (city_id IS NULL AND p_city_id IS NULL))
    LIMIT 1;

    IF v_location_id IS NULL THEN
        INSERT INTO public.geo_location_references (
            coverage_level_id,
            continent_id,
            country_id,
            region_id,
            district_id,
            city_id
        ) VALUES (
            p_coverage_level_id,
            p_continent_id,
            p_country_id,
            p_region_id,
            p_district_id,
            p_city_id
        ) RETURNING id INTO v_location_id;
    END IF;

    RETURN v_location_id;
END;
$$;


-- Name: get_effective_city_elevation(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.get_effective_city_elevation(p_city_id integer, p_coordinate_source_id integer DEFAULT NULL::integer, p_publisher_id integer DEFAULT NULL::integer) RETURNS TABLE(elevation_m integer, source_id integer, accuracy_m integer)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT ce.elevation_m, ce.source_id, COALESCE(ce.accuracy_m, s.default_accuracy_m)
    FROM geo_city_elevations ce
    JOIN geo_data_sources s ON s.id = ce.source_id
    WHERE ce.city_id = p_city_id
      AND s.is_active = true
      AND (p_coordinate_source_id IS NULL OR ce.coordinate_source_id = p_coordinate_source_id)
      AND (
          (s.key = 'publisher' AND ce.publisher_id = p_publisher_id)
          OR (s.key != 'publisher')
      )
    ORDER BY
        s.priority,
        ce.verified_at DESC NULLS LAST
    LIMIT 1;
END;
$$;


-- Name: get_effective_geo_city_coordinates(integer, integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.get_effective_geo_city_coordinates(p_city_id integer, p_publisher_id integer DEFAULT NULL::integer) RETURNS TABLE(latitude double precision, longitude double precision, source_id integer, accuracy_m integer)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT cc.latitude, cc.longitude, cc.source_id, COALESCE(cc.accuracy_m, s.default_accuracy_m)
    FROM geo_city_coordinates cc
    JOIN geo_data_sources s ON s.id = cc.source_id
    WHERE cc.city_id = p_city_id
      AND s.is_active = true
      AND (
          -- Include publisher overrides only for the specified publisher
          (s.key = 'publisher' AND cc.publisher_id = p_publisher_id)
          -- Include all non-publisher sources
          OR (s.key != 'publisher')
      )
    ORDER BY
        s.priority,
        cc.verified_at DESC NULLS LAST
    LIMIT 1;
END;
$$;


-- Name: get_effective_locality_location(integer, integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.get_effective_locality_location(p_locality_id integer, p_publisher_id integer DEFAULT NULL::integer) RETURNS TABLE(locality_id integer, latitude double precision, longitude double precision, elevation_m integer, timezone text, coordinate_source_id integer, coordinate_source_key character varying, elevation_source_id integer, elevation_source_key character varying, has_publisher_coordinate_override boolean, has_admin_coordinate_override boolean, has_publisher_elevation_override boolean, has_admin_elevation_override boolean)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_baseline RECORD;
    v_coord RECORD;
    v_elev RECORD;
    v_publisher_coord_exists boolean := false;
    v_admin_coord_exists boolean := false;
    v_publisher_elev_exists boolean := false;
    v_admin_elev_exists boolean := false;
    v_admin_source_id integer;
BEGIN
    -- Get admin source ID
    SELECT id INTO v_admin_source_id FROM geo_data_sources WHERE key = 'admin';

    -- Get baseline data from geo_localities (for timezone only now)
    SELECT
        l.id,
        l.timezone
    INTO v_baseline
    FROM geo_localities l
    WHERE l.id = p_locality_id;

    -- If locality doesn't exist, return empty result
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Resolve coordinates with priority: publisher > admin > default
    -- First check for publisher override
    IF p_publisher_id IS NOT NULL THEN
        SELECT ll.latitude, ll.longitude, ll.source_id, s.key as source_key
        INTO v_coord
        FROM geo_locality_locations ll
        JOIN geo_data_sources s ON s.id = ll.source_id
        WHERE ll.locality_id = p_locality_id
          AND ll.publisher_id = p_publisher_id
          AND s.is_active = true
        LIMIT 1;

        IF FOUND THEN
            v_publisher_coord_exists := true;
        END IF;
    END IF;

    -- If no publisher override, check for admin override
    IF v_coord IS NULL AND v_admin_source_id IS NOT NULL THEN
        SELECT ll.latitude, ll.longitude, ll.source_id, s.key as source_key
        INTO v_coord
        FROM geo_locality_locations ll
        JOIN geo_data_sources s ON s.id = ll.source_id
        WHERE ll.locality_id = p_locality_id
          AND ll.publisher_id IS NULL
          AND ll.source_id = v_admin_source_id
          AND s.is_active = true
        LIMIT 1;

        IF FOUND THEN
            v_admin_coord_exists := true;
        END IF;
    END IF;

    -- If still no override, get default (non-admin, non-publisher)
    IF v_coord IS NULL THEN
        SELECT ll.latitude, ll.longitude, ll.source_id, s.key as source_key
        INTO v_coord
        FROM geo_locality_locations ll
        JOIN geo_data_sources s ON s.id = ll.source_id
        WHERE ll.locality_id = p_locality_id
          AND ll.publisher_id IS NULL
          AND (v_admin_source_id IS NULL OR ll.source_id != v_admin_source_id)
          AND s.is_active = true
        ORDER BY s.priority
        LIMIT 1;
    END IF;

    -- Resolve elevation with same priority
    IF p_publisher_id IS NOT NULL THEN
        SELECT le.elevation_m, le.source_id, s.key as source_key
        INTO v_elev
        FROM geo_locality_elevations le
        JOIN geo_data_sources s ON s.id = le.source_id
        WHERE le.locality_id = p_locality_id
          AND le.publisher_id = p_publisher_id
          AND s.is_active = true
        LIMIT 1;

        IF FOUND THEN
            v_publisher_elev_exists := true;
        END IF;
    END IF;

    IF v_elev IS NULL AND v_admin_source_id IS NOT NULL THEN
        SELECT le.elevation_m, le.source_id, s.key as source_key
        INTO v_elev
        FROM geo_locality_elevations le
        JOIN geo_data_sources s ON s.id = le.source_id
        WHERE le.locality_id = p_locality_id
          AND le.publisher_id IS NULL
          AND le.source_id = v_admin_source_id
          AND s.is_active = true
        LIMIT 1;

        IF FOUND THEN
            v_admin_elev_exists := true;
        END IF;
    END IF;

    IF v_elev IS NULL THEN
        SELECT le.elevation_m, le.source_id, s.key as source_key
        INTO v_elev
        FROM geo_locality_elevations le
        JOIN geo_data_sources s ON s.id = le.source_id
        WHERE le.locality_id = p_locality_id
          AND le.publisher_id IS NULL
          AND (v_admin_source_id IS NULL OR le.source_id != v_admin_source_id)
          AND s.is_active = true
        ORDER BY s.priority
        LIMIT 1;
    END IF;

    -- Return combined result
    RETURN QUERY SELECT
        v_baseline.id,
        v_coord.latitude,
        v_coord.longitude,
        v_elev.elevation_m,
        v_baseline.timezone,
        v_coord.source_id,
        v_coord.source_key,
        v_elev.source_id,
        v_elev.source_key,
        v_publisher_coord_exists,
        v_admin_coord_exists,
        v_publisher_elev_exists,
        v_admin_elev_exists;
END;
$$;


-- Name: FUNCTION get_effective_locality_location(p_locality_id integer, p_publisher_id integer); Type: COMMENT; Schema: public; Owner: -

COMMENT ON FUNCTION public.get_effective_locality_location(p_locality_id integer, p_publisher_id integer) IS 'Returns effective locality location data with hierarchical override resolution.
Priority: publisher override > admin override > default (overture/glo90).
Used for all zmanim calculations.';


-- Name: get_locality_location(integer, integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.get_locality_location(p_locality_id integer, p_publisher_id integer DEFAULT NULL::integer) RETURNS TABLE(locality_id integer, latitude double precision, longitude double precision, elevation_m integer, timezone text, has_coordinate_override boolean, has_elevation_override boolean)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    -- Delegate to new function and map columns for backward compatibility
    RETURN QUERY
    SELECT
        ell.locality_id,
        ell.latitude,
        ell.longitude,
        ell.elevation_m,
        ell.timezone,
        (ell.has_publisher_coordinate_override OR ell.has_admin_coordinate_override),
        (ell.has_publisher_elevation_override OR ell.has_admin_elevation_override)
    FROM get_effective_locality_location(p_locality_id, p_publisher_id) ell;
END;
$$;


-- Name: FUNCTION get_locality_location(p_locality_id integer, p_publisher_id integer); Type: COMMENT; Schema: public; Owner: -

COMMENT ON FUNCTION public.get_locality_location(p_locality_id integer, p_publisher_id integer) IS 'Returns effective locality coordinates and elevation, with optional publisher overrides. Used for zmanim calculations.';


-- Name: get_next_algorithm_version(integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.get_next_algorithm_version(p_algorithm_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN COALESCE((
        SELECT MAX(version_number) + 1
        FROM public.algorithm_version_history
        WHERE algorithm_id = p_algorithm_id
    ), 1);
END;
$$;


-- Name: get_next_zman_version(integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.get_next_zman_version(p_publisher_zman_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE max_version INT;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) INTO max_version
    FROM publisher_zman_versions WHERE publisher_zman_id = p_publisher_zman_id;
    RETURN max_version + 1;
END;
$$;


-- Name: get_publishers_for_city(integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.get_publishers_for_city(p_city_id integer) RETURNS TABLE(publisher_id integer, publisher_name text, coverage_level text, priority integer, match_type text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_city RECORD;
    v_level_city smallint;
    v_level_district smallint;
    v_level_region smallint;
    v_level_country smallint;
    v_level_continent smallint;
    v_status_active smallint;
BEGIN
    -- Get coverage level IDs
    SELECT id INTO v_level_city FROM coverage_levels WHERE key = 'city';
    SELECT id INTO v_level_district FROM coverage_levels WHERE key = 'district';
    SELECT id INTO v_level_region FROM coverage_levels WHERE key = 'region';
    SELECT id INTO v_level_country FROM coverage_levels WHERE key = 'country';
    SELECT id INTO v_level_continent FROM coverage_levels WHERE key = 'continent';
    SELECT id INTO v_status_active FROM publisher_statuses WHERE key = 'active';

    SELECT
        c.id,
        c.country_id,
        c.region_id,
        c.district_id,
        co.continent_id
    INTO v_city
    FROM geo_cities c
    JOIN geo_countries co ON c.country_id = co.id
    WHERE c.id = p_city_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT DISTINCT ON (pc.publisher_id)
        pc.publisher_id,
        p.name::TEXT as publisher_name,
        cl.key::TEXT as coverage_level,
        pc.priority,
        CASE cl.key
            WHEN 'city' THEN 'exact_city'
            WHEN 'district' THEN 'district_match'
            WHEN 'region' THEN 'region_match'
            WHEN 'country' THEN 'country_match'
            WHEN 'continent' THEN 'continent_match'
        END as match_type
    FROM publisher_coverage pc
    JOIN publishers p ON p.id = pc.publisher_id
    JOIN coverage_levels cl ON cl.id = pc.coverage_level_id
    WHERE pc.is_active = TRUE
      AND p.status_id = v_status_active
      AND (
        (pc.coverage_level_id = v_level_city AND pc.city_id = p_city_id)
        OR (pc.coverage_level_id = v_level_district AND pc.district_id = v_city.district_id AND v_city.district_id IS NOT NULL)
        OR (pc.coverage_level_id = v_level_region AND pc.region_id = v_city.region_id AND v_city.region_id IS NOT NULL)
        OR (pc.coverage_level_id = v_level_country AND pc.country_id = v_city.country_id)
        OR (pc.coverage_level_id = v_level_continent AND pc.continent_id = v_city.continent_id)
      )
    ORDER BY pc.publisher_id,
             cl.sort_order,
             pc.priority DESC;
END;
$$;


-- Name: hard_delete_publisher(integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.hard_delete_publisher(p_publisher_id integer) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_deleted_counts jsonb;
    v_count integer;
    v_total integer := 0;
BEGIN
    -- Initialize result object
    v_deleted_counts := '{}'::jsonb;

    -- 1. Delete publisher_zman_versions (cascades from publisher_zmanim)
    DELETE FROM publisher_zman_versions
    WHERE publisher_zman_id IN (SELECT id FROM publisher_zmanim WHERE publisher_id = p_publisher_id);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_zman_versions', v_count);
    v_total := v_total + v_count;

    -- 2. Delete publisher_zman_tags (cascades from publisher_zmanim)
    DELETE FROM publisher_zman_tags
    WHERE publisher_zman_id IN (SELECT id FROM publisher_zmanim WHERE publisher_id = p_publisher_id);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_zman_tags', v_count);
    v_total := v_total + v_count;

    -- 3. Delete publisher_zman_day_types (cascades from publisher_zmanim)
    DELETE FROM publisher_zman_day_types
    WHERE publisher_zman_id IN (SELECT id FROM publisher_zmanim WHERE publisher_id = p_publisher_id);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_zman_day_types', v_count);
    v_total := v_total + v_count;

    -- 4. Delete publisher_zman_events (cascades from publisher_zmanim)
    DELETE FROM publisher_zman_events
    WHERE publisher_zman_id IN (SELECT id FROM publisher_zmanim WHERE publisher_id = p_publisher_id);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_zman_events', v_count);
    v_total := v_total + v_count;

    -- 5. Delete publisher_zman_aliases (has direct publisher_id column)
    DELETE FROM publisher_zman_aliases WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_zman_aliases', v_count);
    v_total := v_total + v_count;

    -- 6. Delete publisher_zmanim records
    DELETE FROM publisher_zmanim WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_zmanim', v_count);
    v_total := v_total + v_count;

    -- 7. Delete publisher_coverage
    DELETE FROM publisher_coverage WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_coverage', v_count);
    v_total := v_total + v_count;

    -- 8. Delete publisher_location_overrides
    DELETE FROM publisher_location_overrides WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_location_overrides', v_count);
    v_total := v_total + v_count;

    -- 9. Delete publisher_snapshots
    DELETE FROM publisher_snapshots WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_snapshots', v_count);
    v_total := v_total + v_count;

    -- 10. Skip publisher_requests (signup requests, not linked to publisher_id)
    -- This table contains registration requests FROM people, not requests BY publishers
    -- No deletion needed here

    -- 11. Delete publisher_invitations
    DELETE FROM publisher_invitations WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_invitations', v_count);
    v_total := v_total + v_count;

    -- 12. Delete publisher_import_history
    DELETE FROM publisher_import_history WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_import_history', v_count);
    v_total := v_total + v_count;

    -- 13. Delete publisher_onboarding
    DELETE FROM publisher_onboarding WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publisher_onboarding', v_count);
    v_total := v_total + v_count;

    -- 14. Skip publisher_registration_tokens (registration/signup tokens, not linked to publisher_id)
    -- This table contains tokens for registering NEW publishers, not for existing publishers
    -- No deletion needed here

    -- 15. Delete location_correction_requests (requests FROM this publisher)
    DELETE FROM location_correction_requests WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('location_correction_requests', v_count);
    v_total := v_total + v_count;

    -- 16. Delete geo_locality_locations (publisher-specific coordinate overrides)
    DELETE FROM geo_locality_locations WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('geo_locality_locations', v_count);
    v_total := v_total + v_count;

    -- 17. Delete geo_locality_elevations (publisher-specific elevation overrides)
    DELETE FROM geo_locality_elevations WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('geo_locality_elevations', v_count);
    v_total := v_total + v_count;

    -- 18. Delete actions (audit trail)
    DELETE FROM actions WHERE publisher_id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('actions', v_count);
    v_total := v_total + v_count;

    -- 19. Finally, delete the publisher itself
    DELETE FROM publishers WHERE id = p_publisher_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('publishers', v_count);
    v_total := v_total + v_count;

    -- Add total count
    v_deleted_counts := v_deleted_counts || jsonb_build_object('total_records_deleted', v_total);

    RETURN v_deleted_counts;
END;
$$;


-- Name: FUNCTION hard_delete_publisher(p_publisher_id integer); Type: COMMENT; Schema: public; Owner: -

COMMENT ON FUNCTION public.hard_delete_publisher(p_publisher_id integer) IS 'Permanently deletes a publisher and ALL related data. IRREVERSIBLE. Returns JSON with deletion counts.';


-- Name: normalize_ascii(text); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.normalize_ascii(input text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
BEGIN
    -- Remove leading apostrophes ('Ain Defla -> Ain Defla)
    input := regexp_replace(input, '^''', '', 'g');

    -- Remove Arabic ʿayn character (ʿ)
    input := replace(input, 'ʿ', '');

    -- Use unaccent extension for standard diacritic removal (Aïn -> Ain)
    input := unaccent(input);

    -- Lowercase everything
    input := lower(input);

    -- Trim whitespace
    input := trim(input);

    RETURN input;
END;
$$;


-- Name: FUNCTION normalize_ascii(input text); Type: COMMENT; Schema: public; Owner: -

COMMENT ON FUNCTION public.normalize_ascii(input text) IS 'Normalizes text for search: removes leading apostrophes, Arabic ʿayn, diacritics, and lowercases';


-- Name: prune_publisher_snapshots(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.prune_publisher_snapshots() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM publisher_snapshots WHERE id IN (
        SELECT id FROM publisher_snapshots
        WHERE publisher_id = NEW.publisher_id
        ORDER BY created_at DESC OFFSET 20
    );
    RETURN NEW;
END;
$$;


-- Name: prune_zman_versions(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.prune_zman_versions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


-- Name: record_action(text, text, text, integer, uuid, text, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.record_action(p_action_type text, p_concept text, p_user_id text, p_publisher_id integer, p_request_id uuid, p_entity_type text, p_entity_id text, p_payload jsonb, p_parent_action_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_action_id uuid;
BEGIN
    INSERT INTO public.actions (
        action_type,
        concept,
        user_id,
        publisher_id,
        request_id,
        entity_type,
        entity_id,
        payload,
        parent_action_id,
        status
    ) VALUES (
        p_action_type,
        p_concept,
        p_user_id,
        p_publisher_id,
        p_request_id,
        p_entity_type,
        p_entity_id,
        p_payload,
        p_parent_action_id,
        'pending'
    ) RETURNING id INTO v_action_id;

    RETURN v_action_id;
END;
$$;


-- Name: refresh_coverage_search_mv(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.refresh_coverage_search_mv() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
END;
$$;


-- Name: refresh_geo_locations_view(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.refresh_geo_locations_view() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
END;
$$;


-- Name: refresh_geo_search_index(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.refresh_geo_search_index() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    locality_count BIGINT;
    region_count BIGINT;
BEGIN
    TRUNCATE geo_search_index;

    -- ==========================================
    -- PART 1: Index all LOCALITIES
    -- Resolves parent_overture_id to build hierarchy
    -- Prefers English names for display
    -- ==========================================
    INSERT INTO geo_search_index (
        entity_type, entity_id, locality_id, keywords, display_name, display_hierarchy, display_names,
        locality_type_id, direct_parent_type, direct_parent_id, inherited_region_id, hierarchy_path,
        country_id, continent_id, country_code, population, latitude, longitude, timezone
    )
    WITH RECURSIVE
    -- Build unified parent lookup: maps overture_id -> (entity_type, db_id, name)
    -- Note: .name field already contains English name (set during import)
    parent_lookup AS (
        SELECT l.overture_id, 'locality'::text as entity_type, l.id as entity_id, l.name
        FROM geo_localities l
        WHERE l.overture_id IS NOT NULL
        UNION ALL
        SELECT r.overture_id, 'region'::text as entity_type, r.id as entity_id, r.name
        FROM geo_regions r
        WHERE r.overture_id IS NOT NULL
        UNION ALL
        SELECT c.overture_id, 'country'::text as entity_type, c.id as entity_id, c.name
        FROM geo_countries c
        WHERE c.overture_id IS NOT NULL
    ),
    -- Resolve direct parent for each locality
    direct_parents AS (
        SELECT l.id as locality_id,
               pl.entity_type as direct_parent_type,
               pl.entity_id as direct_parent_id,
               pl.name as direct_parent_name
        FROM geo_localities l
        JOIN parent_lookup pl ON l.parent_overture_id = pl.overture_id
    ),
    -- Build full hierarchy chain by walking up parent_overture_id
    -- Note: .name fields already contain English names (set during import)
    hierarchy_chain AS (
        -- Base: start from each locality with its direct parent info
        SELECT
            l.id as root_id,
            l.id as current_id,
            'locality'::text as current_type,
            l.name as current_name,
            l.parent_overture_id,
            1 as depth,
            ARRAY[jsonb_build_object('type', 'locality', 'id', l.id, 'name', l.name)] as path,
            ARRAY[l.name] as display_path
        FROM geo_localities l

        UNION ALL

        -- Recursive: walk up to parent
        SELECT
            hc.root_id,
            pl.entity_id as current_id,
            pl.entity_type as current_type,
            pl.name as current_name,
            CASE
                WHEN pl.entity_type = 'locality' THEN (SELECT parent_overture_id FROM geo_localities WHERE id = pl.entity_id)
                WHEN pl.entity_type = 'region' THEN (SELECT r2.overture_id FROM geo_regions r2 WHERE r2.id = (SELECT parent_region_id FROM geo_regions WHERE id = pl.entity_id))
                ELSE NULL
            END as parent_overture_id,
            hc.depth + 1,
            hc.path || jsonb_build_object('type', pl.entity_type, 'id', pl.entity_id, 'name', pl.name),
            hc.display_path || pl.name
        FROM hierarchy_chain hc
        JOIN parent_lookup pl ON hc.parent_overture_id = pl.overture_id
        WHERE hc.depth < 15  -- Safety limit
    ),
    -- Get the deepest path for each locality (full hierarchy)
    full_hierarchy AS (
        SELECT DISTINCT ON (root_id)
            root_id,
            array_to_json(path)::jsonb as hierarchy_path,
            array_to_string(display_path, ', ') as display_chain,
            -- Extract first region from path (for inherited_region_id)
            (SELECT (elem->>'id')::integer
             FROM unnest(path) as elem
             WHERE elem->>'type' = 'region'
             LIMIT 1) as inherited_region_id
        FROM hierarchy_chain
        ORDER BY root_id, depth DESC
    ),
    -- Collect all names for keywords (keep all languages for searchability)
    locality_keywords AS (
        SELECT l.id, array_agg(DISTINCT lower(n.name)) FILTER (WHERE n.name IS NOT NULL) as names
        FROM geo_localities l
        LEFT JOIN geo_names n ON n.entity_type = 'locality' AND n.entity_id = l.id
        GROUP BY l.id
    ),
    -- Keywords from hierarchy chain (all ancestors)
    hierarchy_keywords AS (
        SELECT hc.root_id as locality_id,
               array_agg(DISTINCT lower(n.name)) FILTER (WHERE n.name IS NOT NULL) as names
        FROM hierarchy_chain hc
        JOIN geo_names n ON n.entity_type = hc.current_type AND n.entity_id = hc.current_id
        WHERE hc.depth > 1  -- Exclude self
        GROUP BY hc.root_id
    ),
    country_keywords AS (
        SELECT l.id as locality_id, array_agg(DISTINCT lower(n.name)) FILTER (WHERE n.name IS NOT NULL) as names
        FROM geo_localities l
        JOIN geo_names n ON n.entity_type = 'country' AND n.entity_id = l.country_id
        GROUP BY l.id
    )
    SELECT
        'locality'::varchar(20),
        l.id,
        l.id,
        -- Combine all keywords (keeps all languages for search)
        array_remove(
            COALESCE(lk.names, ARRAY[]::text[]) ||
            COALESCE(hk.names, ARRAY[]::text[]) ||
            COALESCE(ck.names, ARRAY[]::text[]) ||
            ARRAY[lower(l.name), lower(COALESCE(l.name_ascii, '')), lower(co.code)],
            NULL
        ),
        -- display_name: use .name directly (already English from import)
        l.name,
        -- display_hierarchy: use names from path + country name
        COALESCE(fh.display_chain, l.name) || ', ' || co.name,
        (SELECT jsonb_object_agg(n.language_code, n.name)
         FROM geo_names n WHERE n.entity_type = 'locality' AND n.entity_id = l.id),
        l.locality_type_id,
        dp.direct_parent_type,
        dp.direct_parent_id,
        fh.inherited_region_id,
        fh.hierarchy_path,
        l.country_id, l.continent_id,
        co.code, l.population::bigint, rc.latitude, rc.longitude, l.timezone
    FROM geo_localities l
    JOIN geo_countries co ON l.country_id = co.id
    LEFT JOIN geo_locality_resolved_coords rc ON rc.locality_id = l.id
    LEFT JOIN direct_parents dp ON dp.locality_id = l.id
    LEFT JOIN full_hierarchy fh ON fh.root_id = l.id
    LEFT JOIN locality_keywords lk ON lk.id = l.id
    LEFT JOIN hierarchy_keywords hk ON hk.locality_id = l.id
    LEFT JOIN country_keywords ck ON ck.locality_id = l.id;

    GET DIAGNOSTICS locality_count = ROW_COUNT;

    -- ==========================================
    -- PART 2: Index all REGIONS
    -- Note: .name fields already contain English names (set during import)
    -- ==========================================
    INSERT INTO geo_search_index (
        entity_type, entity_id, locality_id, keywords, display_name, display_hierarchy, display_names,
        locality_type_id, direct_parent_type, direct_parent_id, inherited_region_id, hierarchy_path,
        country_id, continent_id, country_code, population, latitude, longitude, timezone
    )
    WITH RECURSIVE
    -- Build region parent chain for hierarchy display
    region_hierarchy AS (
        SELECT r.id as root_id, r.id as current_id, r.parent_region_id, r.name, 1 as depth,
               ARRAY[jsonb_build_object('type', 'region', 'id', r.id, 'name', r.name)] as path,
               ARRAY[r.name] as display_path
        FROM geo_regions r
        UNION ALL
        SELECT rh.root_id, pr.id, pr.parent_region_id, pr.name, rh.depth + 1,
               rh.path || jsonb_build_object('type', 'region', 'id', pr.id, 'name', pr.name),
               rh.display_path || pr.name
        FROM region_hierarchy rh
        JOIN geo_regions pr ON rh.parent_region_id = pr.id
        WHERE rh.depth < 10
    ),
    -- Get deepest path per region
    full_region_hierarchy AS (
        SELECT DISTINCT ON (root_id)
            root_id,
            array_to_json(path)::jsonb as hierarchy_path,
            array_to_string(display_path, ', ') as display_chain
        FROM region_hierarchy
        ORDER BY root_id, depth DESC
    ),
    -- Collect all names for each region from geo_names (all languages for keywords)
    region_all_keywords AS (
        SELECT r.id, array_agg(DISTINCT lower(n.name)) FILTER (WHERE n.name IS NOT NULL) as names
        FROM geo_regions r
        LEFT JOIN geo_names n ON n.entity_type = 'region' AND n.entity_id = r.id
        GROUP BY r.id
    )
    SELECT
        'region'::varchar(20),
        r.id,
        NULL::integer,  -- locality_id is NULL for regions
        -- Keywords (all languages)
        array_remove(
            COALESCE(rk.names, ARRAY[]::text[]) ||
            ARRAY[lower(r.name), lower(co.code), lower(co.name)],
            NULL
        ),
        -- display_name: use .name directly (already English from import)
        r.name,
        -- display_hierarchy: region + parent regions + country
        frh.display_chain || ', ' || co.name,
        (SELECT jsonb_object_agg(n.language_code, n.name)
         FROM geo_names n WHERE n.entity_type = 'region' AND n.entity_id = r.id),
        NULL::smallint,  -- locality_type_id
        CASE WHEN r.parent_region_id IS NOT NULL THEN 'region' ELSE 'country' END,  -- direct_parent_type
        COALESCE(r.parent_region_id, r.country_id),  -- direct_parent_id
        r.id,  -- inherited_region_id (self for regions)
        frh.hierarchy_path,
        r.country_id,
        r.continent_id,
        co.code,
        r.population::bigint,
        NULL::double precision,
        NULL::double precision,
        NULL::text
    FROM geo_regions r
    JOIN geo_countries co ON r.country_id = co.id
    LEFT JOIN full_region_hierarchy frh ON frh.root_id = r.id
    LEFT JOIN region_all_keywords rk ON rk.id = r.id;

    GET DIAGNOSTICS region_count = ROW_COUNT;

    RAISE NOTICE 'Search index refreshed: % localities, % regions, % total rows',
        locality_count, region_count, (SELECT COUNT(*) FROM geo_search_index);
END;
$$;


-- Name: refresh_geo_search_index_fast(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.refresh_geo_search_index_fast() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    locality_count BIGINT;
    region_count BIGINT;
BEGIN
    -- Get total count
    SELECT COUNT(*) INTO locality_count FROM geo_localities;
    SELECT COUNT(*) INTO region_count FROM geo_regions;

    RAISE NOTICE 'Fast refresh starting: % localities, % regions', locality_count, region_count;

    TRUNCATE geo_search_index;

    -- ==========================================
    -- PART 1: Index all LOCALITIES (fast version)
    -- Note: .name fields already contain English names (set during import)
    -- ==========================================
    INSERT INTO geo_search_index (
        entity_type, entity_id, locality_id, keywords, display_name, display_hierarchy, display_names,
        locality_type_id, direct_parent_type, direct_parent_id, inherited_region_id, hierarchy_path,
        country_id, continent_id, country_code, population, latitude, longitude, timezone
    )
    WITH RECURSIVE
    -- Build unified parent lookup: maps overture_id -> (entity_type, db_id, name)
    parent_lookup AS (
        SELECT l.overture_id, 'locality'::text as entity_type, l.id as entity_id, l.name
        FROM geo_localities l
        WHERE l.overture_id IS NOT NULL
        UNION ALL
        SELECT r.overture_id, 'region'::text as entity_type, r.id as entity_id, r.name
        FROM geo_regions r
        WHERE r.overture_id IS NOT NULL
        UNION ALL
        SELECT c.overture_id, 'country'::text as entity_type, c.id as entity_id, c.name
        FROM geo_countries c
        WHERE c.overture_id IS NOT NULL
    ),
    -- Resolve direct parent for each locality
    direct_parents AS (
        SELECT l.id as locality_id,
               pl.entity_type as direct_parent_type,
               pl.entity_id as direct_parent_id
        FROM geo_localities l
        JOIN parent_lookup pl ON l.parent_overture_id = pl.overture_id
    ),
    -- Build hierarchy chain (simplified - just walk up to get names for display)
    hierarchy_chain AS (
        SELECT
            l.id as root_id,
            l.name as current_name,
            l.parent_overture_id,
            1 as depth,
            ARRAY[l.name] as display_path,
            ARRAY[jsonb_build_object('type', 'locality', 'id', l.id, 'name', l.name)] as path,
            NULL::integer as first_region_id
        FROM geo_localities l

        UNION ALL

        SELECT
            hc.root_id,
            pl.name,
            CASE
                WHEN pl.entity_type = 'locality' THEN (SELECT parent_overture_id FROM geo_localities WHERE id = pl.entity_id)
                WHEN pl.entity_type = 'region' THEN (SELECT r2.overture_id FROM geo_regions r2 WHERE r2.id = (SELECT parent_region_id FROM geo_regions WHERE id = pl.entity_id))
                ELSE NULL
            END,
            hc.depth + 1,
            hc.display_path || pl.name,
            hc.path || jsonb_build_object('type', pl.entity_type, 'id', pl.entity_id, 'name', pl.name),
            CASE
                WHEN hc.first_region_id IS NOT NULL THEN hc.first_region_id
                WHEN pl.entity_type = 'region' THEN pl.entity_id
                ELSE NULL
            END
        FROM hierarchy_chain hc
        JOIN parent_lookup pl ON hc.parent_overture_id = pl.overture_id
        WHERE hc.depth < 15
    ),
    -- Get deepest path per locality
    full_hierarchy AS (
        SELECT DISTINCT ON (root_id)
            root_id,
            array_to_string(display_path, ', ') as display_chain,
            array_to_json(path)::jsonb as hierarchy_path,
            first_region_id as inherited_region_id
        FROM hierarchy_chain
        ORDER BY root_id, depth DESC
    )
    SELECT
        'locality'::varchar(20),
        l.id,
        l.id,
        -- Simplified keywords: locality name + ascii + country code
        ARRAY[lower(l.name), lower(COALESCE(l.name_ascii, '')), lower(co.code)]::text[],
        -- display_name: use .name directly (already English from import)
        l.name,
        -- display_hierarchy: use names from path + country name
        COALESCE(fh.display_chain, l.name) || ', ' || co.name,
        NULL::jsonb,  -- Skip display_names for fast version
        l.locality_type_id,
        dp.direct_parent_type,
        dp.direct_parent_id,
        fh.inherited_region_id,
        fh.hierarchy_path,
        l.country_id, l.continent_id,
        co.code, l.population::bigint, rc.latitude, rc.longitude, l.timezone
    FROM geo_localities l
    JOIN geo_countries co ON l.country_id = co.id
    LEFT JOIN geo_locality_resolved_coords rc ON rc.locality_id = l.id
    LEFT JOIN direct_parents dp ON dp.locality_id = l.id
    LEFT JOIN full_hierarchy fh ON fh.root_id = l.id;

    GET DIAGNOSTICS locality_count = ROW_COUNT;

    -- ==========================================
    -- PART 2: Index all REGIONS (fast version)
    -- Note: .name fields already contain English names (set during import)
    -- ==========================================
    INSERT INTO geo_search_index (
        entity_type, entity_id, locality_id, keywords, display_name, display_hierarchy, display_names,
        locality_type_id, direct_parent_type, direct_parent_id, inherited_region_id, hierarchy_path,
        country_id, continent_id, country_code, population, latitude, longitude, timezone
    )
    WITH RECURSIVE
    -- Build region parent chain for hierarchy display
    region_hierarchy AS (
        SELECT r.id as root_id, r.id as current_id, r.parent_region_id, r.name, 1 as depth,
               ARRAY[r.name] as display_path,
               ARRAY[jsonb_build_object('type', 'region', 'id', r.id, 'name', r.name)] as path
        FROM geo_regions r
        UNION ALL
        SELECT rh.root_id, pr.id, pr.parent_region_id, pr.name, rh.depth + 1,
               rh.display_path || pr.name,
               rh.path || jsonb_build_object('type', 'region', 'id', pr.id, 'name', pr.name)
        FROM region_hierarchy rh
        JOIN geo_regions pr ON rh.parent_region_id = pr.id
        WHERE rh.depth < 10
    ),
    -- Get deepest path per region
    full_region_hierarchy AS (
        SELECT DISTINCT ON (root_id)
            root_id,
            array_to_string(display_path, ', ') as display_chain,
            array_to_json(path)::jsonb as hierarchy_path
        FROM region_hierarchy
        ORDER BY root_id, depth DESC
    )
    SELECT
        'region'::varchar(20),
        r.id,
        NULL::integer,
        -- Simplified keywords
        ARRAY[lower(r.name), lower(co.code), lower(co.name)]::text[],
        -- display_name: use .name directly (already English from import)
        r.name,
        -- display_hierarchy: use names from path + country
        frh.display_chain || ', ' || co.name,
        NULL::jsonb,
        NULL::smallint,
        CASE WHEN r.parent_region_id IS NOT NULL THEN 'region' ELSE 'country' END,
        COALESCE(r.parent_region_id, r.country_id),
        r.id,  -- inherited_region_id (self for regions)
        frh.hierarchy_path,
        r.country_id,
        r.continent_id,
        co.code,
        r.population::bigint,
        NULL::double precision,
        NULL::double precision,
        NULL::text
    FROM geo_regions r
    JOIN geo_countries co ON r.country_id = co.id
    LEFT JOIN full_region_hierarchy frh ON frh.root_id = r.id;

    GET DIAGNOSTICS region_count = ROW_COUNT;

    RAISE NOTICE 'Search index fast refresh complete: % localities, % regions, % total rows',
        locality_count, region_count, (SELECT COUNT(*) FROM geo_search_index);
END;
$$;


-- Name: trg_update_effective_city_elevation(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.trg_update_effective_city_elevation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Skip publisher overrides - they don't affect the global baseline
    IF NEW.source_id = 'publisher' THEN
        RETURN NEW;
    END IF;

    -- Update elevation_m on geo_cities from best source
    PERFORM update_effective_city_data(NEW.city_id);
    RETURN NEW;
END;
$$;


-- Name: trg_update_effective_geo_city_coordinates(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.trg_update_effective_geo_city_coordinates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Skip publisher overrides - they don't affect the global baseline
    IF NEW.source_id = 'publisher' THEN
        RETURN NEW;
    END IF;

    -- Update latitude/longitude on geo_cities from best source
    PERFORM update_effective_city_data(NEW.city_id);
    RETURN NEW;
END;
$$;


-- Name: update_effective_city_data(integer); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.update_effective_city_data(p_city_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_lat double precision;
    v_lng double precision;
    v_coord_source_id integer;
    v_elev integer;
    v_elev_source_id integer;
BEGIN
    -- Get best NON-PUBLISHER coordinates (community > simplemaps > wof)
    SELECT cc.latitude, cc.longitude, cc.source_id
    INTO v_lat, v_lng, v_coord_source_id
    FROM geo_city_coordinates cc
    JOIN geo_data_sources s ON s.id = cc.source_id
    WHERE cc.city_id = p_city_id
      AND s.is_active = true
      AND s.key != 'publisher'  -- Exclude publisher overrides
    ORDER BY s.priority, cc.verified_at DESC NULLS LAST
    LIMIT 1;

    -- Get best NON-PUBLISHER elevation for the best coordinate source
    SELECT ce.elevation_m, ce.source_id
    INTO v_elev, v_elev_source_id
    FROM geo_city_elevations ce
    JOIN geo_data_sources s ON s.id = ce.source_id
    WHERE ce.city_id = p_city_id
      AND s.is_active = true
      AND s.key != 'publisher'  -- Exclude publisher overrides
      AND (v_coord_source_id IS NULL OR ce.coordinate_source_id = v_coord_source_id)
    ORDER BY s.priority, ce.verified_at DESC NULLS LAST
    LIMIT 1;

    -- Update geo_cities latitude/longitude/elevation_m with best global (non-publisher) values
    -- Only update if we found a better source (don't overwrite with NULL)
    UPDATE geo_cities
    SET latitude = COALESCE(v_lat, latitude),
        longitude = COALESCE(v_lng, longitude),
        elevation_m = COALESCE(v_elev, elevation_m),
        coordinate_source_id = COALESCE(v_coord_source_id, coordinate_source_id),
        elevation_source_id = COALESCE(v_elev_source_id, elevation_source_id),
        updated_at = now()
    WHERE id = p_city_id;
END;
$$;


-- Name: update_embeddings_updated_at(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.update_embeddings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


-- Name: update_geo_updated_at(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.update_geo_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- Name: update_master_registry_updated_at(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.update_master_registry_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- Name: update_publisher_zman_day_types_updated_at(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.update_publisher_zman_day_types_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- Name: update_publisher_zman_events_updated_at(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.update_publisher_zman_events_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- Name: update_publisher_zmanim_updated_at(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.update_publisher_zmanim_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


-- Name: validate_all_city_hierarchies(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.validate_all_city_hierarchies() RETURNS TABLE(city_id integer, city_name text, error_type text, details text)
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


-- Name: validate_all_city_hierarchy(); Type: FUNCTION; Schema: public; Owner: -

CREATE FUNCTION public.validate_all_city_hierarchy() RETURNS TABLE(issue_type text, city_id integer, city_name text, details text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check 1: Cities missing country_id (no boundary contains them)
    RETURN QUERY
    SELECT
        'missing_country'::text,
        c.id,
        c.name,
        format('City at (%s, %s) has no country assigned and no boundary contains it',
               c.latitude::text, c.longitude::text)
    FROM geo_cities c
    WHERE c.country_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM geo_country_boundaries cb
        WHERE ST_Contains(cb.boundary::geometry, c.location::geometry)
      );

    -- Check 2: Region mismatches (assigned region != geographic region)
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

    -- Check 3: District mismatches (assigned district != geographic district)
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

    -- Check 4: Missing regions (country has_adm1 but city has no region)
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

    -- Check 5: Missing districts (country has_adm2, city has region but no district)
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


-- Name: FUNCTION validate_all_city_hierarchy(); Type: COMMENT; Schema: public; Owner: -

COMMENT ON FUNCTION public.validate_all_city_hierarchy() IS 'Validates city hierarchy completeness and correctness. Returns all cities with missing or mismatched hierarchy (country, region, district).';


-- Name: validate_all_district_hierarchies(); Type: FUNCTION; Schema: public; Owner: -

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


-- Name: validate_all_region_hierarchies(); Type: FUNCTION; Schema: public; Owner: -

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


SET default_tablespace = '';

SET default_table_access_method = heap;

-- Name: actions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_type character varying(50) NOT NULL,
    concept character varying(50) NOT NULL,
    user_id text,
    publisher_id integer,
    request_id uuid NOT NULL,
    parent_action_id uuid,
    entity_type character varying(50),
    entity_id text,
    payload jsonb,
    result jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    duration_ms integer,
    metadata jsonb
);


-- Name: ai_audit_logs; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.ai_audit_logs (
    id integer NOT NULL,
    publisher_id integer,
    user_id text,
    request_type character varying(50) NOT NULL,
    input_text text,
    output_text text,
    tokens_used integer DEFAULT 0,
    model character varying(100),
    confidence numeric(3,3),
    success boolean DEFAULT true,
    error_message text,
    duration_ms integer,
    rag_context_used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: ai_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.ai_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: ai_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.ai_audit_logs_id_seq OWNED BY public.ai_audit_logs.id;


-- Name: ai_content_sources; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.ai_content_sources (
    id smallint NOT NULL,
    key character varying(50) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: ai_content_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.ai_content_sources ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ai_content_sources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: ai_index_statuses; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.ai_index_statuses (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color character varying(7),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: ai_index_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.ai_index_statuses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ai_index_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: ai_indexes; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.ai_indexes (
    id integer NOT NULL,
    source_id smallint NOT NULL,
    total_chunks integer DEFAULT 0 NOT NULL,
    last_indexed_at timestamp with time zone,
    status_id smallint NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: ai_indexes_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.ai_indexes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: ai_indexes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.ai_indexes_id_seq OWNED BY public.ai_indexes.id;


-- Name: algorithm_rollback_audit; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.algorithm_rollback_audit (
    id integer NOT NULL,
    algorithm_id integer NOT NULL,
    source_version integer NOT NULL,
    target_version integer NOT NULL,
    new_version integer NOT NULL,
    reason text,
    rolled_back_by text,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: algorithm_rollback_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.algorithm_rollback_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: algorithm_rollback_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.algorithm_rollback_audit_id_seq OWNED BY public.algorithm_rollback_audit.id;


-- Name: algorithm_statuses; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.algorithm_statuses (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color character varying(7),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: algorithm_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.algorithm_statuses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.algorithm_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: algorithm_templates; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.algorithm_templates (
    id integer NOT NULL,
    template_key text NOT NULL,
    name text NOT NULL,
    description text,
    configuration jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: algorithm_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.algorithm_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: algorithm_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.algorithm_templates_id_seq OWNED BY public.algorithm_templates.id;


-- Name: algorithm_version_history; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.algorithm_version_history (
    id integer NOT NULL,
    algorithm_id integer NOT NULL,
    version_number integer NOT NULL,
    status text NOT NULL,
    description text,
    config_snapshot jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    published_at timestamp with time zone
);


-- Name: algorithm_version_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.algorithm_version_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: algorithm_version_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.algorithm_version_history_id_seq OWNED BY public.algorithm_version_history.id;


-- Name: algorithms; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.algorithms (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    name text NOT NULL,
    description text,
    configuration jsonb,
    status_id smallint,
    is_public boolean DEFAULT false,
    forked_from integer,
    attribution_text text,
    fork_count integer DEFAULT 0,
    created_by_action_id uuid,
    updated_by_action_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


-- Name: algorithms_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.algorithms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: algorithms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.algorithms_id_seq OWNED BY public.algorithms.id;


-- Name: astronomical_primitives; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.astronomical_primitives (
    id integer NOT NULL,
    variable_name character varying(50) NOT NULL,
    display_name text NOT NULL,
    description text,
    formula_dsl text NOT NULL,
    category_id smallint NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


-- Name: astronomical_primitives_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.astronomical_primitives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: astronomical_primitives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.astronomical_primitives_id_seq OWNED BY public.astronomical_primitives.id;


-- Name: blocked_emails; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.blocked_emails (
    id integer NOT NULL,
    email text NOT NULL,
    blocked_by text NOT NULL,
    blocked_at timestamp with time zone DEFAULT now(),
    reason text
);


-- Name: TABLE blocked_emails; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.blocked_emails IS 'Permanently blocked email addresses. Submissions silently ignored.';


-- Name: COLUMN blocked_emails.blocked_by; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.blocked_emails.blocked_by IS 'Admin clerk_user_id who blocked the email';


-- Name: COLUMN blocked_emails.reason; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.blocked_emails.reason IS 'Optional note explaining why email was blocked';


-- Name: blocked_emails_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.blocked_emails_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: blocked_emails_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.blocked_emails_id_seq OWNED BY public.blocked_emails.id;


-- Name: calculation_logs; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.calculation_logs (
    id bigint NOT NULL,
    publisher_id integer NOT NULL,
    city_id bigint NOT NULL,
    date_calculated date NOT NULL,
    cache_hit boolean DEFAULT false NOT NULL,
    response_time_ms smallint,
    zman_count smallint,
    source smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: TABLE calculation_logs; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.calculation_logs IS 'Records all zmanim calculation requests for analytics. Optimized for high-volume inserts using batch COPY protocol.';


-- Name: COLUMN calculation_logs.cache_hit; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.calculation_logs.cache_hit IS 'Whether result was served from Redis cache';


-- Name: COLUMN calculation_logs.response_time_ms; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.calculation_logs.response_time_ms IS 'Total calculation time in milliseconds (includes cache lookup)';


-- Name: COLUMN calculation_logs.source; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.calculation_logs.source IS 'Request source: 1=web UI, 2=authenticated API, 3=external API (M2M)';


-- Name: calculation_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.calculation_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: calculation_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.calculation_logs_id_seq OWNED BY public.calculation_logs.id;


-- Name: calculation_stats_daily; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.calculation_stats_daily (
    publisher_id integer NOT NULL,
    date date NOT NULL,
    total_calculations integer DEFAULT 0 NOT NULL,
    cache_hits integer DEFAULT 0 NOT NULL,
    total_response_time_ms bigint DEFAULT 0 NOT NULL,
    source_web integer DEFAULT 0 NOT NULL,
    source_api integer DEFAULT 0 NOT NULL,
    source_external integer DEFAULT 0 NOT NULL
);


-- Name: TABLE calculation_stats_daily; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.calculation_stats_daily IS 'Pre-aggregated daily statistics for fast dashboard queries. Updated by daily rollup job.';


-- Name: COLUMN calculation_stats_daily.total_response_time_ms; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.calculation_stats_daily.total_response_time_ms IS 'Sum of all response times for average calculation';


-- Name: calculation_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.calculation_types (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: calculation_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.calculation_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.calculation_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: correction_request_history; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.correction_request_history (
    id integer NOT NULL,
    correction_request_id integer NOT NULL,
    locality_id integer NOT NULL,
    action character varying(20) NOT NULL,
    performed_by text NOT NULL,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    previous_latitude double precision,
    previous_longitude double precision,
    previous_elevation integer,
    new_latitude double precision,
    new_longitude double precision,
    new_elevation integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: TABLE correction_request_history; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.correction_request_history IS 'Audit trail for all correction request actions (approve, reject, revert)';


-- Name: correction_request_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.correction_request_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: correction_request_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.correction_request_history_id_seq OWNED BY public.correction_request_history.id;


-- Name: coverage_levels; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.coverage_levels (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    sort_order smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: coverage_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.coverage_levels ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.coverage_levels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: data_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.data_types (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: data_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.data_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.data_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: day_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.day_types (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    parent_id integer,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: day_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.day_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: day_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.day_types_id_seq OWNED BY public.day_types.id;


-- Name: display_groups; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.display_groups (
    id integer NOT NULL,
    key character varying(50) NOT NULL,
    display_name_hebrew character varying(100) NOT NULL,
    display_name_english character varying(100) NOT NULL,
    description character varying(255),
    icon_name character varying(50),
    color character varying(50),
    sort_order integer NOT NULL,
    time_categories text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: display_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.display_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: display_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.display_groups_id_seq OWNED BY public.display_groups.id;


-- Name: edge_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.edge_types (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: edge_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.edge_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.edge_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: embeddings; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.embeddings (
    id integer NOT NULL,
    source_id smallint NOT NULL,
    content_type character varying(50) NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


-- Name: embeddings_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.embeddings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: embeddings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.embeddings_id_seq OWNED BY public.embeddings.id;


-- Name: event_categories; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.event_categories (
    id integer NOT NULL,
    key character varying(50) NOT NULL,
    display_name_hebrew character varying(100) NOT NULL,
    display_name_english character varying(100) NOT NULL,
    description character varying(255),
    icon_name character varying(50),
    color character varying(50),
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: event_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.event_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: event_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.event_categories_id_seq OWNED BY public.event_categories.id;


-- Name: explanation_cache; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.explanation_cache (
    id integer NOT NULL,
    formula_hash character varying(32) NOT NULL,
    language character varying(10) DEFAULT 'mixed'::character varying NOT NULL,
    explanation text NOT NULL,
    source_id smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


-- Name: explanation_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.explanation_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: explanation_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.explanation_cache_id_seq OWNED BY public.explanation_cache.id;


-- Name: explanation_sources; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.explanation_sources (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: explanation_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.explanation_sources ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.explanation_sources_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: fast_start_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.fast_start_types (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: fast_start_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.fast_start_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.fast_start_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: geo_cities_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.geo_cities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: geo_continents_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.geo_continents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: geo_continents; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_continents (
    id smallint DEFAULT nextval('public.geo_continents_id_seq'::regclass) NOT NULL,
    code character varying(2) NOT NULL,
    name text NOT NULL,
    source_ref text,
    source_id integer
);


-- Name: COLUMN geo_continents.source_ref; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_continents.source_ref IS 'External ID from the source system';


-- Name: COLUMN geo_continents.source_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_continents.source_id IS 'FK to geo_data_sources - identifies where this data came from';


-- Name: geo_countries; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_countries (
    id smallint NOT NULL,
    code character varying(2) NOT NULL,
    code_iso3 character varying(3),
    name text NOT NULL,
    continent_id smallint NOT NULL,
    adm1_label text DEFAULT 'Region'::text,
    adm2_label text DEFAULT 'District'::text,
    has_adm1 boolean DEFAULT true,
    has_adm2 boolean DEFAULT false,
    is_city_state boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    source_ref text,
    source_id integer,
    hierarchy_inconsistent boolean DEFAULT false,
    boundary public.geometry(MultiPolygon,4326),
    overture_id text
);


-- Name: COLUMN geo_countries.source_ref; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_countries.source_ref IS 'External ID from the source system';


-- Name: COLUMN geo_countries.source_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_countries.source_id IS 'FK to geo_data_sources - identifies where this data came from';


-- Name: COLUMN geo_countries.boundary; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_countries.boundary IS 'Polygon boundary from Overture division_area.parquet (optional)';


-- Name: geo_countries_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.geo_countries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_countries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: geo_data_sources; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_data_sources (
    id integer NOT NULL,
    key character varying(20) NOT NULL,
    name text NOT NULL,
    description text,
    data_type_id smallint NOT NULL,
    priority smallint NOT NULL,
    default_accuracy_m integer,
    attribution text,
    url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: geo_data_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.geo_data_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: geo_data_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.geo_data_sources_id_seq OWNED BY public.geo_data_sources.id;


-- Name: geo_localities; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_localities (
    id integer NOT NULL,
    parent_overture_id text,
    locality_type_id smallint,
    name text NOT NULL,
    name_ascii text,
    timezone text NOT NULL,
    population integer,
    continent_id smallint,
    country_id smallint,
    source_id integer,
    overture_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    boundary public.geometry(MultiPolygon,4326)
);


-- Name: TABLE geo_localities; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.geo_localities IS 'Localities (cities, towns, villages, neighborhoods) from Overture Maps. Point geometry only with flexible hierarchy support.';


-- Name: COLUMN geo_localities.boundary; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_localities.boundary IS 'Polygon boundary from Overture division_area.parquet (optional)';


-- Name: geo_localities_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.geo_localities ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_localities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: geo_locality_elevations; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_locality_elevations (
    id integer NOT NULL,
    locality_id integer NOT NULL,
    publisher_id integer,
    source_id integer NOT NULL,
    elevation_m integer NOT NULL,
    accuracy_m integer,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text
);


-- Name: TABLE geo_locality_elevations; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.geo_locality_elevations IS 'Locality elevation data with hierarchical override support. Resolution: publisher > admin > default (glo90)';


-- Name: COLUMN geo_locality_elevations.publisher_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_locality_elevations.publisher_id IS 'NULL for system-wide records (admin override or default source)';


-- Name: COLUMN geo_locality_elevations.created_by; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_locality_elevations.created_by IS 'Clerk user ID who created the record';


-- Name: geo_locality_elevations_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.geo_locality_elevations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_locality_elevations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: geo_locality_locations; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_locality_locations (
    id integer NOT NULL,
    locality_id integer NOT NULL,
    publisher_id integer,
    source_id integer NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    location public.geography(Point,4326) GENERATED ALWAYS AS ((public.st_setsrid(public.st_makepoint(longitude, latitude), 4326))::public.geography) STORED,
    accuracy_m integer,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    CONSTRAINT geo_locality_locations_latitude_check CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT geo_locality_locations_longitude_check CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))
);


-- Name: TABLE geo_locality_locations; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.geo_locality_locations IS 'Locality coordinates with hierarchical override support. Resolution: publisher > admin > default (overture)';


-- Name: COLUMN geo_locality_locations.publisher_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_locality_locations.publisher_id IS 'NULL for system-wide records (admin override or default source)';


-- Name: COLUMN geo_locality_locations.created_by; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_locality_locations.created_by IS 'Clerk user ID who created the record';


-- Name: geo_locality_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.geo_locality_locations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_locality_locations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: geo_locality_resolved_coords; Type: VIEW; Schema: public; Owner: -

CREATE VIEW public.geo_locality_resolved_coords AS
 WITH best_coords AS (
         SELECT DISTINCT ON (ll.locality_id) ll.locality_id,
            ll.latitude,
            ll.longitude,
            ll.location,
            ll.source_id AS coordinate_source_id,
            ds.key AS coordinate_source_key
           FROM (public.geo_locality_locations ll
             JOIN public.geo_data_sources ds ON (((ds.id = ll.source_id) AND (ds.is_active = true))))
          WHERE (ll.publisher_id IS NULL)
          ORDER BY ll.locality_id,
                CASE ds.key
                    WHEN 'admin'::text THEN 1
                    ELSE 2
                END, ds.priority
        ), best_elevs AS (
         SELECT DISTINCT ON (le.locality_id) le.locality_id,
            le.elevation_m,
            le.source_id AS elevation_source_id,
            ds.key AS elevation_source_key
           FROM (public.geo_locality_elevations le
             JOIN public.geo_data_sources ds ON (((ds.id = le.source_id) AND (ds.is_active = true))))
          WHERE (le.publisher_id IS NULL)
          ORDER BY le.locality_id,
                CASE ds.key
                    WHEN 'admin'::text THEN 1
                    ELSE 2
                END, ds.priority
        )
 SELECT l.id AS locality_id,
    l.name,
    l.timezone,
    bc.latitude,
    bc.longitude,
    bc.location,
    bc.coordinate_source_id,
    bc.coordinate_source_key,
    be.elevation_m,
    be.elevation_source_id,
    be.elevation_source_key
   FROM ((public.geo_localities l
     LEFT JOIN best_coords bc ON ((bc.locality_id = l.id)))
     LEFT JOIN best_elevs be ON ((be.locality_id = l.id)));


-- Name: VIEW geo_locality_resolved_coords; Type: COMMENT; Schema: public; Owner: -

COMMENT ON VIEW public.geo_locality_resolved_coords IS 'Best system-wide coordinates for each locality (admin > default). For publisher-specific resolution use get_effective_locality_location() function.';


-- Name: geo_locality_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_locality_types (
    id smallint NOT NULL,
    code character varying(20) NOT NULL,
    name text NOT NULL,
    overture_subtype character varying(30),
    sort_order smallint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: TABLE geo_locality_types; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.geo_locality_types IS 'Lookup table for locality types from Overture divisions (city, town, village, etc.)';


-- Name: geo_locality_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.geo_locality_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_locality_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: geo_names; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_names (
    id integer NOT NULL,
    entity_id integer NOT NULL,
    language_code character varying(3) NOT NULL,
    name text NOT NULL,
    is_preferred boolean DEFAULT true,
    source_id integer,
    created_at timestamp with time zone DEFAULT now(),
    entity_type character varying(20),
    name_type character varying(20) DEFAULT 'primary'::character varying
);


-- Name: geo_names_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.geo_names ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_names_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: geo_region_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_region_types (
    id smallint NOT NULL,
    code character varying(20) NOT NULL,
    name text NOT NULL,
    overture_subtype character varying(30),
    sort_order smallint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: TABLE geo_region_types; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.geo_region_types IS 'Lookup table for region types from Overture divisions (region, county, localadmin, etc.)';


-- Name: geo_region_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.geo_region_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_region_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: geo_regions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_regions (
    id integer NOT NULL,
    country_id smallint,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    continent_id smallint,
    source_ref text,
    source_id integer,
    hierarchy_inconsistent boolean DEFAULT false,
    parent_region_id integer,
    region_type_id smallint,
    population bigint,
    overture_id text,
    boundary public.geometry(MultiPolygon,4326)
);


-- Name: COLUMN geo_regions.source_ref; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_regions.source_ref IS 'External ID from the source system';


-- Name: COLUMN geo_regions.source_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_regions.source_id IS 'FK to geo_data_sources - identifies where this data came from';


-- Name: COLUMN geo_regions.hierarchy_inconsistent; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_regions.hierarchy_inconsistent IS 'True when boundary-based hierarchy cannot be reliably determined (no boundary, disputed territory, no containing country)';


-- Name: COLUMN geo_regions.boundary; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.geo_regions.boundary IS 'Polygon boundary from Overture division_area.parquet (optional)';


-- Name: geo_regions_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.geo_regions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_regions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: geo_search_index; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_search_index (
    entity_type character varying(20) NOT NULL,
    entity_id integer NOT NULL,
    entity_subtype character varying(30),
    locality_id integer,
    keywords text[] NOT NULL,
    display_name text NOT NULL,
    display_hierarchy text NOT NULL,
    display_names jsonb,
    locality_type_id smallint,
    direct_parent_type character varying(20),
    direct_parent_id integer,
    inherited_region_id integer,
    hierarchy_path jsonb,
    country_id smallint,
    continent_id smallint,
    country_code character varying(2),
    population bigint,
    latitude double precision,
    longitude double precision,
    timezone text,
    descendant_count integer DEFAULT 0,
    direct_child_count integer DEFAULT 0,
    has_children boolean DEFAULT false,
    ancestor_region_ids integer[]
);


-- Name: TABLE geo_search_index; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.geo_search_index IS 'Denormalized search index with keywords from all languages for fast multi-entity geographic search';


-- Name: geo_search_index_test; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.geo_search_index_test (
    entity_type character varying(20),
    entity_id integer,
    entity_subtype character varying(30),
    locality_id integer,
    keywords text[],
    display_name text,
    display_hierarchy text,
    display_names jsonb,
    locality_type_id smallint,
    direct_parent_type character varying(20),
    direct_parent_id integer,
    inherited_region_id integer,
    hierarchy_path jsonb,
    country_id smallint,
    continent_id smallint,
    country_code character varying(2),
    population bigint,
    latitude double precision,
    longitude double precision,
    timezone text,
    descendant_count integer,
    direct_child_count integer,
    has_children boolean
);


-- Name: jewish_event_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.jewish_event_types (
    id smallint NOT NULL,
    key character varying(30) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: jewish_event_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.jewish_event_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.jewish_event_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: jewish_events; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.jewish_events (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name_hebrew text NOT NULL,
    name_english text NOT NULL,
    event_type_id smallint NOT NULL,
    duration_days_israel integer DEFAULT 1,
    duration_days_diaspora integer DEFAULT 1,
    fast_start_type_id smallint,
    parent_event_id integer,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: jewish_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.jewish_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: jewish_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.jewish_events_id_seq OWNED BY public.jewish_events.id;


-- Name: languages; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.languages (
    code character varying(3) NOT NULL,
    name text NOT NULL,
    native_name text,
    script character varying(4),
    direction character varying(3) DEFAULT 'ltr'::character varying,
    is_active boolean DEFAULT true
);


-- Name: location_correction_requests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.location_correction_requests (
    id integer NOT NULL,
    publisher_id integer,
    requester_email text NOT NULL,
    requester_name text,
    proposed_latitude double precision,
    proposed_longitude double precision,
    proposed_elevation integer,
    correction_reason text NOT NULL,
    evidence_urls text[],
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    locality_id integer,
    approved_at timestamp with time zone,
    reverted_at timestamp with time zone,
    reverted_by text,
    revert_reason text,
    CONSTRAINT at_least_one_proposed_value CHECK (((proposed_latitude IS NOT NULL) OR (proposed_longitude IS NOT NULL) OR (proposed_elevation IS NOT NULL))),
    CONSTRAINT location_correction_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'reverted'::text])))
);


-- Name: TABLE location_correction_requests; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.location_correction_requests IS 'Community-submitted corrections to global locality data';


-- Name: COLUMN location_correction_requests.publisher_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.location_correction_requests.publisher_id IS 'Publisher who submitted the request (nullable for anonymous)';


-- Name: COLUMN location_correction_requests.requester_email; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.location_correction_requests.requester_email IS 'Email of the person who submitted the request';


-- Name: COLUMN location_correction_requests.correction_reason; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.location_correction_requests.correction_reason IS 'Explanation of why the correction is needed';


-- Name: COLUMN location_correction_requests.evidence_urls; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.location_correction_requests.evidence_urls IS 'Links to supporting evidence (surveys, official sources, etc.)';


-- Name: COLUMN location_correction_requests.reviewed_by; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.location_correction_requests.reviewed_by IS 'Clerk user ID of admin who reviewed the request';


-- Name: COLUMN location_correction_requests.approved_at; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.location_correction_requests.approved_at IS 'Timestamp when correction was approved (for quick filtering)';


-- Name: COLUMN location_correction_requests.reverted_at; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.location_correction_requests.reverted_at IS 'Timestamp when correction was reverted';


-- Name: COLUMN location_correction_requests.reverted_by; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.location_correction_requests.reverted_by IS 'User ID who reverted the correction';


-- Name: COLUMN location_correction_requests.revert_reason; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.location_correction_requests.revert_reason IS 'Reason for reverting the correction';


-- Name: location_correction_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.location_correction_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: location_correction_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.location_correction_requests_id_seq OWNED BY public.location_correction_requests.id;


-- Name: master_zman_day_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.master_zman_day_types (
    id integer NOT NULL,
    master_zman_id integer,
    day_type_id integer
);


-- Name: master_zman_day_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.master_zman_day_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: master_zman_day_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.master_zman_day_types_id_seq OWNED BY public.master_zman_day_types.id;


-- Name: master_zman_events; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.master_zman_events (
    id integer NOT NULL,
    master_zman_id integer,
    jewish_event_id integer
);


-- Name: master_zman_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.master_zman_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: master_zman_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.master_zman_events_id_seq OWNED BY public.master_zman_events.id;


-- Name: master_zman_tags; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.master_zman_tags (
    master_zman_id integer NOT NULL,
    tag_id integer NOT NULL,
    is_negated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: master_zmanim_registry; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.master_zmanim_registry (
    id integer NOT NULL,
    zman_key character varying(100) NOT NULL,
    canonical_hebrew_name text NOT NULL,
    canonical_english_name text NOT NULL,
    transliteration text,
    description text,
    halachic_source text,
    halachic_notes text,
    time_category_id integer,
    default_formula_dsl text,
    is_hidden boolean DEFAULT false NOT NULL,
    is_core boolean DEFAULT false,
    aliases text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    full_description text,
    formula_explanation text,
    usage_context text,
    related_zmanim_ids integer[],
    shita character varying(50),
    category character varying(50),
    CONSTRAINT master_zmanim_registry_category_check CHECK (((category IS NULL) OR ((category)::text = ANY (ARRAY[('ALOS'::character varying)::text, ('MISHEYAKIR'::character varying)::text, ('SHEMA'::character varying)::text, ('TEFILLA'::character varying)::text, ('CHATZOS'::character varying)::text, ('MINCHA'::character varying)::text, ('PLAG'::character varying)::text, ('SHKIA'::character varying)::text, ('BEIN_HASHMASHOS'::character varying)::text, ('TZAIS'::character varying)::text, ('CANDLE_LIGHTING'::character varying)::text, ('SPECIAL'::character varying)::text, ('OTHER'::character varying)::text])))),
    CONSTRAINT master_zmanim_registry_shita_check CHECK (((shita IS NULL) OR ((shita)::text = ANY (ARRAY[('GRA'::character varying)::text, ('MGA'::character varying)::text, ('BAAL_HATANYA'::character varying)::text, ('RABBEINU_TAM'::character varying)::text, ('GEONIM'::character varying)::text, ('ATERET_TORAH'::character varying)::text, ('YEREIM'::character varying)::text, ('AHAVAT_SHALOM'::character varying)::text, ('UNIVERSAL'::character varying)::text]))))
);


-- Name: TABLE master_zmanim_registry; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.master_zmanim_registry IS 'Master registry of zmanim with full documentation. Last updated: 2025-12-22 with ALOS category backfill.';


-- Name: COLUMN master_zmanim_registry.halachic_source; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.master_zmanim_registry.halachic_source IS 'Primary halachic sources and authorities for this calculation method. References to Shulchan Aruch, poskim, and KosherJava documentation.';


-- Name: COLUMN master_zmanim_registry.full_description; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.master_zmanim_registry.full_description IS 'Comprehensive description of this zman, including halachic context and usage. Derived from KosherJava library documentation.';


-- Name: COLUMN master_zmanim_registry.formula_explanation; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.master_zmanim_registry.formula_explanation IS 'Plain-language explanation of how the default_formula_dsl calculates this zman. Helps users understand the calculation methodology.';


-- Name: COLUMN master_zmanim_registry.usage_context; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.master_zmanim_registry.usage_context IS 'When and how to use this zman. Describes practical applications, which communities use it, and any caveats.';


-- Name: COLUMN master_zmanim_registry.related_zmanim_ids; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.master_zmanim_registry.related_zmanim_ids IS 'Array of master_zmanim_registry IDs that are related to this zman (e.g., same zman with different calculation methods).';


-- Name: COLUMN master_zmanim_registry.shita; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.master_zmanim_registry.shita IS 'Primary halachic opinion (shita) for this zman. Values: GRA, MGA, BAAL_HATANYA, RABBEINU_TAM, GEONIM, ATERET_TORAH, YEREIM, UNIVERSAL';


-- Name: COLUMN master_zmanim_registry.category; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.master_zmanim_registry.category IS 'Time category for UI grouping. Values: ALOS, MISHEYAKIR, SHEMA, TEFILLA, CHATZOS, MINCHA, PLAG, SHKIA, BEIN_HASHMASHOS, TZAIS, CANDLE_LIGHTING, SPECIAL, OTHER';


-- Name: master_zmanim_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.master_zmanim_registry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: master_zmanim_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.master_zmanim_registry_id_seq OWNED BY public.master_zmanim_registry.id;


-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


-- Name: primitive_categories; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.primitive_categories (
    id smallint NOT NULL,
    key character varying(50) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: primitive_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.primitive_categories ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.primitive_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: publisher_coverage; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_coverage (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    coverage_level_id smallint NOT NULL,
    region_id integer,
    country_id smallint,
    continent_id smallint,
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0,
    geo_location_id uuid,
    created_by_action_id uuid,
    updated_by_action_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    locality_id integer
);


-- Name: publisher_coverage_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_coverage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_coverage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_coverage_id_seq OWNED BY public.publisher_coverage.id;


-- Name: publisher_import_history; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_import_history (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    imported_by character varying(255) NOT NULL,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    format_type character varying(50) NOT NULL,
    format_version integer NOT NULL,
    source_publisher_id integer,
    zmanim_created integer DEFAULT 0 NOT NULL,
    zmanim_updated integer DEFAULT 0 NOT NULL,
    zmanim_unchanged integer DEFAULT 0 NOT NULL,
    zmanim_not_in_import integer DEFAULT 0 NOT NULL,
    coverage_created integer DEFAULT 0,
    coverage_updated integer DEFAULT 0,
    profile_updated boolean DEFAULT false,
    import_summary jsonb
);


-- Name: publisher_import_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_import_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_import_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_import_history_id_seq OWNED BY public.publisher_import_history.id;


-- Name: publisher_invitations; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_invitations (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    email text NOT NULL,
    role_id smallint NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    invited_by text NOT NULL,
    status text DEFAULT 'pending'::text,
    accepted_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


-- Name: COLUMN publisher_invitations.invited_by; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_invitations.invited_by IS 'Clerk user ID of person who created invitation';


-- Name: COLUMN publisher_invitations.status; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_invitations.status IS 'Invitation state: pending, accepted, expired, cancelled';


-- Name: COLUMN publisher_invitations.accepted_at; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_invitations.accepted_at IS 'Timestamp when invitation was accepted (NULL = not accepted)';


-- Name: COLUMN publisher_invitations.updated_at; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_invitations.updated_at IS 'Timestamp of last update';


-- Name: publisher_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_invitations_id_seq OWNED BY public.publisher_invitations.id;


-- Name: publisher_location_overrides; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_location_overrides (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    override_latitude double precision,
    override_longitude double precision,
    override_elevation integer,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    locality_id integer
);


-- Name: TABLE publisher_location_overrides; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.publisher_location_overrides IS 'Publisher-specific location data overrides (lat/lon/elevation only) for accurate zmanim calculations';


-- Name: COLUMN publisher_location_overrides.override_latitude; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_location_overrides.override_latitude IS 'Override latitude in decimal degrees (-90 to 90)';


-- Name: COLUMN publisher_location_overrides.override_longitude; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_location_overrides.override_longitude IS 'Override longitude in decimal degrees (-180 to 180)';


-- Name: COLUMN publisher_location_overrides.override_elevation; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_location_overrides.override_elevation IS 'Override elevation in meters';


-- Name: COLUMN publisher_location_overrides.reason; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_location_overrides.reason IS 'Optional explanation for the override';


-- Name: publisher_location_overrides_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_location_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_location_overrides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_location_overrides_id_seq OWNED BY public.publisher_location_overrides.id;


-- Name: publisher_onboarding; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_onboarding (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    profile_complete boolean DEFAULT false,
    algorithm_selected boolean DEFAULT false,
    zmanim_configured boolean DEFAULT false,
    coverage_set boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


-- Name: publisher_onboarding_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_onboarding_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_onboarding_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_onboarding_id_seq OWNED BY public.publisher_onboarding.id;


-- Name: publisher_registration_tokens; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_registration_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    registrant_email text NOT NULL,
    publisher_data jsonb NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    user_exists boolean,
    verified_at timestamp with time zone,
    completed_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    first_name text,
    last_name text,
    existing_clerk_user_id text,
    confirmed_existing_user boolean DEFAULT false,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    rejection_message text,
    recaptcha_score numeric(3,2)
);


-- Name: TABLE publisher_registration_tokens; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.publisher_registration_tokens IS 'Email verification tokens for publisher registration. Unverified requests do NOT appear in admin queue.';


-- Name: COLUMN publisher_registration_tokens.publisher_data; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.publisher_data IS 'JSON with publisher_name, publisher_contact_email, publisher_description';


-- Name: COLUMN publisher_registration_tokens.user_exists; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.user_exists IS 'Server-side only flag. NEVER expose to public API (prevents user enumeration attacks).';


-- Name: COLUMN publisher_registration_tokens.first_name; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.first_name IS 'Applicant first name';


-- Name: COLUMN publisher_registration_tokens.last_name; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.last_name IS 'Applicant last name';


-- Name: COLUMN publisher_registration_tokens.existing_clerk_user_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.existing_clerk_user_id IS 'Set if email matches existing Clerk user (server-side only)';


-- Name: COLUMN publisher_registration_tokens.confirmed_existing_user; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.confirmed_existing_user IS 'True if user confirmed "Yes, that is me" on verification page';


-- Name: COLUMN publisher_registration_tokens.reviewed_by; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.reviewed_by IS 'Admin clerk_user_id who reviewed the application';


-- Name: COLUMN publisher_registration_tokens.reviewed_at; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.reviewed_at IS 'Timestamp of admin review';


-- Name: COLUMN publisher_registration_tokens.rejection_message; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.rejection_message IS 'Admin-provided rejection reason';


-- Name: COLUMN publisher_registration_tokens.recaptcha_score; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_registration_tokens.recaptcha_score IS 'reCAPTCHA v3 score (0.0-1.0) for audit purposes';


-- Name: publisher_requests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_requests (
    id integer NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    organization text,
    message text,
    status_id smallint NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: publisher_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_requests_id_seq OWNED BY public.publisher_requests.id;


-- Name: publisher_roles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_roles (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    permissions jsonb,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: publisher_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.publisher_roles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.publisher_roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: publisher_snapshots; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_snapshots (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    description text,
    snapshot_data jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: publisher_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_snapshots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_snapshots_id_seq OWNED BY public.publisher_snapshots.id;


-- Name: publisher_statuses; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_statuses (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color character varying(7),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: publisher_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.publisher_statuses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.publisher_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- Name: publisher_zman_aliases; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_zman_aliases (
    id integer NOT NULL,
    publisher_zman_id integer NOT NULL,
    publisher_id integer NOT NULL,
    alias_hebrew text NOT NULL,
    alias_english text,
    alias_transliteration text,
    context character varying(100),
    is_primary boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: publisher_zman_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_zman_aliases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_zman_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_zman_aliases_id_seq OWNED BY public.publisher_zman_aliases.id;


-- Name: publisher_zman_day_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_zman_day_types (
    publisher_zman_id integer NOT NULL,
    day_type_id integer NOT NULL,
    override_formula_dsl text,
    override_hebrew_name text,
    override_english_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: publisher_zman_events; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_zman_events (
    id integer NOT NULL,
    publisher_zman_id integer NOT NULL,
    jewish_event_id integer NOT NULL,
    override_formula_dsl text,
    override_hebrew_name text,
    override_english_name text,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: publisher_zman_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_zman_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_zman_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_zman_events_id_seq OWNED BY public.publisher_zman_events.id;


-- Name: publisher_zman_tags; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_zman_tags (
    publisher_zman_id integer NOT NULL,
    tag_id integer NOT NULL,
    is_negated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: publisher_zman_versions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_zman_versions (
    id integer NOT NULL,
    publisher_zman_id integer NOT NULL,
    version_number integer NOT NULL,
    hebrew_name text NOT NULL,
    english_name text,
    formula_dsl text,
    halachic_notes text,
    created_by text,
    change_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Name: publisher_zman_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_zman_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_zman_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_zman_versions_id_seq OWNED BY public.publisher_zman_versions.id;


-- Name: publisher_zmanim; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publisher_zmanim (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    zman_key character varying(100) NOT NULL,
    hebrew_name text NOT NULL,
    english_name text DEFAULT ''::text NOT NULL,
    transliteration text,
    description text,
    formula_dsl text DEFAULT ''::text NOT NULL,
    ai_explanation text,
    publisher_comment text,
    master_zman_id integer,
    halachic_notes text,
    is_enabled boolean DEFAULT true NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    is_beta boolean DEFAULT false NOT NULL,
    is_custom boolean DEFAULT false NOT NULL,
    time_category_id integer,
    aliases text[] DEFAULT '{}'::text[],
    dependencies text[] DEFAULT '{}'::text[],
    linked_publisher_zman_id integer,
    current_version integer DEFAULT 1,
    created_by_action_id uuid,
    updated_by_action_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by text,
    certified_at timestamp with time zone,
    display_name_hebrew text,
    display_name_english text,
    rounding_mode character varying(10) DEFAULT 'math'::character varying NOT NULL,
    display_status public.display_status DEFAULT 'core'::public.display_status NOT NULL,
    copied_from_publisher_id integer,
    CONSTRAINT publisher_zmanim_rounding_mode_check CHECK (((rounding_mode)::text = ANY (ARRAY[('floor'::character varying)::text, ('math'::character varying)::text, ('ceil'::character varying)::text])))
);


-- Name: COLUMN publisher_zmanim.rounding_mode; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_zmanim.rounding_mode IS 'How to round time when seconds are hidden: floor (always down), math (standard >=30s up), ceil (always up)';


-- Name: COLUMN publisher_zmanim.display_status; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_zmanim.display_status IS 'Controls how this zman is displayed to end users:
- core: Always shown in zmanim display (essential times)
- optional: Shown by default but users can hide via preferences
- hidden: Not shown to users but visible to publisher in admin
- deleted: Soft-deleted, not visible anywhere except restore UI';


-- Name: COLUMN publisher_zmanim.copied_from_publisher_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publisher_zmanim.copied_from_publisher_id IS 'If this zman was copied from another publisher, the source publisher ID. Used for lineage tracking.';


-- Name: publisher_zmanim_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publisher_zmanim_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publisher_zmanim_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publisher_zmanim_id_seq OWNED BY public.publisher_zmanim.id;


-- Name: publishers; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.publishers (
    id integer NOT NULL,
    name text NOT NULL,
    contact_email text NOT NULL,
    phone text,
    website text,
    description text,
    logo_url text,
    location public.geography(Point,4326),
    latitude double precision,
    longitude double precision,
    timezone text,
    status_id smallint NOT NULL,
    verification_token text,
    verified_at timestamp with time zone,
    clerk_user_id text,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    bio text,
    slug text,
    is_verified boolean DEFAULT false NOT NULL,
    logo_data text,
    is_certified boolean DEFAULT false NOT NULL,
    suspension_reason text,
    deleted_at timestamp with time zone,
    deleted_by text,
    ignore_elevation boolean DEFAULT false NOT NULL,
    transliteration_style character varying(10) DEFAULT 'ashkenazi'::character varying NOT NULL,
    is_global boolean DEFAULT false NOT NULL,
    CONSTRAINT publishers_transliteration_style_check CHECK (((transliteration_style)::text = ANY (ARRAY[('ashkenazi'::character varying)::text, ('sephardi'::character varying)::text])))
);


-- Name: TABLE publishers; Type: COMMENT; Schema: public; Owner: -

COMMENT ON TABLE public.publishers IS 'Publishers are organizations (e.g., "Orthodox Union", "Chabad") that publish zmanim calculations. They are NOT users - users (people) authenticate via Clerk and can belong to multiple publishers.';


-- Name: COLUMN publishers.name; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.name IS 'Organization name (e.g., "Orthodox Union", "Chabad of Los Angeles")';


-- Name: COLUMN publishers.contact_email; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.contact_email IS 'Public contact email for inquiries about this organization. This is NOT a login email - users authenticate via Clerk.';


-- Name: COLUMN publishers.website; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.website IS 'Publisher organization website URL';


-- Name: COLUMN publishers.logo_url; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.logo_url IS 'Publisher organization logo (external URL)';


-- Name: COLUMN publishers.status_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.status_id IS 'Publisher verification status (pending, active, suspended, verified)';


-- Name: COLUMN publishers.clerk_user_id; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.clerk_user_id IS 'LEGACY: Primary owner user ID from Clerk. Current system has 1:1 relationship between user and publisher. Future: Multi-user support via user_publishers junction table.';


-- Name: COLUMN publishers.bio; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.bio IS 'Public-facing description of the publisher organization';


-- Name: COLUMN publishers.is_verified; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.is_verified IS 'Quick check: Is this publisher verified by admin?';


-- Name: COLUMN publishers.logo_data; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.logo_data IS 'Publisher organization logo (base64-encoded data URI)';


-- Name: COLUMN publishers.is_certified; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.is_certified IS 'Is this a certified/premium publisher?';


-- Name: COLUMN publishers.deleted_at; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.deleted_at IS 'Soft delete timestamp (NULL = active, timestamp = deleted)';


-- Name: COLUMN publishers.deleted_by; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.deleted_by IS 'Clerk user ID who performed soft delete';


-- Name: COLUMN publishers.ignore_elevation; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.ignore_elevation IS 'When true, all zmanim calculations for this publisher ignore elevation and use 0 meters. Useful for publishers who prefer sea-level calculations.';


-- Name: COLUMN publishers.transliteration_style; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.transliteration_style IS 'Controls English transliteration style: ashkenazi (Shabbos, Sukkos) or sephardi (Shabbat, Sukkot)';


-- Name: COLUMN publishers.is_global; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.publishers.is_global IS 'When true, publisher provides zmanim for all localities worldwide without coverage restrictions';


-- Name: publishers_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.publishers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: publishers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.publishers_id_seq OWNED BY public.publishers.id;


-- Name: request_statuses; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.request_statuses (
    id smallint NOT NULL,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color character varying(7),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: request_statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -

ALTER TABLE public.request_statuses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.request_statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);




-- Name: tag_event_mappings; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.tag_event_mappings (
    id integer NOT NULL,
    tag_id integer NOT NULL,
    hebcal_event_pattern character varying(100),
    hebrew_month integer,
    hebrew_day_start integer,
    hebrew_day_end integer,
    priority integer DEFAULT 100,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_mapping CHECK (((hebcal_event_pattern IS NOT NULL) OR ((hebrew_month IS NOT NULL) AND (hebrew_day_start IS NOT NULL))))
);


-- Name: tag_event_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.tag_event_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: tag_event_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.tag_event_mappings_id_seq OWNED BY public.tag_event_mappings.id;


-- Name: tag_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.tag_types (
    id integer NOT NULL,
    key character varying(50) NOT NULL,
    display_name_hebrew character varying(100) NOT NULL,
    display_name_english character varying(100) NOT NULL,
    color character varying(255),
    description text,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: tag_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.tag_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: tag_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.tag_types_id_seq OWNED BY public.tag_types.id;


-- Name: time_categories; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.time_categories (
    id integer NOT NULL,
    key character varying(50) NOT NULL,
    display_name_hebrew character varying(100) NOT NULL,
    display_name_english character varying(100) NOT NULL,
    description character varying(255),
    icon_name character varying(50),
    color character varying(50),
    sort_order integer NOT NULL,
    is_everyday boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: time_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.time_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: time_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.time_categories_id_seq OWNED BY public.time_categories.id;


-- Name: zman_registry_requests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.zman_registry_requests (
    id integer NOT NULL,
    publisher_id integer NOT NULL,
    requested_key character varying(100) NOT NULL,
    requested_hebrew_name text NOT NULL,
    requested_english_name text NOT NULL,
    requested_formula_dsl text,
    time_category_id integer NOT NULL,
    status_id smallint NOT NULL,
    reviewed_by character varying(255),
    reviewed_at timestamp with time zone,
    reviewer_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transliteration text,
    description text,
    halachic_notes text,
    halachic_source text,
    publisher_email text,
    publisher_name text,
    auto_add_on_approval boolean DEFAULT true
);


-- Name: zman_registry_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.zman_registry_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: zman_registry_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.zman_registry_requests_id_seq OWNED BY public.zman_registry_requests.id;


-- Name: zman_request_tags; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.zman_request_tags (
    id integer NOT NULL,
    request_id integer NOT NULL,
    tag_id integer,
    requested_tag_name text,
    requested_tag_type text,
    is_new_tag_request boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tag_reference_check CHECK ((((tag_id IS NOT NULL) AND (requested_tag_name IS NULL) AND (is_new_tag_request = false)) OR ((tag_id IS NULL) AND (requested_tag_name IS NOT NULL) AND (is_new_tag_request = true)))),
    CONSTRAINT zman_request_tags_requested_tag_type_check CHECK (((requested_tag_type IS NULL) OR (requested_tag_type = ANY (ARRAY['event'::text, 'timing'::text, 'behavior'::text, 'shita'::text, 'method'::text]))))
);


-- Name: zman_request_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.zman_request_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: zman_request_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.zman_request_tags_id_seq OWNED BY public.zman_request_tags.id;


-- Name: zman_tags; Type: TABLE; Schema: public; Owner: -

CREATE TABLE public.zman_tags (
    id integer NOT NULL,
    tag_key character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    display_name_hebrew text NOT NULL,
    tag_type_id integer NOT NULL,
    description text,
    color character varying(7),
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hebcal_basename character varying(100),
    display_name_english_ashkenazi text NOT NULL,
    display_name_english_sephardi text
);


-- Name: COLUMN zman_tags.hebcal_basename; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.zman_tags.hebcal_basename IS 'The base event name returned by Hebcal API (e.g., "Shavuot" for Shavuos). Used for direct matching.';


-- Name: COLUMN zman_tags.display_name_english_ashkenazi; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.zman_tags.display_name_english_ashkenazi IS 'English display name in Ashkenazi pronunciation (e.g., Shabbos, Sukkos, Shavuos)';


-- Name: COLUMN zman_tags.display_name_english_sephardi; Type: COMMENT; Schema: public; Owner: -

COMMENT ON COLUMN public.zman_tags.display_name_english_sephardi IS 'English display name in Sephardi pronunciation (e.g., Shabbat, Sukkot, Shavuot)';


-- Name: zman_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: -

CREATE SEQUENCE public.zman_tags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- Name: zman_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -

ALTER SEQUENCE public.zman_tags_id_seq OWNED BY public.zman_tags.id;


-- Name: ai_audit_logs id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_audit_logs_id_seq'::regclass);


-- Name: ai_indexes id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_indexes ALTER COLUMN id SET DEFAULT nextval('public.ai_indexes_id_seq'::regclass);


-- Name: algorithm_rollback_audit id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithm_rollback_audit ALTER COLUMN id SET DEFAULT nextval('public.algorithm_rollback_audit_id_seq'::regclass);


-- Name: algorithm_templates id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithm_templates ALTER COLUMN id SET DEFAULT nextval('public.algorithm_templates_id_seq'::regclass);


-- Name: algorithm_version_history id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithm_version_history ALTER COLUMN id SET DEFAULT nextval('public.algorithm_version_history_id_seq'::regclass);


-- Name: algorithms id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithms ALTER COLUMN id SET DEFAULT nextval('public.algorithms_id_seq'::regclass);


-- Name: astronomical_primitives id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.astronomical_primitives ALTER COLUMN id SET DEFAULT nextval('public.astronomical_primitives_id_seq'::regclass);


-- Name: blocked_emails id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.blocked_emails ALTER COLUMN id SET DEFAULT nextval('public.blocked_emails_id_seq'::regclass);


-- Name: calculation_logs id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.calculation_logs ALTER COLUMN id SET DEFAULT nextval('public.calculation_logs_id_seq'::regclass);


-- Name: correction_request_history id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.correction_request_history ALTER COLUMN id SET DEFAULT nextval('public.correction_request_history_id_seq'::regclass);


-- Name: day_types id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.day_types ALTER COLUMN id SET DEFAULT nextval('public.day_types_id_seq'::regclass);


-- Name: display_groups id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.display_groups ALTER COLUMN id SET DEFAULT nextval('public.display_groups_id_seq'::regclass);


-- Name: embeddings id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.embeddings ALTER COLUMN id SET DEFAULT nextval('public.embeddings_id_seq'::regclass);


-- Name: event_categories id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.event_categories ALTER COLUMN id SET DEFAULT nextval('public.event_categories_id_seq'::regclass);


-- Name: explanation_cache id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.explanation_cache ALTER COLUMN id SET DEFAULT nextval('public.explanation_cache_id_seq'::regclass);


-- Name: geo_data_sources id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_data_sources ALTER COLUMN id SET DEFAULT nextval('public.geo_data_sources_id_seq'::regclass);


-- Name: jewish_events id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.jewish_events ALTER COLUMN id SET DEFAULT nextval('public.jewish_events_id_seq'::regclass);


-- Name: location_correction_requests id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.location_correction_requests ALTER COLUMN id SET DEFAULT nextval('public.location_correction_requests_id_seq'::regclass);


-- Name: master_zman_day_types id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.master_zman_day_types ALTER COLUMN id SET DEFAULT nextval('public.master_zman_day_types_id_seq'::regclass);


-- Name: master_zman_events id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.master_zman_events ALTER COLUMN id SET DEFAULT nextval('public.master_zman_events_id_seq'::regclass);


-- Name: master_zmanim_registry id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.master_zmanim_registry ALTER COLUMN id SET DEFAULT nextval('public.master_zmanim_registry_id_seq'::regclass);


-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


-- Name: publisher_coverage id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_coverage ALTER COLUMN id SET DEFAULT nextval('public.publisher_coverage_id_seq'::regclass);


-- Name: publisher_import_history id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_import_history ALTER COLUMN id SET DEFAULT nextval('public.publisher_import_history_id_seq'::regclass);


-- Name: publisher_invitations id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_invitations ALTER COLUMN id SET DEFAULT nextval('public.publisher_invitations_id_seq'::regclass);


-- Name: publisher_location_overrides id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_location_overrides ALTER COLUMN id SET DEFAULT nextval('public.publisher_location_overrides_id_seq'::regclass);


-- Name: publisher_onboarding id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_onboarding ALTER COLUMN id SET DEFAULT nextval('public.publisher_onboarding_id_seq'::regclass);


-- Name: publisher_requests id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_requests ALTER COLUMN id SET DEFAULT nextval('public.publisher_requests_id_seq'::regclass);


-- Name: publisher_snapshots id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_snapshots ALTER COLUMN id SET DEFAULT nextval('public.publisher_snapshots_id_seq'::regclass);


-- Name: publisher_zman_aliases id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_aliases ALTER COLUMN id SET DEFAULT nextval('public.publisher_zman_aliases_id_seq'::regclass);


-- Name: publisher_zman_events id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_events ALTER COLUMN id SET DEFAULT nextval('public.publisher_zman_events_id_seq'::regclass);


-- Name: publisher_zman_versions id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_versions ALTER COLUMN id SET DEFAULT nextval('public.publisher_zman_versions_id_seq'::regclass);


-- Name: publisher_zmanim id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zmanim ALTER COLUMN id SET DEFAULT nextval('public.publisher_zmanim_id_seq'::regclass);


-- Name: publishers id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.publishers ALTER COLUMN id SET DEFAULT nextval('public.publishers_id_seq'::regclass);


-- Name: tag_event_mappings id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.tag_event_mappings ALTER COLUMN id SET DEFAULT nextval('public.tag_event_mappings_id_seq'::regclass);


-- Name: tag_types id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.tag_types ALTER COLUMN id SET DEFAULT nextval('public.tag_types_id_seq'::regclass);


-- Name: time_categories id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.time_categories ALTER COLUMN id SET DEFAULT nextval('public.time_categories_id_seq'::regclass);


-- Name: zman_registry_requests id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.zman_registry_requests ALTER COLUMN id SET DEFAULT nextval('public.zman_registry_requests_id_seq'::regclass);


-- Name: zman_request_tags id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.zman_request_tags ALTER COLUMN id SET DEFAULT nextval('public.zman_request_tags_id_seq'::regclass);


-- Name: zman_tags id; Type: DEFAULT; Schema: public; Owner: -

ALTER TABLE ONLY public.zman_tags ALTER COLUMN id SET DEFAULT nextval('public.zman_tags_id_seq'::regclass);


-- Name: actions actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.actions
    ADD CONSTRAINT actions_pkey PRIMARY KEY (id);


-- Name: ai_audit_logs ai_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_audit_logs
    ADD CONSTRAINT ai_audit_logs_pkey PRIMARY KEY (id);


-- Name: ai_content_sources ai_content_sources_key_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_content_sources
    ADD CONSTRAINT ai_content_sources_key_key UNIQUE (key);


-- Name: ai_content_sources ai_content_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_content_sources
    ADD CONSTRAINT ai_content_sources_pkey PRIMARY KEY (id);


-- Name: ai_index_statuses ai_index_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_index_statuses
    ADD CONSTRAINT ai_index_statuses_pkey PRIMARY KEY (id);


-- Name: ai_indexes ai_indexes_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_indexes
    ADD CONSTRAINT ai_indexes_pkey PRIMARY KEY (id);


-- Name: ai_indexes ai_indexes_source_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.ai_indexes
    ADD CONSTRAINT ai_indexes_source_key UNIQUE (source_id);


-- Name: algorithm_rollback_audit algorithm_rollback_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithm_rollback_audit
    ADD CONSTRAINT algorithm_rollback_audit_pkey PRIMARY KEY (id);


-- Name: algorithm_statuses algorithm_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithm_statuses
    ADD CONSTRAINT algorithm_statuses_pkey PRIMARY KEY (id);


-- Name: algorithm_templates algorithm_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithm_templates
    ADD CONSTRAINT algorithm_templates_pkey PRIMARY KEY (id);


-- Name: algorithm_templates algorithm_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithm_templates
    ADD CONSTRAINT algorithm_templates_template_key_key UNIQUE (template_key);


-- Name: algorithm_version_history algorithm_version_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithm_version_history
    ADD CONSTRAINT algorithm_version_history_pkey PRIMARY KEY (id);


-- Name: algorithms algorithms_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.algorithms
    ADD CONSTRAINT algorithms_pkey PRIMARY KEY (id);


-- Name: astronomical_primitives astronomical_primitives_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.astronomical_primitives
    ADD CONSTRAINT astronomical_primitives_pkey PRIMARY KEY (id);


-- Name: astronomical_primitives astronomical_primitives_variable_name_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.astronomical_primitives
    ADD CONSTRAINT astronomical_primitives_variable_name_key UNIQUE (variable_name);


-- Name: blocked_emails blocked_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.blocked_emails
    ADD CONSTRAINT blocked_emails_pkey PRIMARY KEY (id);


-- Name: calculation_logs calculation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.calculation_logs
    ADD CONSTRAINT calculation_logs_pkey PRIMARY KEY (id);


-- Name: calculation_stats_daily calculation_stats_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.calculation_stats_daily
    ADD CONSTRAINT calculation_stats_daily_pkey PRIMARY KEY (publisher_id, date);


-- Name: calculation_types calculation_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.calculation_types
    ADD CONSTRAINT calculation_types_pkey PRIMARY KEY (id);


-- Name: correction_request_history correction_request_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.correction_request_history
    ADD CONSTRAINT correction_request_history_pkey PRIMARY KEY (id);


-- Name: coverage_levels coverage_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.coverage_levels
    ADD CONSTRAINT coverage_levels_pkey PRIMARY KEY (id);


-- Name: data_types data_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.data_types
    ADD CONSTRAINT data_types_pkey PRIMARY KEY (id);


-- Name: day_types day_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.day_types
    ADD CONSTRAINT day_types_name_key UNIQUE (key);


-- Name: day_types day_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.day_types
    ADD CONSTRAINT day_types_pkey PRIMARY KEY (id);


-- Name: display_groups display_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.display_groups
    ADD CONSTRAINT display_groups_pkey PRIMARY KEY (id);


-- Name: edge_types edge_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.edge_types
    ADD CONSTRAINT edge_types_pkey PRIMARY KEY (id);


-- Name: embeddings embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_pkey PRIMARY KEY (id);


-- Name: embeddings embeddings_source_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_source_chunk_index_key UNIQUE (source_id, chunk_index);


-- Name: event_categories event_categories_key_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.event_categories
    ADD CONSTRAINT event_categories_key_key UNIQUE (key);


-- Name: event_categories event_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.event_categories
    ADD CONSTRAINT event_categories_pkey PRIMARY KEY (id);


-- Name: explanation_cache explanation_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.explanation_cache
    ADD CONSTRAINT explanation_cache_pkey PRIMARY KEY (id);


-- Name: explanation_sources explanation_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.explanation_sources
    ADD CONSTRAINT explanation_sources_pkey PRIMARY KEY (id);


-- Name: fast_start_types fast_start_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.fast_start_types
    ADD CONSTRAINT fast_start_types_pkey PRIMARY KEY (id);


-- Name: geo_continents geo_continents_code_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_continents
    ADD CONSTRAINT geo_continents_code_key UNIQUE (code);


-- Name: geo_continents geo_continents_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_continents
    ADD CONSTRAINT geo_continents_pkey PRIMARY KEY (id);


-- Name: geo_countries geo_countries_code_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_code_key UNIQUE (code);


-- Name: geo_countries geo_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_pkey PRIMARY KEY (id);


-- Name: geo_data_sources geo_data_sources_key_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_data_sources
    ADD CONSTRAINT geo_data_sources_key_key UNIQUE (key);


-- Name: geo_data_sources geo_data_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_data_sources
    ADD CONSTRAINT geo_data_sources_pkey PRIMARY KEY (id);


-- Name: geo_localities geo_localities_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_localities
    ADD CONSTRAINT geo_localities_pkey PRIMARY KEY (id);


-- Name: geo_locality_elevations geo_locality_elevations_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_locality_elevations
    ADD CONSTRAINT geo_locality_elevations_pkey PRIMARY KEY (id);


-- Name: geo_locality_elevations geo_locality_elevations_unique; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_locality_elevations
    ADD CONSTRAINT geo_locality_elevations_unique UNIQUE NULLS NOT DISTINCT (locality_id, publisher_id, source_id);


-- Name: geo_locality_locations geo_locality_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_locality_locations
    ADD CONSTRAINT geo_locality_locations_pkey PRIMARY KEY (id);


-- Name: geo_locality_locations geo_locality_locations_unique; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_locality_locations
    ADD CONSTRAINT geo_locality_locations_unique UNIQUE NULLS NOT DISTINCT (locality_id, publisher_id, source_id);


-- Name: geo_locality_types geo_locality_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_locality_types
    ADD CONSTRAINT geo_locality_types_code_key UNIQUE (code);


-- Name: geo_locality_types geo_locality_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_locality_types
    ADD CONSTRAINT geo_locality_types_pkey PRIMARY KEY (id);


-- Name: geo_names geo_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_names
    ADD CONSTRAINT geo_names_pkey PRIMARY KEY (id);


-- Name: geo_region_types geo_region_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_region_types
    ADD CONSTRAINT geo_region_types_code_key UNIQUE (code);


-- Name: geo_region_types geo_region_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_region_types
    ADD CONSTRAINT geo_region_types_pkey PRIMARY KEY (id);


-- Name: geo_regions geo_regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.geo_regions
    ADD CONSTRAINT geo_regions_pkey PRIMARY KEY (id);


-- Name: jewish_event_types jewish_event_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.jewish_event_types
    ADD CONSTRAINT jewish_event_types_pkey PRIMARY KEY (id);


-- Name: jewish_events jewish_events_code_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.jewish_events
    ADD CONSTRAINT jewish_events_code_key UNIQUE (code);


-- Name: jewish_events jewish_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.jewish_events
    ADD CONSTRAINT jewish_events_pkey PRIMARY KEY (id);


-- Name: languages languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_pkey PRIMARY KEY (code);


-- Name: location_correction_requests location_correction_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.location_correction_requests
    ADD CONSTRAINT location_correction_requests_pkey PRIMARY KEY (id);


-- Name: master_zman_day_types master_zman_day_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.master_zman_day_types
    ADD CONSTRAINT master_zman_day_types_pkey PRIMARY KEY (id);


-- Name: master_zman_events master_zman_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.master_zman_events
    ADD CONSTRAINT master_zman_events_pkey PRIMARY KEY (id);


-- Name: master_zman_tags master_zman_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.master_zman_tags
    ADD CONSTRAINT master_zman_tags_pkey PRIMARY KEY (master_zman_id, tag_id);


-- Name: master_zmanim_registry master_zmanim_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.master_zmanim_registry
    ADD CONSTRAINT master_zmanim_registry_pkey PRIMARY KEY (id);


-- Name: master_zmanim_registry master_zmanim_registry_zman_key_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.master_zmanim_registry
    ADD CONSTRAINT master_zmanim_registry_zman_key_key UNIQUE (zman_key);


-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


-- Name: primitive_categories primitive_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.primitive_categories
    ADD CONSTRAINT primitive_categories_pkey PRIMARY KEY (id);


-- Name: publisher_coverage publisher_coverage_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_coverage
    ADD CONSTRAINT publisher_coverage_pkey PRIMARY KEY (id);


-- Name: publisher_import_history publisher_import_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_import_history
    ADD CONSTRAINT publisher_import_history_pkey PRIMARY KEY (id);


-- Name: publisher_invitations publisher_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_invitations
    ADD CONSTRAINT publisher_invitations_pkey PRIMARY KEY (id);


-- Name: publisher_invitations publisher_invitations_publisher_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_invitations
    ADD CONSTRAINT publisher_invitations_publisher_id_email_key UNIQUE (publisher_id, email);


-- Name: publisher_invitations publisher_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_invitations
    ADD CONSTRAINT publisher_invitations_token_key UNIQUE (token);


-- Name: publisher_location_overrides publisher_location_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_location_overrides
    ADD CONSTRAINT publisher_location_overrides_pkey PRIMARY KEY (id);


-- Name: publisher_onboarding publisher_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_onboarding
    ADD CONSTRAINT publisher_onboarding_pkey PRIMARY KEY (id);


-- Name: publisher_onboarding publisher_onboarding_publisher_id_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_onboarding
    ADD CONSTRAINT publisher_onboarding_publisher_id_key UNIQUE (publisher_id);


-- Name: publisher_registration_tokens publisher_registration_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_registration_tokens
    ADD CONSTRAINT publisher_registration_tokens_pkey PRIMARY KEY (id);


-- Name: publisher_registration_tokens publisher_registration_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_registration_tokens
    ADD CONSTRAINT publisher_registration_tokens_token_key UNIQUE (token);


-- Name: publisher_requests publisher_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_requests
    ADD CONSTRAINT publisher_requests_pkey PRIMARY KEY (id);


-- Name: publisher_roles publisher_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_roles
    ADD CONSTRAINT publisher_roles_pkey PRIMARY KEY (id);


-- Name: publisher_snapshots publisher_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_snapshots
    ADD CONSTRAINT publisher_snapshots_pkey PRIMARY KEY (id);


-- Name: publisher_statuses publisher_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_statuses
    ADD CONSTRAINT publisher_statuses_pkey PRIMARY KEY (id);


-- Name: publisher_zman_aliases publisher_zman_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_aliases
    ADD CONSTRAINT publisher_zman_aliases_pkey PRIMARY KEY (id);


-- Name: publisher_zman_aliases publisher_zman_aliases_unique; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_aliases
    ADD CONSTRAINT publisher_zman_aliases_unique UNIQUE (publisher_id, alias_hebrew);


-- Name: publisher_zman_day_types publisher_zman_day_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_day_types
    ADD CONSTRAINT publisher_zman_day_types_pkey PRIMARY KEY (publisher_zman_id, day_type_id);


-- Name: publisher_zman_events publisher_zman_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_events
    ADD CONSTRAINT publisher_zman_events_pkey PRIMARY KEY (id);


-- Name: publisher_zman_events publisher_zman_events_unique; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_events
    ADD CONSTRAINT publisher_zman_events_unique UNIQUE (publisher_zman_id, jewish_event_id);


-- Name: publisher_zman_tags publisher_zman_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_tags
    ADD CONSTRAINT publisher_zman_tags_pkey PRIMARY KEY (publisher_zman_id, tag_id);


-- Name: publisher_zman_versions publisher_zman_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_versions
    ADD CONSTRAINT publisher_zman_versions_pkey PRIMARY KEY (id);


-- Name: publisher_zman_versions publisher_zman_versions_unique; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zman_versions
    ADD CONSTRAINT publisher_zman_versions_unique UNIQUE (publisher_zman_id, version_number);


-- Name: publisher_zmanim publisher_zmanim_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zmanim
    ADD CONSTRAINT publisher_zmanim_pkey PRIMARY KEY (id);


-- Name: publisher_zmanim publisher_zmanim_unique_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publisher_zmanim
    ADD CONSTRAINT publisher_zmanim_unique_key UNIQUE (publisher_id, zman_key);


-- Name: publishers publishers_email_key; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publishers
    ADD CONSTRAINT publishers_email_key UNIQUE (contact_email);


-- Name: publishers publishers_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.publishers
    ADD CONSTRAINT publishers_pkey PRIMARY KEY (id);


-- Name: request_statuses request_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -

ALTER TABLE ONLY public.request_statuses
    ADD CONSTRAINT request_statuses_pkey PRIMARY KEY (id);


