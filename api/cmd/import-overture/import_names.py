#!/usr/bin/env python3
"""
Import multi-language names from Overture division.parquet into geo_names.

PURE STREAMING VERSION: No intermediate storage - streams directly from parquet to PostgreSQL.
- DuckDB reads parquet and extracts names
- PostgreSQL does the JOIN to get entity_id
- Memory efficient: only holds one batch at a time

Usage:
    python import_names.py [--data-dir ./data/overture]
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


def import_names(data_dir: str, database_url: str):
    """Import multi-language names streaming directly from parquet to PostgreSQL."""

    data_path = Path(data_dir)
    parquet_file = data_path / "division.parquet"

    if not parquet_file.exists():
        print(f"Error: {parquet_file} not found")
        sys.exit(1)

    start_time = time.time()
    print(f"Importing names from {parquet_file}")

    # Connect to PostgreSQL
    print("Connecting to PostgreSQL...")
    conn = psycopg.connect(database_url)

    # Get source_id for Overture
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM geo_data_sources WHERE key = 'overture'")
        row = cur.fetchone()
        source_id = row[0] if row else 1
    print(f"  Source ID: {source_id}")

    # Truncate geo_names and disable FK for fast import
    print("Preparing geo_names table...")
    with conn.cursor() as cur:
        cur.execute("ALTER TABLE geo_names DROP CONSTRAINT IF EXISTS geo_names_language_code_fkey")
        cur.execute("TRUNCATE TABLE geo_names")
    conn.commit()
    print("  Truncated geo_names, disabled FK constraint")

    # Create DuckDB connection (in-memory, just for parquet reading)
    duck = duckdb.connect(":memory:")

    print("\nExtracting and streaming names to PostgreSQL...")
    print("(No intermediate storage - streaming directly)")

    total_names = 0
    batch_size = 5000  # Batch size for INSERT

    # Process each entity type
    for entity_type, subtypes, table_name in [
        ("country", ["country", "dependency"], "geo_countries"),
        ("region", ["region", "county", "localadmin"], "geo_regions"),
        ("locality", ["locality", "neighborhood", "macrohood", "microhood"], "geo_localities"),
    ]:
        print(f"\n  Processing {entity_type} names...")
        subtype_list = ", ".join(f"'{s}'" for s in subtypes)

        # Query 1: Primary names
        query_primary = f"""
        SELECT DISTINCT p.id as overture_id, p.names.primary as name
        FROM read_parquet('{parquet_file}') p
        WHERE p.subtype IN ({subtype_list}) AND p.names.primary IS NOT NULL
        """

        # Query 2: Common names - only simple 2-letter language codes (skip zh-Hans, pt-BR, etc)
        query_common = f"""
        SELECT DISTINCT p.id as overture_id, lang as language_code, name
        FROM read_parquet('{parquet_file}') p,
        LATERAL (SELECT UNNEST(map_keys(p.names.common)) as lang, UNNEST(map_values(p.names.common)) as name)
        WHERE p.subtype IN ({subtype_list}) AND p.names.common IS NOT NULL AND name IS NOT NULL
          AND length(lang) = 2
        """

        # Query 3: Rule-based names - only simple 2-letter language codes
        query_rules = f"""
        SELECT DISTINCT p.id as overture_id,
            COALESCE(r.language, 'en') as language_code,
            r.value as name, r.variant as name_type
        FROM read_parquet('{parquet_file}') p,
        LATERAL (SELECT UNNEST(p.names.rules) as r)
        WHERE p.subtype IN ({subtype_list}) AND p.names.rules IS NOT NULL
          AND r.value IS NOT NULL AND r.variant IN ('official', 'alternate', 'short')
          AND (r.language IS NULL OR length(r.language) = 2)
        """

        # Process primary names
        print(f"    primary: streaming...", end="\r")
        result = duck.execute(query_primary)
        query_count = 0
        while True:
            batch = result.fetchmany(batch_size)
            if not batch:
                break
            count = insert_primary_batch(conn, batch, entity_type, table_name, source_id)
            query_count += count
            total_names += count
            print(f"    primary: {query_count:,} inserted...", end="\r")
        print(f"    primary: {query_count:,} names" + " " * 20)

        # Process common names
        print(f"    common: streaming...", end="\r")
        result = duck.execute(query_common)
        query_count = 0
        while True:
            batch = result.fetchmany(batch_size)
            if not batch:
                break
            count = insert_common_batch(conn, batch, entity_type, table_name, source_id)
            query_count += count
            total_names += count
            print(f"    common: {query_count:,} inserted...", end="\r")
        print(f"    common: {query_count:,} names" + " " * 20)

        # Process rule names
        print(f"    rules: streaming...", end="\r")
        result = duck.execute(query_rules)
        query_count = 0
        while True:
            batch = result.fetchmany(batch_size)
            if not batch:
                break
            count = insert_rules_batch(conn, batch, entity_type, table_name, source_id)
            query_count += count
            total_names += count
            print(f"    rules: {query_count:,} inserted...", end="\r")
        print(f"    rules: {query_count:,} names" + " " * 20)

    duck.close()

    # Re-enable FK constraint
    print("\nRe-enabling FK constraint...")
    with conn.cursor() as cur:
        cur.execute("""
            ALTER TABLE geo_names
            ADD CONSTRAINT geo_names_language_code_fkey
            FOREIGN KEY (language_code) REFERENCES languages(code) ON DELETE CASCADE
        """)
    conn.commit()
    print("  FK constraint restored")

    conn.close()

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Name import complete!")
    print(f"  Total names inserted: {total_names:,}")
    print(f"  Duration: {elapsed:.1f}s")
    if elapsed > 0:
        print(f"  Speed: {total_names/elapsed:,.0f} names/sec")


def insert_primary_batch(conn, rows, entity_type, table_name, source_id):
    """Insert primary names using INSERT ... SELECT with VALUES."""
    if not rows:
        return 0

    # Build VALUES list with %s placeholders
    values = []
    params = []
    for overture_id, name in rows:
        values.append("(%s, %s)")
        params.extend([overture_id, str(name)])

    with conn.cursor() as cur:
        cur.execute(f"""
            INSERT INTO geo_names (entity_type, entity_id, language_code, name, name_type, source_id)
            SELECT %s, t.id, 'en', v.name, 'primary', %s
            FROM (VALUES {','.join(values)}) AS v(overture_id, name)
            JOIN {table_name} t ON t.overture_id = v.overture_id
        """, [entity_type, source_id] + params)
        count = cur.rowcount
    conn.commit()
    return count


def insert_common_batch(conn, rows, entity_type, table_name, source_id):
    """Insert common names using INSERT ... SELECT with VALUES."""
    if not rows:
        return 0

    values = []
    params = []
    for overture_id, lang, name in rows:
        values.append("(%s, %s, %s)")
        params.extend([overture_id, str(lang) if lang else "en", str(name)])

    with conn.cursor() as cur:
        cur.execute(f"""
            INSERT INTO geo_names (entity_type, entity_id, language_code, name, name_type, source_id)
            SELECT %s, t.id, v.lang, v.name, 'common', %s
            FROM (VALUES {','.join(values)}) AS v(overture_id, lang, name)
            JOIN {table_name} t ON t.overture_id = v.overture_id
        """, [entity_type, source_id] + params)
        count = cur.rowcount
    conn.commit()
    return count


def insert_rules_batch(conn, rows, entity_type, table_name, source_id):
    """Insert rule names using INSERT ... SELECT with VALUES."""
    if not rows:
        return 0

    values = []
    params = []
    for overture_id, lang, name, name_type in rows:
        values.append("(%s, %s, %s, %s)")
        params.extend([overture_id, str(lang) if lang else "en", str(name), name_type])

    with conn.cursor() as cur:
        cur.execute(f"""
            INSERT INTO geo_names (entity_type, entity_id, language_code, name, name_type, source_id)
            SELECT %s, t.id, v.lang, v.name, v.name_type, %s
            FROM (VALUES {','.join(values)}) AS v(overture_id, lang, name, name_type)
            JOIN {table_name} t ON t.overture_id = v.overture_id
        """, [entity_type, source_id] + params)
        count = cur.rowcount
    conn.commit()
    return count


def main():
    parser = argparse.ArgumentParser(
        description="Import multi-language names from Overture division.parquet (STREAMING)"
    )
    parser.add_argument("--data-dir", default="./data/overture", help="Directory containing parquet files")
    parser.add_argument("--database-url", default=None, help="PostgreSQL connection URL")

    args = parser.parse_args()

    database_url = args.database_url or get_database_url()
    if not database_url:
        print("Error: DATABASE_URL not set")
        sys.exit(1)

    import_names(args.data_dir, database_url)


if __name__ == "__main__":
    main()
