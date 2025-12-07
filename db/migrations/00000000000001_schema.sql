--
-- PostgreSQL database dump
--


-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-3.pgdg24.04+1)

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

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
--



--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: assign_all_city_hierarchy(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: assign_cities_to_countries(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: assign_cities_to_districts(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: assign_cities_to_regions(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: cleanup_expired_explanations(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: get_effective_city_elevation(integer, character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: get_effective_geo_city_coordinates(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: get_next_zman_version(integer); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: get_next_algorithm_version(integer); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: get_publishers_for_city(integer); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: prune_publisher_snapshots(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: prune_zman_versions(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_update_effective_city_elevation(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: trg_update_effective_geo_city_coordinates(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: update_effective_city_data(integer); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: update_embeddings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_embeddings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


--
-- Name: update_geo_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_geo_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: update_master_registry_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_master_registry_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: update_publisher_zman_day_types_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_publisher_zman_day_types_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: update_publisher_zman_events_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_publisher_zman_events_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: update_publisher_zmanim_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_publisher_zmanim_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


--
-- Name: validate_all_city_hierarchies(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: validate_all_city_hierarchy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_all_city_hierarchy() RETURNS TABLE(issue_type text, city_id integer, city_name text, details text)
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


--
-- Name: validate_all_district_hierarchies(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: validate_all_region_hierarchies(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: validate_city_hierarchy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_city_hierarchy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: validate_district_hierarchy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_district_hierarchy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: validate_region_hierarchy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_region_hierarchy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_audit_logs (
    id SERIAL PRIMARY KEY,
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


--
-- Name: ai_indexes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_indexes (
    id SERIAL PRIMARY KEY,
    source_id smallint NOT NULL,
    total_chunks integer DEFAULT 0 NOT NULL,
    last_indexed_at timestamp with time zone,
    status_id smallint NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: algorithm_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.algorithm_templates (
    id SERIAL PRIMARY KEY,
    template_key text NOT NULL,
    name text NOT NULL,
    description text,
    configuration jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: algorithms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.algorithms (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL,
    name text NOT NULL,
    description text,
    configuration jsonb,
    status_id smallint,
    is_public boolean DEFAULT false,
    forked_from integer,
    attribution_text text,
    fork_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: algorithm_version_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.algorithm_version_history (
    id text DEFAULT (gen_random_uuid())::text NOT NULL PRIMARY KEY,
    algorithm_id integer NOT NULL,
    version_number integer NOT NULL,
    status text NOT NULL,
    description text,
    config_snapshot jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    published_at timestamp with time zone,
    CONSTRAINT uq_algorithm_version UNIQUE (algorithm_id, version_number)
);


--
-- Name: algorithm_rollback_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.algorithm_rollback_audit (
    id SERIAL PRIMARY KEY,
    algorithm_id integer NOT NULL,
    source_version integer NOT NULL,
    target_version integer NOT NULL,
    new_version integer NOT NULL,
    reason text,
    rolled_back_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: astronomical_primitives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.astronomical_primitives (
    id SERIAL PRIMARY KEY,
    variable_name character varying(50) NOT NULL,
    display_name text NOT NULL,
    description text,
    formula_dsl text NOT NULL,
    category_id smallint NOT NULL,
    calculation_type_id smallint NOT NULL,
    solar_angle numeric(5,2),
    is_dawn boolean,
    edge_type_id smallint,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: day_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_types (
    id SERIAL PRIMARY KEY,
    key character varying(100) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    parent_id integer,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: display_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.display_groups (
    id SERIAL PRIMARY KEY,
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


--
-- Name: embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embeddings (
    id SERIAL PRIMARY KEY,
    source_id smallint NOT NULL,
    content_type character varying(50) NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    embedding public.vector(1536),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: event_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_categories (
    id SERIAL PRIMARY KEY,
    key character varying(50) NOT NULL,
    display_name_hebrew character varying(100) NOT NULL,
    display_name_english character varying(100) NOT NULL,
    description character varying(255),
    icon_name character varying(50),
    color character varying(50),
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: explanation_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explanation_cache (
    id SERIAL PRIMARY KEY,
    formula_hash character varying(32) NOT NULL,
    language character varying(10) DEFAULT 'mixed'::character varying NOT NULL,
    explanation text NOT NULL,
    source_id smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: geo_boundary_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_boundary_imports (
    id integer NOT NULL,
    source_id integer NOT NULL,
    level_id smallint NOT NULL,
    country_code character varying(2),
    version text,
    records_imported integer DEFAULT 0,
    records_matched integer DEFAULT 0,
    records_unmatched integer DEFAULT 0,
    imported_at timestamp with time zone DEFAULT now(),
    notes text
);


--
-- Name: geo_boundary_imports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.geo_boundary_imports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: geo_boundary_imports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.geo_boundary_imports_id_seq OWNED BY public.geo_boundary_imports.id;


--
-- Name: geo_cities; Type: TABLE; Schema: public; Owner: -
--

CREATE SEQUENCE public.geo_cities_id_seq AS integer START WITH 1 INCREMENT BY 1;

CREATE TABLE public.geo_cities (
    id integer DEFAULT nextval('public.geo_cities_id_seq'::regclass) NOT NULL,
    region_id integer,
    district_id integer,
    name text NOT NULL,
    name_ascii text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    location public.geography(Point,4326) GENERATED ALWAYS AS ((public.st_setsrid(public.st_makepoint(longitude, latitude), 4326))::public.geography) STORED,
    timezone text NOT NULL,
    elevation_m integer DEFAULT 0,
    population integer,
    geonameid integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    wof_id integer,
    continent_id smallint,
    country_id integer,
    coordinate_source_id integer,
    elevation_source_id integer
);


--
-- Name: geo_city_boundaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_city_boundaries (
    city_id integer NOT NULL,
    boundary public.geography(MultiPolygon,4326) NOT NULL,
    boundary_simplified public.geography(MultiPolygon,4326),
    area_km2 double precision,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: geo_city_coordinates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_city_coordinates (
    id integer NOT NULL,
    city_id integer NOT NULL,
    source_id integer NOT NULL,
    external_id text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    accuracy_m integer,
    submitted_by text,
    publisher_id integer,
    verified_at timestamp with time zone,
    verified_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: geo_city_coordinates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.geo_city_coordinates ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_city_coordinates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: geo_city_elevations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_city_elevations (
    id integer NOT NULL,
    city_id integer NOT NULL,
    coordinate_source_id integer NOT NULL,
    source_id integer NOT NULL,
    elevation_m integer NOT NULL,
    accuracy_m integer,
    submitted_by text,
    publisher_id integer,
    verified_at timestamp with time zone,
    verified_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: geo_city_elevations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.geo_city_elevations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_city_elevations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: geo_continents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.geo_continents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: geo_continents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_continents (
    id smallint DEFAULT nextval('public.geo_continents_id_seq'::regclass) NOT NULL,
    code character varying(2) NOT NULL,
    name text NOT NULL,
    wof_id integer
);


--
-- Name: geo_countries; Type: TABLE; Schema: public; Owner: -
--

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
    wof_id integer
);


--
-- Name: geo_countries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.geo_countries ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_countries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: geo_country_boundaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_country_boundaries (
    country_id smallint NOT NULL,
    boundary public.geography(MultiPolygon,4326) NOT NULL,
    boundary_simplified public.geography(MultiPolygon,4326),
    area_km2 double precision,
    centroid public.geography(Point,4326),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: geo_data_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_data_imports (
    id integer NOT NULL,
    source_id integer NOT NULL,
    import_type character varying(20) NOT NULL,
    version text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    records_processed integer DEFAULT 0,
    records_imported integer DEFAULT 0,
    records_updated integer DEFAULT 0,
    records_skipped integer DEFAULT 0,
    errors text[],
    notes text
);


--
-- Name: geo_data_imports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.geo_data_imports ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_data_imports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: geo_data_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_data_sources (
    id SERIAL PRIMARY KEY,
    key character varying(20) NOT NULL UNIQUE,
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


--
-- Name: geo_district_boundaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_district_boundaries (
    district_id integer NOT NULL,
    boundary public.geography(MultiPolygon,4326) NOT NULL,
    boundary_simplified public.geography(MultiPolygon,4326),
    area_km2 double precision,
    centroid public.geography(Point,4326),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: geo_districts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_districts (
    id integer NOT NULL,
    region_id integer,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    wof_id integer,
    continent_id smallint NOT NULL,
    country_id smallint
);


--
-- Name: geo_districts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.geo_districts ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_districts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: geo_name_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_name_mappings (
    id integer NOT NULL,
    level_id smallint NOT NULL,
    source_id integer NOT NULL,
    source_name text NOT NULL,
    source_country_code character varying(2),
    target_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    notes text
);


--
-- Name: geo_name_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.geo_name_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: geo_name_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.geo_name_mappings_id_seq OWNED BY public.geo_name_mappings.id;


--
-- Name: geo_names; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_names (
    id integer NOT NULL,
    entity_type_id smallint NOT NULL,
    entity_id integer NOT NULL,
    language_code character varying(3) NOT NULL,
    name text NOT NULL,
    is_preferred boolean DEFAULT true,
    source_id integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: geo_names_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.geo_names ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_names_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: geo_region_boundaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_region_boundaries (
    region_id integer NOT NULL,
    boundary public.geography(MultiPolygon,4326) NOT NULL,
    boundary_simplified public.geography(MultiPolygon,4326),
    area_km2 double precision,
    centroid public.geography(Point,4326),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: geo_regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_regions (
    id integer NOT NULL,
    country_id smallint,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    wof_id integer,
    continent_id smallint NOT NULL
);


--
-- Name: geo_regions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.geo_regions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.geo_regions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: jewish_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jewish_events (
    id SERIAL PRIMARY KEY,
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


--
-- Name: languages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.languages (
    code character varying(3) NOT NULL,
    name text NOT NULL,
    native_name text,
    script character varying(4),
    direction character varying(3) DEFAULT 'ltr'::character varying,
    is_active boolean DEFAULT true
);


--
-- Name: master_zman_day_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_zman_day_types (
    master_zman_id integer NOT NULL,
    day_type_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: master_zman_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_zman_events (
    id SERIAL PRIMARY KEY,
    master_zman_id integer NOT NULL,
    jewish_event_id integer NOT NULL,
    is_primary boolean DEFAULT false,
    override_hebrew_name text,
    override_english_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: master_zman_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_zman_tags (
    master_zman_id integer NOT NULL,
    tag_id integer NOT NULL,
    is_negated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: master_zmanim_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_zmanim_registry (
    id SERIAL PRIMARY KEY,
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
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id SERIAL PRIMARY KEY,
    email text NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: publisher_coverage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_coverage (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL,
    coverage_level_id smallint NOT NULL,
    city_id integer,
    district_id integer,
    region_id integer,
    country_id smallint,
    continent_id smallint,
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: publisher_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_invitations (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL,
    email text NOT NULL,
    role_id smallint NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: publisher_onboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_onboarding (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL,
    profile_complete boolean DEFAULT false,
    algorithm_selected boolean DEFAULT false,
    zmanim_configured boolean DEFAULT false,
    coverage_set boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: publisher_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_requests (
    id SERIAL PRIMARY KEY,
    email text NOT NULL,
    name text NOT NULL,
    organization text,
    message text,
    status_id smallint NOT NULL,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: publisher_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_snapshots (
    id SERIAL PRIMARY KEY,
    publisher_id integer NOT NULL,
    description text,
    snapshot_data jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: publisher_zman_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_zman_aliases (
    id SERIAL PRIMARY KEY,
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


--
-- Name: publisher_zman_day_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_zman_day_types (
    publisher_zman_id integer NOT NULL,
    day_type_id integer NOT NULL,
    override_formula_dsl text,
    override_hebrew_name text,
    override_english_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: publisher_zman_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_zman_events (
    id SERIAL PRIMARY KEY,
    publisher_zman_id integer NOT NULL,
    jewish_event_id integer NOT NULL,
    override_formula_dsl text,
    override_hebrew_name text,
    override_english_name text,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: publisher_zman_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_zman_tags (
    publisher_zman_id integer NOT NULL,
    tag_id integer NOT NULL,
    is_negated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: publisher_zman_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_zman_versions (
    id SERIAL PRIMARY KEY,
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


--
-- Name: publisher_zmanim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_zmanim (
    id SERIAL PRIMARY KEY,
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
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    deleted_by text,
    certified_at timestamp with time zone,
    source_type_id smallint NOT NULL,
    display_name_hebrew text,
    display_name_english text
);


--
-- Name: publishers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publishers (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL,
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
    deleted_by text
);


--
-- Name: system_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_config (
    id SERIAL PRIMARY KEY,
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tag_event_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag_event_mappings (
    id SERIAL PRIMARY KEY,
    tag_id integer NOT NULL,
    hebcal_event_pattern character varying(100),
    hebrew_month integer,
    hebrew_day_start integer,
    hebrew_day_end integer,
    priority integer DEFAULT 100,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT valid_mapping CHECK (((hebcal_event_pattern IS NOT NULL) OR ((hebrew_month IS NOT NULL) AND (hebrew_day_start IS NOT NULL))))
);


--
-- Name: tag_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag_types (
    id SERIAL PRIMARY KEY,
    key character varying(50) NOT NULL,
    display_name_hebrew character varying(100) NOT NULL,
    display_name_english character varying(100) NOT NULL,
    color character varying(255),
    description text,
    sort_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: time_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_categories (
    id SERIAL PRIMARY KEY,
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


--
-- Name: publisher_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color character varying(7),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: algorithm_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.algorithm_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color character varying(7),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_index_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_index_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color character varying(7),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: request_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_statuses (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    color character varying(7),
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: publisher_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publisher_roles (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    permissions jsonb,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: coverage_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coverage_levels (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    sort_order smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: jewish_event_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jewish_event_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(30) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: fast_start_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fast_start_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: calculation_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calculation_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: edge_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edge_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: primitive_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.primitive_categories (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(50) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: zman_source_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zman_source_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_content_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_content_sources (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(50) NOT NULL UNIQUE,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: geo_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_levels (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    sort_order smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: data_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_types (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: explanation_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.explanation_sources (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key character varying(20) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: zman_display_contexts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zman_display_contexts (
    id SERIAL PRIMARY KEY,
    master_zman_id integer NOT NULL,
    context_code character varying(50) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zman_registry_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zman_registry_requests (
    id SERIAL PRIMARY KEY,
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


--
-- Name: zman_request_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zman_request_tags (
    id SERIAL PRIMARY KEY,
    request_id integer NOT NULL,
    tag_id integer,
    requested_tag_name text,
    requested_tag_type text,
    is_new_tag_request boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tag_reference_check CHECK ((((tag_id IS NOT NULL) AND (requested_tag_name IS NULL) AND (is_new_tag_request = false)) OR ((tag_id IS NULL) AND (requested_tag_name IS NOT NULL) AND (is_new_tag_request = true)))),
    CONSTRAINT zman_request_tags_requested_tag_type_check CHECK (((requested_tag_type IS NULL) OR (requested_tag_type = ANY (ARRAY['event'::text, 'timing'::text, 'behavior'::text, 'shita'::text, 'method'::text]))))
);


--
-- Name: zman_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zman_tags (
    id SERIAL PRIMARY KEY,
    tag_key character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    display_name_hebrew text NOT NULL,
    display_name_english text NOT NULL,
    tag_type_id integer NOT NULL,
    description text,
    color character varying(7),
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: geo_boundary_imports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_boundary_imports ALTER COLUMN id SET DEFAULT nextval('public.geo_boundary_imports_id_seq'::regclass);


--
-- Name: geo_name_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_name_mappings ALTER COLUMN id SET DEFAULT nextval('public.geo_name_mappings_id_seq'::regclass);


--
-- Name: ai_audit_logs ai_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: ai_index_status ai_index_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: ai_index_status ai_index_status_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_index_status
    ADD CONSTRAINT ai_index_status_source_key UNIQUE (source_id);


--
-- Name: algorithm_templates algorithm_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: algorithm_templates algorithm_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.algorithm_templates
    ADD CONSTRAINT algorithm_templates_template_key_key UNIQUE (template_key);


--
-- Name: algorithms algorithms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: astronomical_primitives astronomical_primitives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: astronomical_primitives astronomical_primitives_variable_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.astronomical_primitives
    ADD CONSTRAINT astronomical_primitives_variable_name_key UNIQUE (variable_name);


--
-- Name: day_types day_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_types
    ADD CONSTRAINT day_types_name_key UNIQUE (key);


--
-- Name: day_types day_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: display_groups display_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: embeddings embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: embeddings embeddings_source_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_source_chunk_index_key UNIQUE (source_id, chunk_index);


--
-- Name: event_categories event_categories_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_categories
    ADD CONSTRAINT event_categories_key_key UNIQUE (key);


--
-- Name: event_categories event_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: explanation_cache explanation_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: geo_boundary_imports geo_boundary_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_boundary_imports
    ADD CONSTRAINT geo_boundary_imports_pkey PRIMARY KEY (id);


--
-- Name: geo_boundary_imports geo_boundary_imports_source_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_boundary_imports
    ADD CONSTRAINT geo_boundary_imports_source_level_key UNIQUE (source_id, level_id, country_code);


--
-- Name: geo_cities geo_cities_geonameid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_cities
    ADD CONSTRAINT geo_cities_geonameid_key UNIQUE (geonameid);


--
-- Name: geo_cities geo_cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_cities
    ADD CONSTRAINT geo_cities_pkey PRIMARY KEY (id);


--
-- Name: geo_cities geo_cities_wof_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_cities
    ADD CONSTRAINT geo_cities_wof_id_key UNIQUE (wof_id);


--
-- Name: geo_city_boundaries geo_city_boundaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_boundaries
    ADD CONSTRAINT geo_city_boundaries_pkey PRIMARY KEY (city_id);


--
-- Name: geo_city_coordinates geo_city_coordinates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_coordinates
    ADD CONSTRAINT geo_city_coordinates_pkey PRIMARY KEY (id);


--
-- Name: geo_city_elevations geo_city_elevations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_elevations
    ADD CONSTRAINT geo_city_elevations_pkey PRIMARY KEY (id);


--
-- Name: geo_continents geo_continents_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_continents
    ADD CONSTRAINT geo_continents_code_key UNIQUE (code);


--
-- Name: geo_continents geo_continents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_continents
    ADD CONSTRAINT geo_continents_pkey PRIMARY KEY (id);


--
-- Name: geo_continents geo_continents_wof_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_continents
    ADD CONSTRAINT geo_continents_wof_id_key UNIQUE (wof_id);


--
-- Name: geo_countries geo_countries_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_code_key UNIQUE (code);


--
-- Name: geo_countries geo_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_pkey PRIMARY KEY (id);


--
-- Name: geo_country_boundaries geo_country_boundaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_country_boundaries
    ADD CONSTRAINT geo_country_boundaries_pkey PRIMARY KEY (country_id);


--
-- Name: geo_data_imports geo_data_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_data_imports
    ADD CONSTRAINT geo_data_imports_pkey PRIMARY KEY (id);




--
-- Name: geo_district_boundaries geo_district_boundaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_district_boundaries
    ADD CONSTRAINT geo_district_boundaries_pkey PRIMARY KEY (district_id);


--
-- Name: geo_districts geo_districts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_pkey PRIMARY KEY (id);


--
-- Name: geo_districts geo_districts_region_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_region_id_code_key UNIQUE (region_id, code);


--
-- Name: geo_districts geo_districts_wof_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_wof_id_key UNIQUE (wof_id);


--
-- Name: geo_name_mappings geo_name_mappings_level_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_name_mappings
    ADD CONSTRAINT geo_name_mappings_level_source_key UNIQUE (level_id, source_id, source_name, source_country_code);


--
-- Name: geo_name_mappings geo_name_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_name_mappings
    ADD CONSTRAINT geo_name_mappings_pkey PRIMARY KEY (id);


--
-- Name: geo_names geo_names_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_names
    ADD CONSTRAINT geo_names_pkey PRIMARY KEY (id);


--
-- Name: geo_names geo_names_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_names
    ADD CONSTRAINT geo_names_unique UNIQUE (entity_type_id, entity_id, language_code);


--
-- Name: geo_region_boundaries geo_region_boundaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_region_boundaries
    ADD CONSTRAINT geo_region_boundaries_pkey PRIMARY KEY (region_id);


--
-- Name: geo_regions geo_regions_country_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_regions
    ADD CONSTRAINT geo_regions_country_id_code_key UNIQUE (country_id, code);


--
-- Name: geo_regions geo_regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_regions
    ADD CONSTRAINT geo_regions_pkey PRIMARY KEY (id);


--
-- Name: geo_regions geo_regions_wof_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_regions
    ADD CONSTRAINT geo_regions_wof_id_key UNIQUE (wof_id);


--
-- Name: jewish_events jewish_events_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jewish_events
    ADD CONSTRAINT jewish_events_code_key UNIQUE (code);


--
-- Name: jewish_events jewish_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: languages languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_pkey PRIMARY KEY (code);


--
-- Name: master_zman_day_types master_zman_day_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zman_day_types
    ADD CONSTRAINT master_zman_day_types_pkey PRIMARY KEY (master_zman_id, day_type_id);


--
-- Name: master_zman_events master_zman_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: master_zman_events master_zman_events_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zman_events
    ADD CONSTRAINT master_zman_events_unique UNIQUE (master_zman_id, jewish_event_id);


--
-- Name: master_zman_tags master_zman_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zman_tags
    ADD CONSTRAINT master_zman_tags_pkey PRIMARY KEY (master_zman_id, tag_id);


--
-- Name: master_zmanim_registry master_zmanim_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: master_zmanim_registry master_zmanim_registry_zman_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zmanim_registry
    ADD CONSTRAINT master_zmanim_registry_zman_key_key UNIQUE (zman_key);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_coverage publisher_coverage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_invitations publisher_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_invitations publisher_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_invitations
    ADD CONSTRAINT publisher_invitations_token_key UNIQUE (token);


--
-- Name: publisher_onboarding publisher_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_onboarding publisher_onboarding_publisher_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_onboarding
    ADD CONSTRAINT publisher_onboarding_publisher_id_key UNIQUE (publisher_id);


--
-- Name: publisher_requests publisher_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_snapshots publisher_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_zman_aliases publisher_zman_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_zman_aliases publisher_zman_aliases_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_aliases
    ADD CONSTRAINT publisher_zman_aliases_unique UNIQUE (publisher_id, alias_hebrew);


--
-- Name: publisher_zman_day_types publisher_zman_day_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_day_types
    ADD CONSTRAINT publisher_zman_day_types_pkey PRIMARY KEY (publisher_zman_id, day_type_id);


--
-- Name: publisher_zman_events publisher_zman_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_zman_events publisher_zman_events_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_events
    ADD CONSTRAINT publisher_zman_events_unique UNIQUE (publisher_zman_id, jewish_event_id);


--
-- Name: publisher_zman_tags publisher_zman_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_tags
    ADD CONSTRAINT publisher_zman_tags_pkey PRIMARY KEY (publisher_zman_id, tag_id);


--
-- Name: publisher_zman_versions publisher_zman_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_zman_versions publisher_zman_versions_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_versions
    ADD CONSTRAINT publisher_zman_versions_unique UNIQUE (publisher_zman_id, version_number);


--
-- Name: publisher_zmanim publisher_zmanim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: publisher_zmanim publisher_zmanim_unique_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zmanim
    ADD CONSTRAINT publisher_zmanim_unique_key UNIQUE (publisher_id, zman_key);


--
-- Name: publishers publishers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publishers
    ADD CONSTRAINT publishers_email_key UNIQUE (email);


--
-- Name: publishers publishers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: system_config system_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_key_key UNIQUE (key);


--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: tag_event_mappings tag_event_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: tag_event_mappings tag_event_mappings_tag_id_hebcal_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_event_mappings
    ADD CONSTRAINT tag_event_mappings_tag_id_hebcal_key UNIQUE (tag_id, hebcal_event_pattern);


--
-- Name: tag_types tag_types_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_types
    ADD CONSTRAINT tag_types_key_key UNIQUE (key);


--
-- Name: tag_types tag_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: time_categories time_categories_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_categories
    ADD CONSTRAINT time_categories_key_key UNIQUE (key);


--
-- Name: time_categories time_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: zman_display_contexts zman_display_contexts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: zman_display_contexts zman_display_contexts_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_display_contexts
    ADD CONSTRAINT zman_display_contexts_unique UNIQUE (master_zman_id, context_code);


--
-- Name: zman_registry_requests zman_registry_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: zman_request_tags zman_request_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: zman_request_tags zman_request_tags_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_request_tags
    ADD CONSTRAINT zman_request_tags_unique UNIQUE (request_id, tag_id);


--
-- Name: zman_tags zman_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: zman_tags zman_tags_tag_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_tags
    ADD CONSTRAINT zman_tags_tag_key_key UNIQUE (tag_key);


--
--
-- Name: embeddings_content_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX embeddings_content_type_idx ON public.embeddings USING btree (content_type);


--
-- Name: embeddings_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX embeddings_source_idx ON public.embeddings USING btree (source_id);


--
-- Name: embeddings_vector_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX embeddings_vector_idx ON public.embeddings USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_ai_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_created ON public.ai_audit_logs USING btree (created_at DESC);


--
-- Name: idx_ai_audit_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_publisher ON public.ai_audit_logs USING btree (publisher_id);


--
-- Name: idx_ai_audit_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_success ON public.ai_audit_logs USING btree (success);


--
-- Name: idx_ai_audit_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_type ON public.ai_audit_logs USING btree (request_type);


--
-- Name: idx_ai_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_audit_user ON public.ai_audit_logs USING btree (user_id);


--
-- Name: idx_algorithm_templates_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithm_templates_active ON public.algorithm_templates USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_algorithm_templates_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithm_templates_key ON public.algorithm_templates USING btree (template_key);


--
-- Name: idx_algorithms_forked_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithms_forked_from ON public.algorithms USING btree (forked_from) WHERE (forked_from IS NOT NULL);


--
-- Name: idx_algorithms_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithms_public ON public.algorithms USING btree (is_public) WHERE (is_public = true);


--
-- Name: idx_algorithms_publisher_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithms_publisher_id ON public.algorithms USING btree (publisher_id);


--
-- Name: idx_algorithms_publisher_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithms_publisher_status ON public.algorithms USING btree (publisher_id, status_id);


--
-- Name: idx_algorithms_publisher_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithms_publisher_status_created ON public.algorithms USING btree (publisher_id, status_id, created_at DESC);


--
-- Name: idx_algorithms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithms_status ON public.algorithms USING btree (status_id);


--
-- Name: idx_algorithm_version_history_algorithm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithm_version_history_algorithm_id ON public.algorithm_version_history USING btree (algorithm_id);


--
-- Name: idx_algorithm_version_history_version_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithm_version_history_version_number ON public.algorithm_version_history USING btree (algorithm_id, version_number DESC);


--
-- Name: idx_algorithm_rollback_audit_algorithm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_algorithm_rollback_audit_algorithm_id ON public.algorithm_rollback_audit USING btree (algorithm_id, created_at DESC);


--
-- Name: idx_astronomical_primitives_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_astronomical_primitives_category ON public.astronomical_primitives USING btree (category_id);


--
-- Name: idx_astronomical_primitives_variable_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_astronomical_primitives_variable_name ON public.astronomical_primitives USING btree (variable_name);


--
-- Name: idx_city_boundaries_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_city_boundaries_geom ON public.geo_city_boundaries USING gist (boundary);


--
-- Name: idx_city_boundaries_simplified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_city_boundaries_simplified ON public.geo_city_boundaries USING gist (boundary_simplified);


--
-- Name: idx_country_boundaries_centroid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_boundaries_centroid ON public.geo_country_boundaries USING gist (centroid);


--
-- Name: idx_country_boundaries_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_boundaries_geom ON public.geo_country_boundaries USING gist (boundary);


--
-- Name: idx_country_boundaries_simplified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_boundaries_simplified ON public.geo_country_boundaries USING gist (boundary_simplified);


--
-- Name: idx_day_types_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_day_types_name ON public.day_types USING btree (key);


--
-- Name: idx_day_types_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_day_types_parent ON public.day_types USING btree (parent_id);


--
-- Name: idx_display_groups_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_display_groups_key ON public.display_groups USING btree (key);


--
-- Name: idx_display_groups_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_display_groups_sort ON public.display_groups USING btree (sort_order);


--
-- Name: idx_district_boundaries_centroid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_district_boundaries_centroid ON public.geo_district_boundaries USING gist (centroid);


--
-- Name: idx_district_boundaries_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_district_boundaries_geom ON public.geo_district_boundaries USING gist (boundary);


--
-- Name: idx_district_boundaries_simplified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_district_boundaries_simplified ON public.geo_district_boundaries USING gist (boundary_simplified);


--
-- Name: idx_event_categories_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_categories_key ON public.event_categories USING btree (key);


--
-- Name: idx_event_categories_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_categories_sort ON public.event_categories USING btree (sort_order);


--
-- Name: idx_explanation_cache_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_explanation_cache_expiry ON public.explanation_cache USING btree (expires_at);


--
-- Name: idx_explanation_cache_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_explanation_cache_lookup ON public.explanation_cache USING btree (formula_hash, language);


--
-- Name: idx_geo_cities_continent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_continent_id ON public.geo_cities USING btree (continent_id);


--
-- Name: idx_geo_cities_coord_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_coord_source ON public.geo_cities USING btree (coordinate_source_id) WHERE ((coordinate_source_id)::text <> 'wof'::text);


--
-- Name: idx_geo_cities_country_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_country_id ON public.geo_cities USING btree (country_id);


--
-- Name: idx_geo_cities_district; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_district ON public.geo_cities USING btree (district_id);


--
-- Name: idx_geo_cities_district_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_district_name ON public.geo_cities USING btree (district_id, name, population DESC NULLS LAST) WHERE (district_id IS NOT NULL);


--
-- Name: idx_geo_cities_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_location ON public.geo_cities USING gist (location);


--
-- Name: idx_geo_cities_name_ascii_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_name_ascii_trgm ON public.geo_cities USING gin (name_ascii public.gin_trgm_ops);


--
-- Name: idx_geo_cities_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_name_trgm ON public.geo_cities USING gin (name public.gin_trgm_ops);


--
-- Name: idx_geo_cities_population; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_population ON public.geo_cities USING btree (population DESC NULLS LAST);


--
-- Name: idx_geo_cities_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_region ON public.geo_cities USING btree (region_id);


--
-- Name: idx_geo_cities_region_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_region_name ON public.geo_cities USING btree (region_id, name, population DESC NULLS LAST) WHERE (region_id IS NOT NULL);


--
-- Name: idx_geo_cities_name_population; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_name_population ON public.geo_cities USING btree (name, population DESC NULLS LAST);


--
-- Name: idx_geo_cities_country_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_country_name ON public.geo_cities USING btree (country_id, name, population DESC NULLS LAST);


--
-- Name: idx_geo_cities_wof_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_wof_id ON public.geo_cities USING btree (wof_id) WHERE (wof_id IS NOT NULL);


--
-- Name: idx_geo_cities_zmanim_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_cities_zmanim_lookup ON public.geo_cities USING btree (id) INCLUDE (latitude, longitude, elevation_m, timezone, coordinate_source_id, elevation_source_id);


--
-- Name: idx_geo_city_coordinates_priority_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_city_coordinates_priority_lookup ON public.geo_city_coordinates USING btree (city_id, source_id) INCLUDE (latitude, longitude, accuracy_m, publisher_id, verified_at);


--
-- Name: idx_geo_city_coordinates_publisher_override; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_city_coordinates_publisher_override ON public.geo_city_coordinates USING btree (city_id, publisher_id) WHERE (source_id = 1);


--
-- Name: idx_geo_city_coordinates_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_city_coordinates_source ON public.geo_city_coordinates USING btree (source_id);


--
-- Name: idx_geo_city_coordinates_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_geo_city_coordinates_unique ON public.geo_city_coordinates USING btree (city_id, source_id, COALESCE(publisher_id, 0));


--
-- Name: idx_geo_city_elevations_priority_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_city_elevations_priority_lookup ON public.geo_city_elevations USING btree (city_id, coordinate_source_id, source_id) INCLUDE (elevation_m, accuracy_m, publisher_id, verified_at);


--
-- Name: idx_geo_city_elevations_publisher_override; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_city_elevations_publisher_override ON public.geo_city_elevations USING btree (city_id, publisher_id) WHERE (source_id = 1);


--
-- Name: idx_geo_city_elevations_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_city_elevations_source ON public.geo_city_elevations USING btree (source_id);


--
-- Name: idx_geo_city_elevations_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_geo_city_elevations_unique ON public.geo_city_elevations USING btree (city_id, coordinate_source_id, source_id, COALESCE(publisher_id, 0));


--
-- Name: idx_geo_continents_wof_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_continents_wof_id ON public.geo_continents USING btree (wof_id) WHERE (wof_id IS NOT NULL);


--
-- Name: idx_geo_countries_continent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_countries_continent ON public.geo_countries USING btree (continent_id);


--
-- Name: idx_geo_countries_continent_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_countries_continent_name ON public.geo_countries USING btree (continent_id, name);


--
-- Name: idx_geo_countries_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_countries_name_trgm ON public.geo_countries USING gin (name public.gin_trgm_ops);


--
-- Name: idx_geo_countries_wof_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_countries_wof_id ON public.geo_countries USING btree (wof_id) WHERE (wof_id IS NOT NULL);


--
-- Name: idx_geo_data_imports_source_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_data_imports_source_started ON public.geo_data_imports USING btree (source_id, started_at DESC);


--
-- Name: idx_geo_districts_continent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_districts_continent ON public.geo_districts USING btree (continent_id);


--
-- Name: idx_geo_districts_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_districts_country ON public.geo_districts USING btree (country_id);


--
-- Name: idx_geo_districts_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_districts_name_trgm ON public.geo_districts USING gin (name public.gin_trgm_ops);


--
-- Name: idx_geo_districts_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_districts_region ON public.geo_districts USING btree (region_id);


--
-- Name: idx_geo_districts_region_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_districts_region_name ON public.geo_districts USING btree (region_id, name);


--
-- Name: idx_geo_districts_wof_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_districts_wof_id ON public.geo_districts USING btree (wof_id) WHERE (wof_id IS NOT NULL);


--
-- Name: idx_geo_names_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_names_entity ON public.geo_names USING btree (entity_type_id, entity_id);


--
-- Name: idx_geo_names_language; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_names_language ON public.geo_names USING btree (language_code);


--
-- Name: idx_geo_names_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_names_name_trgm ON public.geo_names USING gin (name public.gin_trgm_ops);


--
-- Name: idx_geo_regions_continent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_regions_continent ON public.geo_regions USING btree (continent_id);


--
-- Name: idx_geo_regions_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_regions_country ON public.geo_regions USING btree (country_id);


--
-- Name: idx_geo_regions_country_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_regions_country_name ON public.geo_regions USING btree (country_id, name);


--
-- Name: idx_geo_regions_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_regions_name_trgm ON public.geo_regions USING gin (name public.gin_trgm_ops);


--
-- Name: idx_geo_regions_wof_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geo_regions_wof_id ON public.geo_regions USING btree (wof_id) WHERE (wof_id IS NOT NULL);


--
-- Name: idx_jewish_events_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jewish_events_code ON public.jewish_events USING btree (code);


--
-- Name: idx_jewish_events_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jewish_events_parent ON public.jewish_events USING btree (parent_event_id);


--
-- Name: idx_jewish_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jewish_events_type ON public.jewish_events USING btree (event_type_id);


--
-- Name: idx_master_registry_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_registry_category ON public.master_zmanim_registry USING btree (time_category_id);


--
-- Name: idx_master_registry_english_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_registry_english_name_trgm ON public.master_zmanim_registry USING gin (canonical_english_name public.gin_trgm_ops);


--
-- Name: idx_master_registry_hebrew_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_registry_hebrew_name_trgm ON public.master_zmanim_registry USING gin (canonical_hebrew_name public.gin_trgm_ops);


--
-- Name: idx_master_registry_hidden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_registry_hidden ON public.master_zmanim_registry USING btree (is_hidden);


--
-- Name: idx_master_registry_transliteration_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_registry_transliteration_trgm ON public.master_zmanim_registry USING gin (transliteration public.gin_trgm_ops);


--
-- Name: idx_master_registry_visible_by_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_registry_visible_by_category ON public.master_zmanim_registry USING btree (time_category_id, canonical_hebrew_name) WHERE (is_hidden = false);


--
-- Name: idx_master_zman_day_types_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_zman_day_types_day ON public.master_zman_day_types USING btree (day_type_id);


--
-- Name: idx_master_zman_day_types_zman; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_zman_day_types_zman ON public.master_zman_day_types USING btree (master_zman_id);


--
-- Name: idx_master_zman_events_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_zman_events_event ON public.master_zman_events USING btree (jewish_event_id);


--
-- Name: idx_master_zman_events_zman; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_zman_events_zman ON public.master_zman_events USING btree (master_zman_id);


--
-- Name: idx_master_zman_tags_covering; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_zman_tags_covering ON public.master_zman_tags USING btree (master_zman_id) INCLUDE (tag_id);


--
-- Name: idx_master_zman_tags_negated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_zman_tags_negated ON public.master_zman_tags USING btree (master_zman_id, is_negated);


--
-- Name: idx_master_zman_tags_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_zman_tags_tag ON public.master_zman_tags USING btree (tag_id);


--
-- Name: idx_master_zman_tags_zman; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_zman_tags_zman ON public.master_zman_tags USING btree (master_zman_id);


--
-- Name: idx_onboarding_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_publisher ON public.publisher_onboarding USING btree (publisher_id);


--
-- Name: idx_password_reset_tokens_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_email ON public.password_reset_tokens USING btree (email);


--
-- Name: idx_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_pub_zman_day_types_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pub_zman_day_types_day ON public.publisher_zman_day_types USING btree (day_type_id);


--
-- Name: idx_pub_zman_day_types_zman; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pub_zman_day_types_zman ON public.publisher_zman_day_types USING btree (publisher_zman_id);


--
-- Name: idx_publisher_coverage_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_coverage_active ON public.publisher_coverage USING btree (publisher_id, is_active) WHERE (is_active = true);


--
-- Name: idx_publisher_coverage_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_coverage_city ON public.publisher_coverage USING btree (city_id) WHERE (city_id IS NOT NULL);


--
-- Name: idx_publisher_coverage_continent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_coverage_continent ON public.publisher_coverage USING btree (continent_id) WHERE (continent_id IS NOT NULL);


--
-- Name: idx_publisher_coverage_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_coverage_country ON public.publisher_coverage USING btree (country_id) WHERE (country_id IS NOT NULL);


--
-- Name: idx_publisher_coverage_district; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_coverage_district ON public.publisher_coverage USING btree (district_id) WHERE (district_id IS NOT NULL);


--
-- Name: idx_publisher_coverage_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_coverage_publisher ON public.publisher_coverage USING btree (publisher_id);


--
-- Name: idx_publisher_coverage_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_coverage_region ON public.publisher_coverage USING btree (region_id) WHERE (region_id IS NOT NULL);


--
-- Name: idx_publisher_coverage_unique_city; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_publisher_coverage_unique_city ON public.publisher_coverage USING btree (publisher_id, city_id) WHERE (city_id IS NOT NULL);


--
-- Name: idx_publisher_coverage_unique_continent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_publisher_coverage_unique_continent ON public.publisher_coverage USING btree (publisher_id, continent_id) WHERE (continent_id IS NOT NULL);


--
-- Name: idx_publisher_coverage_unique_country; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_publisher_coverage_unique_country ON public.publisher_coverage USING btree (publisher_id, country_id) WHERE (country_id IS NOT NULL);


--
-- Name: idx_publisher_coverage_unique_district; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_publisher_coverage_unique_district ON public.publisher_coverage USING btree (publisher_id, district_id) WHERE (district_id IS NOT NULL);


--
-- Name: idx_publisher_coverage_unique_region; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_publisher_coverage_unique_region ON public.publisher_coverage USING btree (publisher_id, region_id) WHERE (region_id IS NOT NULL);


--
-- Name: idx_publisher_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_invitations_email ON public.publisher_invitations USING btree (email, publisher_id);


--
-- Name: idx_publisher_invitations_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_invitations_publisher ON public.publisher_invitations USING btree (publisher_id);


--
-- Name: idx_publisher_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_invitations_token ON public.publisher_invitations USING btree (token);


--
-- Name: idx_publisher_requests_email_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_publisher_requests_email_pending ON public.publisher_requests USING btree (email) WHERE (status_id = 1);


--
-- Name: idx_publisher_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_requests_status ON public.publisher_requests USING btree (status_id);


--
-- Name: idx_publisher_snapshots_publisher_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_snapshots_publisher_created ON public.publisher_snapshots USING btree (publisher_id, created_at DESC);


--
-- Name: idx_publisher_zman_aliases_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zman_aliases_publisher ON public.publisher_zman_aliases USING btree (publisher_id);


--
-- Name: idx_publisher_zman_aliases_zman; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zman_aliases_zman ON public.publisher_zman_aliases USING btree (publisher_zman_id);


--
-- Name: idx_publisher_zman_events_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zman_events_composite ON public.publisher_zman_events USING btree (publisher_zman_id, jewish_event_id);


--
-- Name: idx_publisher_zman_events_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zman_events_event ON public.publisher_zman_events USING btree (jewish_event_id);


--
-- Name: idx_publisher_zman_events_zman; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zman_events_zman ON public.publisher_zman_events USING btree (publisher_zman_id);


--
-- Name: idx_publisher_zman_tags_negated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zman_tags_negated ON public.publisher_zman_tags USING btree (publisher_zman_id, is_negated);


--
-- Name: idx_publisher_zman_tags_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zman_tags_tag ON public.publisher_zman_tags USING btree (tag_id);


--
-- Name: idx_publisher_zman_tags_zman; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zman_tags_zman ON public.publisher_zman_tags USING btree (publisher_zman_id);


--
-- Name: idx_publisher_zman_versions_zman_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zman_versions_zman_version ON public.publisher_zman_versions USING btree (publisher_zman_id, version_number DESC);


--
-- Name: idx_publisher_zmanim_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_active ON public.publisher_zmanim USING btree (publisher_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_publisher_zmanim_active_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_active_enabled ON public.publisher_zmanim USING btree (publisher_id, is_enabled) WHERE (deleted_at IS NULL);


--
-- Name: idx_publisher_zmanim_beta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_beta ON public.publisher_zmanim USING btree (publisher_id, is_beta) WHERE (is_beta = true);


--
-- Name: idx_publisher_zmanim_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_category ON public.publisher_zmanim USING btree (time_category_id);


--
-- Name: idx_publisher_zmanim_custom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_custom ON public.publisher_zmanim USING btree (publisher_id, is_custom) WHERE (is_custom = true);


--
-- Name: idx_publisher_zmanim_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_deleted ON public.publisher_zmanim USING btree (publisher_id, deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_publisher_zmanim_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_enabled ON public.publisher_zmanim USING btree (publisher_id, is_enabled) WHERE (is_enabled = true);


--
-- Name: idx_publisher_zmanim_english_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_english_name_trgm ON public.publisher_zmanim USING gin (english_name public.gin_trgm_ops) WHERE ((is_published = true) AND (is_visible = true));


--
-- Name: idx_publisher_zmanim_hebrew_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_hebrew_name_trgm ON public.publisher_zmanim USING gin (hebrew_name public.gin_trgm_ops) WHERE ((is_published = true) AND (is_visible = true));


--
-- Name: idx_publisher_zmanim_key_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_key_lookup ON public.publisher_zmanim USING btree (publisher_id, zman_key) WHERE (deleted_at IS NULL);


--
-- Name: idx_publisher_zmanim_linked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_linked ON public.publisher_zmanim USING btree (linked_publisher_zman_id);


--
-- Name: idx_publisher_zmanim_linked_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_linked_source ON public.publisher_zmanim USING btree (publisher_id, source_type_id, linked_publisher_zman_id) WHERE (source_type_id = 3);


--
-- Name: idx_publisher_zmanim_master; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_master ON public.publisher_zmanim USING btree (master_zman_id);


--
-- Name: idx_publisher_zmanim_public_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_public_search ON public.publisher_zmanim USING btree (is_published, is_visible, time_category_id) WHERE ((is_published = true) AND (is_visible = true));


--
-- Name: idx_publisher_zmanim_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_published ON public.publisher_zmanim USING btree (publisher_id, is_published) WHERE (is_published = true);


--
-- Name: idx_publisher_zmanim_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publisher_zmanim_source_type ON public.publisher_zmanim USING btree (source_type_id);


--
-- Name: idx_publishers_clerk_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_clerk_user_id ON public.publishers USING btree (clerk_user_id);


--
-- Name: idx_publishers_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_deleted_at ON public.publishers USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_publishers_id_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_id_name ON public.publishers USING btree (id) INCLUDE (name, status_id, is_verified);


--
-- Name: idx_publishers_is_certified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_is_certified ON public.publishers USING btree (is_certified);


--
-- Name: idx_publishers_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_location ON public.publishers USING gist (location);


--
-- Name: idx_publishers_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_publishers_slug ON public.publishers USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: idx_publishers_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_status ON public.publishers USING btree (status_id);


--
-- Name: idx_publishers_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_publishers_verified ON public.publishers USING btree (is_verified) WHERE (is_verified = true);


--
-- Name: idx_region_boundaries_centroid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_region_boundaries_centroid ON public.geo_region_boundaries USING gist (centroid);


--
-- Name: idx_region_boundaries_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_region_boundaries_geom ON public.geo_region_boundaries USING gist (boundary);


--
-- Name: idx_region_boundaries_simplified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_region_boundaries_simplified ON public.geo_region_boundaries USING gist (boundary_simplified);


--
-- Name: idx_system_config_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_config_key ON public.system_config USING btree (key);


--
-- Name: idx_tag_event_mappings_hebrew_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_event_mappings_hebrew_date ON public.tag_event_mappings USING btree (hebrew_month, hebrew_day_start) WHERE (hebrew_month IS NOT NULL);


--
-- Name: idx_tag_event_mappings_pattern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_event_mappings_pattern ON public.tag_event_mappings USING btree (hebcal_event_pattern) WHERE (hebcal_event_pattern IS NOT NULL);


--
-- Name: idx_tag_event_mappings_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_event_mappings_tag ON public.tag_event_mappings USING btree (tag_id);


--
-- Name: idx_tag_types_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_types_key ON public.tag_types USING btree (key);


--
-- Name: idx_tag_types_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tag_types_sort ON public.tag_types USING btree (sort_order);


--
-- Name: idx_time_categories_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_categories_key ON public.time_categories USING btree (key);


--
-- Name: idx_time_categories_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_categories_sort ON public.time_categories USING btree (sort_order);


--
-- Name: idx_zman_registry_requests_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zman_registry_requests_pending ON public.zman_registry_requests USING btree (created_at DESC) WHERE (status_id = 1);


--
-- Name: idx_zman_registry_requests_publisher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zman_registry_requests_publisher ON public.zman_registry_requests USING btree (publisher_id);


--
-- Name: idx_zman_registry_requests_publisher_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zman_registry_requests_publisher_created ON public.zman_registry_requests USING btree (publisher_id, created_at DESC);


--
-- Name: idx_zman_registry_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zman_registry_requests_status ON public.zman_registry_requests USING btree (status_id);


--
-- Name: idx_zman_request_tags_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zman_request_tags_request ON public.zman_request_tags USING btree (request_id);


--
-- Name: idx_zman_request_tags_tag; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zman_request_tags_tag ON public.zman_request_tags USING btree (tag_id) WHERE (tag_id IS NOT NULL);


--
-- Name: idx_zman_tags_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zman_tags_type ON public.zman_tags USING btree (tag_type_id);


--
-- Name: ai_index_status ai_index_status_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_index_status_updated_at BEFORE UPDATE ON public.ai_index_status FOR EACH ROW EXECUTE FUNCTION public.update_embeddings_updated_at();


--
-- Name: embeddings embeddings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER embeddings_updated_at BEFORE UPDATE ON public.embeddings FOR EACH ROW EXECUTE FUNCTION public.update_embeddings_updated_at();


--
-- Name: master_zmanim_registry master_registry_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER master_registry_updated_at BEFORE UPDATE ON public.master_zmanim_registry FOR EACH ROW EXECUTE FUNCTION public.update_master_registry_updated_at();


--
-- Name: publisher_zman_versions prune_versions_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prune_versions_trigger AFTER INSERT ON public.publisher_zman_versions FOR EACH ROW EXECUTE FUNCTION public.prune_zman_versions();


--
-- Name: publisher_zman_day_types publisher_zman_day_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER publisher_zman_day_types_updated_at BEFORE UPDATE ON public.publisher_zman_day_types FOR EACH ROW EXECUTE FUNCTION public.update_publisher_zman_day_types_updated_at();


--
-- Name: publisher_zman_events publisher_zman_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER publisher_zman_events_updated_at BEFORE UPDATE ON public.publisher_zman_events FOR EACH ROW EXECUTE FUNCTION public.update_publisher_zman_events_updated_at();


--
-- Name: publisher_zmanim publisher_zmanim_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER publisher_zmanim_updated_at BEFORE UPDATE ON public.publisher_zmanim FOR EACH ROW EXECUTE FUNCTION public.update_publisher_zmanim_updated_at();


--
-- Name: geo_city_coordinates trg_geo_city_coordinates_update_effective; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_geo_city_coordinates_update_effective AFTER INSERT OR UPDATE ON public.geo_city_coordinates FOR EACH ROW EXECUTE FUNCTION public.trg_update_effective_geo_city_coordinates();


--
-- Name: geo_city_elevations trg_geo_city_elevations_update_effective; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_geo_city_elevations_update_effective AFTER INSERT OR UPDATE ON public.geo_city_elevations FOR EACH ROW EXECUTE FUNCTION public.trg_update_effective_city_elevation();


--
-- Name: geo_cities trg_validate_city_hierarchy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_city_hierarchy BEFORE INSERT OR UPDATE ON public.geo_cities FOR EACH ROW EXECUTE FUNCTION public.validate_city_hierarchy();


--
-- Name: geo_districts trg_validate_district_hierarchy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_district_hierarchy BEFORE INSERT OR UPDATE ON public.geo_districts FOR EACH ROW EXECUTE FUNCTION public.validate_district_hierarchy();


--
-- Name: geo_regions trg_validate_region_hierarchy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_region_hierarchy BEFORE INSERT OR UPDATE ON public.geo_regions FOR EACH ROW EXECUTE FUNCTION public.validate_region_hierarchy();


--
-- Name: publisher_snapshots trigger_prune_publisher_snapshots; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_prune_publisher_snapshots AFTER INSERT ON public.publisher_snapshots FOR EACH ROW EXECUTE FUNCTION public.prune_publisher_snapshots();


--
-- Name: algorithms update_algorithms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_algorithms_updated_at BEFORE UPDATE ON public.algorithms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: geo_cities update_geo_cities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_geo_cities_updated_at BEFORE UPDATE ON public.geo_cities FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();


--
-- Name: geo_countries update_geo_countries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_geo_countries_updated_at BEFORE UPDATE ON public.geo_countries FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();


--
-- Name: geo_country_boundaries update_geo_country_boundaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_geo_country_boundaries_updated_at BEFORE UPDATE ON public.geo_country_boundaries FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();


--
-- Name: geo_district_boundaries update_geo_district_boundaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_geo_district_boundaries_updated_at BEFORE UPDATE ON public.geo_district_boundaries FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();


--
-- Name: geo_districts update_geo_districts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_geo_districts_updated_at BEFORE UPDATE ON public.geo_districts FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();


--
-- Name: geo_region_boundaries update_geo_region_boundaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_geo_region_boundaries_updated_at BEFORE UPDATE ON public.geo_region_boundaries FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();


--
-- Name: geo_regions update_geo_regions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_geo_regions_updated_at BEFORE UPDATE ON public.geo_regions FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();


--
-- Name: publisher_coverage update_publisher_coverage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_publisher_coverage_updated_at BEFORE UPDATE ON public.publisher_coverage FOR EACH ROW EXECUTE FUNCTION public.update_geo_updated_at();


--
-- Name: ai_audit_logs ai_audit_logs_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_audit_logs
    ADD CONSTRAINT ai_audit_logs_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE SET NULL;


--
-- Name: algorithms algorithms_forked_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.algorithms
    ADD CONSTRAINT algorithms_forked_from_fkey FOREIGN KEY (forked_from) REFERENCES public.algorithms(id) ON DELETE SET NULL;


--
-- Name: algorithms algorithms_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.algorithms
    ADD CONSTRAINT algorithms_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: algorithm_version_history fk_algorithm_version_history_algorithm; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.algorithm_version_history
    ADD CONSTRAINT fk_algorithm_version_history_algorithm FOREIGN KEY (algorithm_id) REFERENCES public.algorithms(id) ON DELETE CASCADE;


--
-- Name: algorithm_rollback_audit fk_rollback_audit_algorithm; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.algorithm_rollback_audit
    ADD CONSTRAINT fk_rollback_audit_algorithm FOREIGN KEY (algorithm_id) REFERENCES public.algorithms(id) ON DELETE CASCADE;


--
-- Name: geo_cities geo_cities_continent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_cities
    ADD CONSTRAINT geo_cities_continent_id_fkey FOREIGN KEY (continent_id) REFERENCES public.geo_continents(id);


--
-- Name: geo_cities geo_cities_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_cities
    ADD CONSTRAINT geo_cities_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);


--
-- Name: geo_cities geo_cities_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_cities
    ADD CONSTRAINT geo_cities_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id);


--
-- Name: geo_cities geo_cities_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_cities
    ADD CONSTRAINT geo_cities_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.geo_regions(id);


--
-- Name: geo_cities geo_cities_coordinate_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_cities
    ADD CONSTRAINT geo_cities_coordinate_source_id_fkey FOREIGN KEY (coordinate_source_id) REFERENCES public.geo_data_sources(id);


--
-- Name: geo_cities geo_cities_elevation_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_cities
    ADD CONSTRAINT geo_cities_elevation_source_id_fkey FOREIGN KEY (elevation_source_id) REFERENCES public.geo_data_sources(id);


--
-- Name: geo_city_boundaries geo_city_boundaries_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_boundaries
    ADD CONSTRAINT geo_city_boundaries_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.geo_cities(id) ON DELETE CASCADE;


--
-- Name: geo_city_coordinates geo_city_coordinates_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_coordinates
    ADD CONSTRAINT geo_city_coordinates_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.geo_cities(id) ON DELETE CASCADE;


--
-- Name: geo_city_coordinates geo_city_coordinates_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_coordinates
    ADD CONSTRAINT geo_city_coordinates_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE SET NULL;


--
-- Name: geo_city_coordinates geo_city_coordinates_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_coordinates
    ADD CONSTRAINT geo_city_coordinates_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.geo_data_sources(id);


--
-- Name: geo_city_elevations geo_city_elevations_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_elevations
    ADD CONSTRAINT geo_city_elevations_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.geo_cities(id) ON DELETE CASCADE;


--
-- Name: geo_city_elevations geo_city_elevations_coordinate_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_elevations
    ADD CONSTRAINT geo_city_elevations_coordinate_source_id_fkey FOREIGN KEY (coordinate_source_id) REFERENCES public.geo_data_sources(id);


--
-- Name: geo_city_elevations geo_city_elevations_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_elevations
    ADD CONSTRAINT geo_city_elevations_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE SET NULL;


--
-- Name: geo_city_elevations geo_city_elevations_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_city_elevations
    ADD CONSTRAINT geo_city_elevations_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.geo_data_sources(id);


--
-- Name: geo_countries geo_countries_continent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_continent_id_fkey FOREIGN KEY (continent_id) REFERENCES public.geo_continents(id);


--
-- Name: geo_country_boundaries geo_country_boundaries_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_country_boundaries
    ADD CONSTRAINT geo_country_boundaries_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id) ON DELETE CASCADE;


--
-- Name: geo_district_boundaries geo_district_boundaries_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_district_boundaries
    ADD CONSTRAINT geo_district_boundaries_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id) ON DELETE CASCADE;


--
-- Name: geo_districts geo_districts_continent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_continent_id_fkey FOREIGN KEY (continent_id) REFERENCES public.geo_continents(id);


--
-- Name: geo_districts geo_districts_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id);


--
-- Name: geo_districts geo_districts_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_districts
    ADD CONSTRAINT geo_districts_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.geo_regions(id) ON DELETE CASCADE;


--
-- Name: geo_names geo_names_language_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_names
    ADD CONSTRAINT geo_names_language_code_fkey FOREIGN KEY (language_code) REFERENCES public.languages(code) ON DELETE CASCADE;


--
-- Name: geo_names geo_names_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_names
    ADD CONSTRAINT geo_names_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.geo_data_sources(id);


--
-- Name: geo_region_boundaries geo_region_boundaries_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_name_mappings
    ADD CONSTRAINT geo_name_mappings_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.geo_data_sources(id);


--
-- Name: geo_region_boundaries geo_region_boundaries_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_region_boundaries
    ADD CONSTRAINT geo_region_boundaries_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.geo_regions(id) ON DELETE CASCADE;


--
-- Name: geo_regions geo_regions_continent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_regions
    ADD CONSTRAINT geo_regions_continent_id_fkey FOREIGN KEY (continent_id) REFERENCES public.geo_continents(id);


--
-- Name: geo_regions geo_regions_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_regions
    ADD CONSTRAINT geo_regions_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id) ON DELETE CASCADE;


--
-- Name: master_zman_day_types master_zman_day_types_day_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zman_day_types
    ADD CONSTRAINT master_zman_day_types_day_type_id_fkey FOREIGN KEY (day_type_id) REFERENCES public.day_types(id) ON DELETE CASCADE;


--
-- Name: master_zman_day_types master_zman_day_types_master_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zman_day_types
    ADD CONSTRAINT master_zman_day_types_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id) ON DELETE CASCADE;


--
-- Name: master_zman_events master_zman_events_jewish_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zman_events
    ADD CONSTRAINT master_zman_events_jewish_event_id_fkey FOREIGN KEY (jewish_event_id) REFERENCES public.jewish_events(id) ON DELETE CASCADE;


--
-- Name: master_zman_events master_zman_events_master_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zman_events
    ADD CONSTRAINT master_zman_events_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id) ON DELETE CASCADE;


--
-- Name: master_zman_tags master_zman_tags_master_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zman_tags
    ADD CONSTRAINT master_zman_tags_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id) ON DELETE CASCADE;


--
-- Name: master_zman_tags master_zman_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zman_tags
    ADD CONSTRAINT master_zman_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.zman_tags(id) ON DELETE CASCADE;


--
-- Name: publisher_coverage publisher_coverage_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_coverage
    ADD CONSTRAINT publisher_coverage_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.geo_cities(id) ON DELETE CASCADE;


--
-- Name: publisher_coverage publisher_coverage_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_coverage
    ADD CONSTRAINT publisher_coverage_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.geo_countries(id) ON DELETE CASCADE;


--
-- Name: publisher_coverage publisher_coverage_district_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_coverage
    ADD CONSTRAINT publisher_coverage_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.geo_districts(id) ON DELETE CASCADE;


--
-- Name: publisher_coverage publisher_coverage_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_coverage
    ADD CONSTRAINT publisher_coverage_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: publisher_coverage publisher_coverage_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_coverage
    ADD CONSTRAINT publisher_coverage_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.geo_regions(id) ON DELETE CASCADE;


--
-- Name: publisher_coverage publisher_coverage_continent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_coverage
    ADD CONSTRAINT publisher_coverage_continent_id_fkey FOREIGN KEY (continent_id) REFERENCES public.geo_continents(id) ON DELETE CASCADE;


--
-- Name: publisher_invitations publisher_invitations_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_invitations
    ADD CONSTRAINT publisher_invitations_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: publisher_onboarding publisher_onboarding_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_onboarding
    ADD CONSTRAINT publisher_onboarding_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: publisher_snapshots publisher_snapshots_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_snapshots
    ADD CONSTRAINT publisher_snapshots_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: publisher_zman_aliases publisher_zman_aliases_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_aliases
    ADD CONSTRAINT publisher_zman_aliases_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: publisher_zman_aliases publisher_zman_aliases_publisher_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_aliases
    ADD CONSTRAINT publisher_zman_aliases_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;


--
-- Name: publisher_zman_day_types publisher_zman_day_types_day_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_day_types
    ADD CONSTRAINT publisher_zman_day_types_day_type_id_fkey FOREIGN KEY (day_type_id) REFERENCES public.day_types(id) ON DELETE CASCADE;


--
-- Name: publisher_zman_day_types publisher_zman_day_types_publisher_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_day_types
    ADD CONSTRAINT publisher_zman_day_types_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;


--
-- Name: publisher_zman_events publisher_zman_events_jewish_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_events
    ADD CONSTRAINT publisher_zman_events_jewish_event_id_fkey FOREIGN KEY (jewish_event_id) REFERENCES public.jewish_events(id) ON DELETE CASCADE;


--
-- Name: publisher_zman_events publisher_zman_events_publisher_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_events
    ADD CONSTRAINT publisher_zman_events_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;


--
-- Name: publisher_zman_tags publisher_zman_tags_publisher_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_tags
    ADD CONSTRAINT publisher_zman_tags_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;


--
-- Name: publisher_zman_tags publisher_zman_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_tags
    ADD CONSTRAINT publisher_zman_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.zman_tags(id) ON DELETE CASCADE;


--
-- Name: publisher_zman_versions publisher_zman_versions_publisher_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zman_versions
    ADD CONSTRAINT publisher_zman_versions_publisher_zman_id_fkey FOREIGN KEY (publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE CASCADE;


--
-- Name: publisher_zmanim publisher_zmanim_linked_publisher_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zmanim
    ADD CONSTRAINT publisher_zmanim_linked_publisher_zman_id_fkey FOREIGN KEY (linked_publisher_zman_id) REFERENCES public.publisher_zmanim(id) ON DELETE SET NULL;


--
-- Name: publisher_zmanim publisher_zmanim_master_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zmanim
    ADD CONSTRAINT publisher_zmanim_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id);


--
-- Name: publisher_zmanim publisher_zmanim_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zmanim
    ADD CONSTRAINT publisher_zmanim_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: tag_event_mappings tag_event_mappings_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_event_mappings
    ADD CONSTRAINT tag_event_mappings_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.zman_tags(id) ON DELETE CASCADE;


--
-- Name: zman_display_contexts zman_display_contexts_master_zman_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_display_contexts
    ADD CONSTRAINT zman_display_contexts_master_zman_id_fkey FOREIGN KEY (master_zman_id) REFERENCES public.master_zmanim_registry(id) ON DELETE CASCADE;


--
-- Name: zman_registry_requests zman_registry_requests_publisher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_registry_requests
    ADD CONSTRAINT zman_registry_requests_publisher_id_fkey FOREIGN KEY (publisher_id) REFERENCES public.publishers(id) ON DELETE CASCADE;


--
-- Name: zman_request_tags zman_request_tags_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_request_tags
    ADD CONSTRAINT zman_request_tags_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.zman_registry_requests(id) ON DELETE CASCADE;


--
-- Name: zman_request_tags zman_request_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_request_tags
    ADD CONSTRAINT zman_request_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.zman_tags(id) ON DELETE SET NULL;


--
-- Name: algorithms algorithms_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.algorithms
    ADD CONSTRAINT algorithms_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.algorithm_statuses(id);


--
-- Name: ai_index_status ai_index_status_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_index_status
    ADD CONSTRAINT ai_index_status_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.ai_content_sources(id);


--
-- Name: ai_index_status ai_index_status_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_index_status
    ADD CONSTRAINT ai_index_status_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.ai_index_statuses(id);


--
-- Name: astronomical_primitives astronomical_primitives_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.astronomical_primitives
    ADD CONSTRAINT astronomical_primitives_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.primitive_categories(id);


--
-- Name: astronomical_primitives astronomical_primitives_calculation_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.astronomical_primitives
    ADD CONSTRAINT astronomical_primitives_calculation_type_id_fkey FOREIGN KEY (calculation_type_id) REFERENCES public.calculation_types(id);


--
-- Name: astronomical_primitives astronomical_primitives_edge_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.astronomical_primitives
    ADD CONSTRAINT astronomical_primitives_edge_type_id_fkey FOREIGN KEY (edge_type_id) REFERENCES public.edge_types(id);


--
-- Name: day_types day_types_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_types
    ADD CONSTRAINT day_types_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.day_types(id);


--
-- Name: embeddings embeddings_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.ai_content_sources(id);


--
-- Name: explanation_cache explanation_cache_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.explanation_cache
    ADD CONSTRAINT explanation_cache_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.explanation_sources(id);


--
-- Name: geo_boundary_imports geo_boundary_imports_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_boundary_imports
    ADD CONSTRAINT geo_boundary_imports_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.geo_data_sources(id);


--
-- Name: geo_boundary_imports geo_boundary_imports_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_boundary_imports
    ADD CONSTRAINT geo_boundary_imports_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.geo_levels(id);


--
-- Name: geo_data_imports geo_data_imports_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_data_imports
    ADD CONSTRAINT geo_data_imports_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.geo_data_sources(id);


--
-- Name: geo_data_sources geo_data_sources_data_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_data_sources
    ADD CONSTRAINT geo_data_sources_data_type_id_fkey FOREIGN KEY (data_type_id) REFERENCES public.data_types(id);


--
-- Name: geo_name_mappings geo_name_mappings_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_name_mappings
    ADD CONSTRAINT geo_name_mappings_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.geo_levels(id);


--
-- Name: geo_names geo_names_entity_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_names
    ADD CONSTRAINT geo_names_entity_type_id_fkey FOREIGN KEY (entity_type_id) REFERENCES public.geo_levels(id);


--
-- Name: jewish_events jewish_events_event_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jewish_events
    ADD CONSTRAINT jewish_events_event_type_id_fkey FOREIGN KEY (event_type_id) REFERENCES public.jewish_event_types(id);


--
-- Name: jewish_events jewish_events_fast_start_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jewish_events
    ADD CONSTRAINT jewish_events_fast_start_type_id_fkey FOREIGN KEY (fast_start_type_id) REFERENCES public.fast_start_types(id);


--
-- Name: jewish_events jewish_events_parent_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jewish_events
    ADD CONSTRAINT jewish_events_parent_event_id_fkey FOREIGN KEY (parent_event_id) REFERENCES public.jewish_events(id);


--
-- Name: master_zmanim_registry master_zmanim_registry_time_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_zmanim_registry
    ADD CONSTRAINT master_zmanim_registry_time_category_id_fkey FOREIGN KEY (time_category_id) REFERENCES public.time_categories(id);


--
-- Name: publisher_coverage publisher_coverage_coverage_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_coverage
    ADD CONSTRAINT publisher_coverage_coverage_level_id_fkey FOREIGN KEY (coverage_level_id) REFERENCES public.coverage_levels(id);


--
-- Name: publisher_invitations publisher_invitations_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_invitations
    ADD CONSTRAINT publisher_invitations_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.publisher_roles(id);


--
-- Name: publisher_requests publisher_requests_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_requests
    ADD CONSTRAINT publisher_requests_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.request_statuses(id);


--
-- Name: publisher_zmanim publisher_zmanim_source_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zmanim
    ADD CONSTRAINT publisher_zmanim_source_type_id_fkey FOREIGN KEY (source_type_id) REFERENCES public.zman_source_types(id);


--
-- Name: publisher_zmanim publisher_zmanim_time_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publisher_zmanim
    ADD CONSTRAINT publisher_zmanim_time_category_id_fkey FOREIGN KEY (time_category_id) REFERENCES public.time_categories(id);


--
-- Name: publishers publishers_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publishers
    ADD CONSTRAINT publishers_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.publisher_statuses(id);


--
-- Name: zman_registry_requests zman_registry_requests_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_registry_requests
    ADD CONSTRAINT zman_registry_requests_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.request_statuses(id);


--
-- Name: zman_registry_requests zman_registry_requests_time_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_registry_requests
    ADD CONSTRAINT zman_registry_requests_time_category_id_fkey FOREIGN KEY (time_category_id) REFERENCES public.time_categories(id);


--
-- Name: zman_tags zman_tags_tag_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zman_tags
    ADD CONSTRAINT zman_tags_tag_type_id_fkey FOREIGN KEY (tag_type_id) REFERENCES public.tag_types(id);


--
-- PostgreSQL database dump complete
--


