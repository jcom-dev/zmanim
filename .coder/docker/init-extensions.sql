-- Initialize PostgreSQL extensions for Shtetl Zmanim
-- This script runs automatically on database initialization
-- (placed in /docker-entrypoint-initdb.d/)

-- PostGIS: Geospatial data (existing functionality)
CREATE EXTENSION IF NOT EXISTS postgis;

-- pg_stat_statements: Query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- pgvector: Vector similarity search for RAG embeddings (Epic 4)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extensions are installed
DO $$
BEGIN
    -- Check PostGIS
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        RAISE EXCEPTION 'PostGIS extension failed to install';
    END IF;

    -- Check pgvector
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension failed to install';
    END IF;

    RAISE NOTICE 'All required extensions installed successfully';
END
$$;
