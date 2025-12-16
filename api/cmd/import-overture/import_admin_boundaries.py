#!/usr/bin/env python3
"""
Import administrative boundaries (countries, regions) from Overture division_area.parquet.

STREAMING VERSION: Uses DuckDB for fast parquet reading, streams directly to PostgreSQL.

Matching strategy:
- Countries: Match by ISO country code (safe, unique)
- Regions: Match by overture_id (already stored from division.parquet import)

Usage:
    python import_admin_boundaries.py [--data-dir ./data/overture]
"""

import argparse
import os
import sys
import time
from pathlib import Path

try:
    import duckdb
    import psycopg
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install duckdb 'psycopg[binary]'")
    sys.exit(1)


def get_database_url():
    """Get database URL from environment or .env file."""
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    env_file = Path(__file__).parent.parent.parent / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                if line.startswith("DATABASE_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def import_admin_boundaries(data_dir: str, database_url: str, regions_only: bool = False):
    """Import country and region boundaries using streaming."""

    data_path = Path(data_dir)
    parquet_pattern = str(data_path / "division_area*.parquet")

    # Check if files exist
    parquet_files = list(data_path.glob("division_area*.parquet"))
    if not parquet_files:
        print(f"No division_area.parquet files found in {data_dir}")
        return

    print(f"Found {len(parquet_files)} parquet file(s)")
    if regions_only:
        print("Mode: regions only (skipping countries)")
    start_time = time.time()

    # Connect to PostgreSQL
    print("Connecting to PostgreSQL...")
    conn = psycopg.connect(database_url)

    # Create DuckDB connection (in-memory, just for parquet reading)
    duck = duckdb.connect(":memory:")

    batch_size = 500  # Smaller batches for geometry data (larger payloads)

    # Import countries (skip if regions_only)
    country_updated = 0
    if not regions_only:
        print("\nStreaming country boundaries...")
        # Query for country boundaries - keep largest per country
        query_countries = f"""
        SELECT country, geometry
        FROM (
            SELECT country, geometry,
                   ROW_NUMBER() OVER (PARTITION BY country ORDER BY octet_length(geometry) DESC) as rn
            FROM read_parquet('{parquet_pattern}')
            WHERE subtype IN ('country', 'dependency')
              AND country IS NOT NULL
              AND geometry IS NOT NULL
        ) t
        WHERE rn = 1
        """

        result = duck.execute(query_countries)
        while True:
            batch = result.fetchmany(batch_size)
            if not batch:
                break

            with conn.cursor() as cur:
                for country_code, geometry in batch:
                    try:
                        cur.execute("""
                            UPDATE geo_countries
                            SET boundary = ST_Multi(ST_GeomFromWKB(%s, 4326))
                            WHERE code = %s
                        """, (geometry, country_code))
                        if cur.rowcount > 0:
                            country_updated += 1
                    except Exception as e:
                        pass  # Skip errors silently
            conn.commit()
            print(f"  Countries: {country_updated} updated...", end="\r")

        print(f"  Countries: {country_updated} updated" + " " * 20)

    # Import region boundaries
    print("\nStreaming region boundaries...")
    # Query for region boundaries - keep largest per division_id
    query_regions = f"""
    SELECT division_id, geometry
    FROM (
        SELECT division_id, geometry,
               ROW_NUMBER() OVER (PARTITION BY division_id ORDER BY octet_length(geometry) DESC) as rn
        FROM read_parquet('{parquet_pattern}')
        WHERE subtype IN ('region', 'county', 'localadmin')
          AND division_id IS NOT NULL
          AND geometry IS NOT NULL
    ) t
    WHERE rn = 1
    """

    result = duck.execute(query_regions)
    region_updated = 0
    region_processed = 0

    while True:
        batch = result.fetchmany(batch_size)
        if not batch:
            break

        with conn.cursor() as cur:
            for division_id, geometry in batch:
                region_processed += 1
                try:
                    cur.execute("""
                        UPDATE geo_regions
                        SET boundary = ST_Multi(ST_GeomFromWKB(%s, 4326))
                        WHERE overture_id = %s
                    """, (geometry, division_id))
                    if cur.rowcount > 0:
                        region_updated += 1
                except Exception as e:
                    pass  # Skip errors silently
        conn.commit()

        if region_processed % 2000 == 0:
            print(f"  Regions: {region_updated} updated ({region_processed} processed)...", end="\r")

    print(f"  Regions: {region_updated} updated ({region_processed} processed)" + " " * 20)

    duck.close()
    conn.close()

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Admin boundary import complete!")
    print(f"  Countries: {country_updated}")
    print(f"  Regions: {region_updated}")
    print(f"  Duration: {elapsed:.1f}s")


def main():
    parser = argparse.ArgumentParser(
        description="Import country and region boundaries from Overture (STREAMING)"
    )
    parser.add_argument(
        "--data-dir",
        default="./data/overture",
        help="Directory containing parquet files"
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="PostgreSQL connection URL"
    )
    parser.add_argument(
        "--regions-only",
        action="store_true",
        help="Only import region boundaries (skip countries)"
    )

    args = parser.parse_args()

    database_url = args.database_url or get_database_url()
    if not database_url:
        print("Error: DATABASE_URL not set")
        sys.exit(1)

    import_admin_boundaries(args.data_dir, database_url, regions_only=args.regions_only)


if __name__ == "__main__":
    main()
