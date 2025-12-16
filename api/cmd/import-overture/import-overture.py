#!/usr/bin/env python3
"""
Unified Overture Geographic Data Importer

Commands:
    download  - Download Overture parquet files from S3
    import    - Run full import (default if no command specified)

Import steps:
1. Reset/truncate tables
2. Disable FK constraints and triggers
3. Import countries with continent mapping
4. Import regions (2-pass hierarchy)
5. Import localities (bulk streaming)
6. Import admin boundaries (country/region polygons)
7. Import multi-language names
8. Re-enable FK constraints and indexes
9. Refresh materialized views and search index

Usage:
    python import-overture.py download --data-dir ./data/overture [--release 2025-01]
    python import-overture.py import --data-dir ./data/overture [--skip-boundaries] [--skip-names]
    python import-overture.py --data-dir ./data/overture  # runs import by default

Requirements:
    pip install duckdb 'psycopg[binary]' requests
"""

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Optional, List
from urllib.parse import urlparse

try:
    import duckdb
    import psycopg
    from psycopg import sql
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install duckdb 'psycopg[binary]'")
    sys.exit(1)

try:
    import requests
except ImportError:
    requests = None  # Only needed for download command


# ============================================================================
# Configuration
# ============================================================================

BATCH_SIZE = 50000  # Records per batch for streaming inserts
BOUNDARY_BATCH_SIZE = 500  # Smaller batches for geometry data (larger payloads)
NAMES_BATCH_SIZE = 10000  # Smaller batches for names (avoids 65535 param limit)
REPORT_EVERY = 50000  # Progress report interval

# S3 download configuration
S3_BUCKET = "overturemaps-us-west-2"
S3_REGION = "us-west-2"
DEFAULT_RELEASE = "2025-11-19.0"  # Date-based release format
DEFAULT_DATA_DIR = "./data/overture"

# Division types to download from Overture S3 bucket
# Each type is a folder containing sharded parquet files
OVERTURE_DIVISION_TYPES = [
    "division",       # Point data (countries, regions, localities)
    "division_area",  # Polygon boundaries (country/region boundaries)
]

# Country code to continent code mapping (from countries.go)
COUNTRY_TO_CONTINENT = {
    # Africa
    "DZ": "AF", "AO": "AF", "BJ": "AF", "BW": "AF", "BF": "AF", "BI": "AF", "CM": "AF", "CV": "AF",
    "CF": "AF", "TD": "AF", "KM": "AF", "CG": "AF", "CD": "AF", "CI": "AF", "DJ": "AF", "EG": "AF",
    "GQ": "AF", "ER": "AF", "SZ": "AF", "ET": "AF", "GA": "AF", "GM": "AF", "GH": "AF", "GN": "AF",
    "GW": "AF", "KE": "AF", "LS": "AF", "LR": "AF", "LY": "AF", "MG": "AF", "MW": "AF", "ML": "AF",
    "MR": "AF", "MU": "AF", "MA": "AF", "MZ": "AF", "NA": "AF", "NE": "AF", "NG": "AF", "RW": "AF",
    "ST": "AF", "SN": "AF", "SC": "AF", "SL": "AF", "SO": "AF", "ZA": "AF", "SS": "AF", "SD": "AF",
    "TZ": "AF", "TG": "AF", "TN": "AF", "UG": "AF", "ZM": "AF", "ZW": "AF", "EH": "AF", "RE": "AF",
    "YT": "AF", "SH": "AF",
    # Antarctica
    "AQ": "AN", "BV": "AN", "GS": "AN", "HM": "AN", "TF": "AN",
    # Asia
    "AF": "AS", "AM": "AS", "AZ": "AS", "BH": "AS", "BD": "AS", "BT": "AS", "BN": "AS", "KH": "AS",
    "CN": "AS", "CY": "AS", "GE": "AS", "HK": "AS", "IN": "AS", "ID": "AS", "IR": "AS", "IQ": "AS",
    "IL": "AS", "JP": "AS", "JO": "AS", "KZ": "AS", "KW": "AS", "KG": "AS", "LA": "AS", "LB": "AS",
    "MO": "AS", "MY": "AS", "MV": "AS", "MN": "AS", "MM": "AS", "NP": "AS", "KP": "AS", "OM": "AS",
    "PK": "AS", "PS": "AS", "PH": "AS", "QA": "AS", "SA": "AS", "SG": "AS", "KR": "AS", "LK": "AS",
    "SY": "AS", "TW": "AS", "TJ": "AS", "TH": "AS", "TL": "AS", "TR": "AS", "TM": "AS", "AE": "AS",
    "UZ": "AS", "VN": "AS", "YE": "AS", "IO": "AS", "CC": "AS", "CX": "AS",
    # Europe
    "AL": "EU", "AD": "EU", "AT": "EU", "BY": "EU", "BE": "EU", "BA": "EU", "BG": "EU", "HR": "EU",
    "CZ": "EU", "DK": "EU", "EE": "EU", "FI": "EU", "FR": "EU", "DE": "EU", "GR": "EU", "HU": "EU",
    "IS": "EU", "IE": "EU", "IT": "EU", "XK": "EU", "LV": "EU", "LI": "EU", "LT": "EU", "LU": "EU",
    "MT": "EU", "MD": "EU", "MC": "EU", "ME": "EU", "NL": "EU", "MK": "EU", "NO": "EU", "PL": "EU",
    "PT": "EU", "RO": "EU", "RU": "EU", "SM": "EU", "RS": "EU", "SK": "EU", "SI": "EU", "ES": "EU",
    "SE": "EU", "CH": "EU", "UA": "EU", "GB": "EU", "VA": "EU", "AX": "EU", "FO": "EU", "GI": "EU",
    "GG": "EU", "IM": "EU", "JE": "EU", "SJ": "EU",
    # North America
    "AG": "NA", "BS": "NA", "BB": "NA", "BZ": "NA", "CA": "NA", "CR": "NA", "CU": "NA", "DM": "NA",
    "DO": "NA", "SV": "NA", "GD": "NA", "GT": "NA", "HT": "NA", "HN": "NA", "JM": "NA", "MX": "NA",
    "NI": "NA", "PA": "NA", "KN": "NA", "LC": "NA", "VC": "NA", "TT": "NA", "US": "NA", "AI": "NA",
    "AW": "NA", "BM": "NA", "BQ": "NA", "VG": "NA", "KY": "NA", "CW": "NA", "GL": "NA", "GP": "NA",
    "MQ": "NA", "MS": "NA", "PR": "NA", "BL": "NA", "MF": "NA", "PM": "NA", "SX": "NA", "TC": "NA",
    "VI": "NA", "CP": "NA", "UM": "NA",
    # Oceania
    "AU": "OC", "FJ": "OC", "KI": "OC", "MH": "OC", "FM": "OC", "NR": "OC", "NZ": "OC", "PW": "OC",
    "PG": "OC", "WS": "OC", "SB": "OC", "TO": "OC", "TV": "OC", "VU": "OC", "AS": "OC", "CK": "OC",
    "PF": "OC", "GU": "OC", "NC": "OC", "NF": "OC", "MP": "OC", "NU": "OC", "PN": "OC", "TK": "OC",
    "WF": "OC",
    # South America
    "AR": "SA", "BO": "SA", "BR": "SA", "CL": "SA", "CO": "SA", "EC": "SA", "GY": "SA", "PY": "SA",
    "PE": "SA", "SR": "SA", "UY": "SA", "VE": "SA", "FK": "SA", "GF": "SA",
    # Disputed territories
    "XJ": "EU", "XS": "NA", "XE": "NA", "XT": "AF", "XY": "AF", "XM": "AS", "XN": "AS",
    "XH": "AS", "XW": "AS", "XZ": "AS", "XG": "AS", "XL": "AS", "XQ": "AS", "XC": "AS",
    "XX": "AS", "XO": "AS", "XI": "AS", "XU": "AS", "XA": "AS", "XB": "AS", "XD": "AS",
    "XP": "AS", "XR": "AS",
}

# Country code remapping for disputed territories
# Maps source country codes to target country codes
# These countries will be merged into the target and deleted after import
COUNTRY_REMAPPING = {
    "XW": "IL",  # West Bank → Israel
    "XH": "IL",  # Golan Heights → Israel
    "XZ": "IL",  # East Jerusalem → Israel
    # "XG": "IL",  # Gaza → Israel (disabled by default)
}

# Synthetic regions for orphan localities (those with no region/county/localadmin ancestor)
# Maps country codes to (region_code, english_name, target_country_code)
# target_country_code is where the synthetic region should be created (usually same as key)
SYNTHETIC_REGION_MAPPING = {
    # Israeli Territories → each gets its own region under Israel
    "XH": ("IL-GOLAN", "Golan Heights", "IL"),
    "XW": ("IL-JUDEA-SAMARIA", "Judea and Samaria", "IL"),
    "XZ": ("IL-JERUSALEM-DISTRICT", "Jerusalem District", "IL"),

    # Dutch Caribbean → single shared region
    "AW": ("DUTCH-CARIBBEAN", "Dutch Caribbean Territory", "AW"),  # Aruba
    "BQ": ("DUTCH-CARIBBEAN", "Dutch Caribbean Territory", "BQ"),  # Bonaire/Saba/Sint Eustatius
    "CW": ("DUTCH-CARIBBEAN", "Dutch Caribbean Territory", "CW"),  # Curaçao
    "SX": ("DUTCH-CARIBBEAN", "Dutch Caribbean Territory", "SX"),  # Sint Maarten

    # French Overseas → single shared region
    "BL": ("FRENCH-OVERSEAS", "French Overseas Territory", "BL"),  # Saint Barthélemy
    "GP": ("FRENCH-OVERSEAS", "French Overseas Territory", "GP"),  # Guadeloupe
    "MF": ("FRENCH-OVERSEAS", "French Overseas Territory", "MF"),  # Saint Martin
    "PF": ("FRENCH-OVERSEAS", "French Overseas Territory", "PF"),  # French Polynesia
    "PM": ("FRENCH-OVERSEAS", "French Overseas Territory", "PM"),  # Saint Pierre and Miquelon
    "RE": ("FRENCH-OVERSEAS", "French Overseas Territory", "RE"),  # Réunion

    # British Overseas → single shared region
    "AI": ("BRITISH-OVERSEAS", "British Overseas Territory", "AI"),  # Anguilla
    "FK": ("BRITISH-OVERSEAS", "British Overseas Territory", "FK"),  # Falkland Islands
    "GI": ("BRITISH-OVERSEAS", "British Overseas Territory", "GI"),  # Gibraltar
    "IO": ("BRITISH-OVERSEAS", "British Overseas Territory", "IO"),  # British Indian Ocean Territory
    "NF": ("BRITISH-OVERSEAS", "British Overseas Territory", "NF"),  # Norfolk Island
    "PN": ("BRITISH-OVERSEAS", "British Overseas Territory", "PN"),  # Pitcairn Islands

    # Research Stations → single shared region
    "AQ": ("RESEARCH", "Research Stations", "AQ"),  # Antarctica
    "SJ": ("RESEARCH", "Research Stations", "SJ"),  # Svalbard
    "TF": ("RESEARCH", "Research Stations", "TF"),  # French Southern Territories

    # Pacific Island Territory → single shared region
    "MO": ("PACIFIC-TERRITORY", "Pacific Island Territory", "MO"),  # Macau
    "NU": ("PACIFIC-TERRITORY", "Pacific Island Territory", "NU"),  # Niue
    "TK": ("PACIFIC-TERRITORY", "Pacific Island Territory", "TK"),  # Tokelau

    # Disputed Other → single shared region
    "XE": ("DISPUTED-OTHER", "Disputed Territory", "XE"),  # Bajo Nuevo Bank
    "XJ": ("DISPUTED-OTHER", "Disputed Territory", "XJ"),  # Jan Mayen
    "XS": ("DISPUTED-OTHER", "Disputed Territory", "XS"),  # Serranilla Bank
    "XY": ("DISPUTED-OTHER", "Disputed Territory", "XY"),  # Abyei

    # Chinese-Claimed Territory → single shared region
    "XC": ("DISPUTED-CHINA", "Chinese-Claimed Territory", "XC"),  # Aksai Chin
    "XL": ("DISPUTED-CHINA", "Chinese-Claimed Territory", "XL"),  # Zhongsha Islands
    "XQ": ("DISPUTED-CHINA", "Chinese-Claimed Territory", "XQ"),  # Trans-Karakoram
    "XX": ("DISPUTED-CHINA", "Chinese-Claimed Territory", "XX"),  # Scarborough Shoal

    # Russian-Administered Islands → single shared region
    "XI": ("DISPUTED-RUSSIAN", "Russian-Administered Islands", "XI"),  # Iturup
    "XO": ("DISPUTED-RUSSIAN", "Russian-Administered Islands", "XO"),  # Shikotan

    # Danish Overseas
    "GL": ("DANISH-OVERSEAS", "Danish Realm Territory", "GL"),  # Greenland

    # US Territory
    "GU": ("US-TERRITORY", "US Territory", "GU"),  # Guam

    # City-states (use country name as region)
    "SG": ("SG-GEN", "Singapore", "SG"),
    "VA": ("VA-GEN", "Vatican City", "VA"),

    # Island nations (use country name as region)
    "SC": ("SC-GEN", "Seychelles", "SC"),
    "ST": ("ST-GEN", "Sao Tome and Principe", "ST"),
    "MU": ("MU-GEN", "Mauritius", "MU"),
    "HM": ("HM-GEN", "Heard Island and McDonald Islands", "HM"),

    # Country-specific regions (English names)
    "MM": ("MM-GEN", "Myanmar", "MM"),
    "BZ": ("BZ-GEN", "Belize", "BZ"),
    "FR": ("FR-GEN", "France", "FR"),
    "TZ": ("TZ-GEN", "Tanzania", "TZ"),
    "EC": ("EC-GEN", "Ecuador", "EC"),
    "IE": ("IE-GEN", "Ireland", "IE"),
    "IN": ("IN-GEN", "India", "IN"),
    "CY": ("CY-GEN", "Cyprus", "CY"),
    "MG": ("MG-GEN", "Madagascar", "MG"),
    "MX": ("MX-GEN", "Mexico", "MX"),
    "ES": ("ES-GEN", "Spain", "ES"),
    "CO": ("CO-GEN", "Colombia", "CO"),
    "OM": ("OM-GEN", "Oman", "OM"),
    "IT": ("IT-GEN", "Italy", "IT"),
    "LR": ("LR-GEN", "Liberia", "LR"),
    "SA": ("SA-GEN", "Saudi Arabia", "SA"),
    "PE": ("PE-GEN", "Peru", "PE"),
    "JM": ("JM-GEN", "Jamaica", "JM"),
    "XT": ("XT-GEN", "Bir Tawil", "XT"),
    "TW": ("TW-GEN", "Taiwan", "TW"),
    "TL": ("TL-GEN", "Timor-Leste", "TL"),
    "MZ": ("MZ-GEN", "Mozambique", "MZ"),
    "PY": ("PY-GEN", "Paraguay", "PY"),
    "CP": ("CP-GEN", "Clipperton Island", "CP"),
    "MA": ("MA-GEN", "Morocco", "MA"),
    "BB": ("BB-GEN", "Barbados", "BB"),
    "DO": ("DO-GEN", "Dominican Republic", "DO"),
    "GY": ("GY-GEN", "Guyana", "GY"),
    "MR": ("MR-GEN", "Mauritania", "MR"),
    "SY": ("SY-GEN", "Syria", "SY"),
    "LB": ("LB-GEN", "Lebanon", "LB"),
    "EG": ("EG-GEN", "Egypt", "EG"),
    "DZ": ("DZ-GEN", "Algeria", "DZ"),
    "DK": ("DK-GEN", "Denmark", "DK"),
    "MY": ("MY-GEN", "Malaysia", "MY"),
    "ZA": ("ZA-GEN", "South Africa", "ZA"),
}

# Tables and indexes to manage
TABLES_TO_TRUNCATE = [
    "geo_search_index",
    "geo_names",
    "geo_locality_locations",
    "geo_locality_elevations",
    "geo_localities",
    "geo_regions",
    "geo_countries",
]

TABLES_WITH_TRIGGERS = [
    "geo_localities",
    "geo_regions",
    "geo_names",
]

INDEXES_TO_DROP = [
    # geo_localities indexes (dropped for faster COPY import)
    "idx_geo_localities_parent_overture",
    "idx_geo_localities_overture",
    "idx_geo_localities_type",
    "idx_geo_localities_name",
    "idx_geo_localities_population",
    # Old indexes (may exist from previous schema)
    "idx_geo_localities_region",
    "idx_geo_localities_parent",
    # geo_locality_locations indexes (dropped for faster COPY import)
    "idx_geo_locality_locations_gist",
    # geo_search_index indexes (dropped since table is truncated/refilled)
    "idx_geo_search_keywords",
    "idx_geo_search_trgm",
    "idx_geo_search_pop",
    "idx_geo_search_type",
    "idx_geo_search_country",
    "idx_geo_search_inherited_region",
    "idx_geo_search_direct_parent",
    "idx_geo_search_entity",
    # Old search indexes (may exist from previous schema)
    "idx_geo_search_region",
]

INDEXES_DDL = [
    # geo_localities indexes
    "CREATE INDEX IF NOT EXISTS idx_geo_localities_parent_overture ON geo_localities(parent_overture_id)",
    "CREATE INDEX IF NOT EXISTS idx_geo_localities_overture ON geo_localities(overture_id)",
    "CREATE INDEX IF NOT EXISTS idx_geo_localities_type ON geo_localities(locality_type_id)",
    "CREATE INDEX IF NOT EXISTS idx_geo_localities_name ON geo_localities(name)",
    "CREATE INDEX IF NOT EXISTS idx_geo_localities_population ON geo_localities(population DESC NULLS LAST)",
    # geo_locality_locations indexes
    "CREATE INDEX IF NOT EXISTS idx_geo_locality_locations_gist ON geo_locality_locations USING GIST(location)",
    # geo_search_index indexes
    "CREATE INDEX IF NOT EXISTS idx_geo_search_keywords ON geo_search_index USING GIN(keywords)",
    "CREATE INDEX IF NOT EXISTS idx_geo_search_trgm ON geo_search_index USING GIN(display_name gin_trgm_ops)",
    "CREATE INDEX IF NOT EXISTS idx_geo_search_pop ON geo_search_index(population DESC NULLS LAST)",
    "CREATE INDEX IF NOT EXISTS idx_geo_search_type ON geo_search_index(entity_type)",
    "CREATE INDEX IF NOT EXISTS idx_geo_search_country ON geo_search_index(country_id)",
    # New hierarchy indexes
    "CREATE INDEX IF NOT EXISTS idx_geo_search_inherited_region ON geo_search_index(inherited_region_id)",
    "CREATE INDEX IF NOT EXISTS idx_geo_search_direct_parent ON geo_search_index(direct_parent_type, direct_parent_id)",
    # Entity lookup index (for JOIN on entity_type, entity_id)
    "CREATE INDEX IF NOT EXISTS idx_geo_search_entity ON geo_search_index(entity_type, entity_id)",
]


# ============================================================================
# Utilities
# ============================================================================

def get_database_url() -> Optional[str]:
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


def format_duration(seconds: float) -> str:
    """Format duration in human-readable form."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = int(seconds // 60)
    secs = seconds % 60
    if minutes < 60:
        return f"{minutes}m {secs:.0f}s"
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours}h {mins}m"


def extract_region_code(overture_id: str, region: Optional[str]) -> str:
    """Extract region code from region field or overture_id."""
    if region:
        # Extract just the region part if it's in format "XX-YY" (e.g., "US-CA" -> "CA")
        if len(region) > 3 and region[2] == "-":
            return region[3:]
        return region
    # Fallback: first 8 chars of overture_id
    return overture_id[:8] if len(overture_id) >= 8 else overture_id


# ============================================================================
# Download Command
# ============================================================================

def list_s3_files(bucket: str, prefix: str) -> List[str]:
    """List files in S3 bucket using AWS CLI (no auth required for public buckets)."""
    import subprocess
    cmd = ["aws", "s3", "ls", f"s3://{bucket}/{prefix}", "--no-sign-request"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        files = []
        for line in result.stdout.strip().split('\n'):
            if line and not line.startswith('PRE'):
                # Format: "2025-11-19 18:06:17  846241128 filename.parquet"
                parts = line.split()
                if len(parts) >= 4:
                    files.append(parts[-1])
        return files
    except subprocess.CalledProcessError:
        return []


def download_overture_data(data_dir: Path, release: str, force: bool = False,
                           division_only: bool = False) -> None:
    """Download Overture parquet files from S3.

    Downloads sharded parquet files for each division type.
    Files are stored in subdirectories: data_dir/division/, data_dir/division_area/
    """
    if requests is None:
        print("Error: 'requests' module required for download")
        print("Install with: pip install requests")
        sys.exit(1)

    print("=" * 60)
    print("Overture Data Download")
    print("=" * 60)
    print(f"Release: {release}")
    print(f"Output directory: {data_dir}")
    print(f"Force re-download: {force}")
    print(f"Division only (skip boundaries): {division_only}")

    # Create output directory
    data_dir.mkdir(parents=True, exist_ok=True)

    downloaded_files = 0
    skipped_files = 0
    total_bytes = 0
    total_start = time.time()

    # Determine which types to download
    types_to_download = ["division"] if division_only else OVERTURE_DIVISION_TYPES

    for div_type in types_to_download:
        type_dir = data_dir / div_type
        type_dir.mkdir(parents=True, exist_ok=True)

        s3_prefix = f"release/{release}/theme=divisions/type={div_type}/"
        print(f"\n  Listing files for {div_type}...")

        # List files in S3
        files = list_s3_files(S3_BUCKET, s3_prefix)
        if not files:
            print(f"    WARNING: No files found at s3://{S3_BUCKET}/{s3_prefix}")
            continue

        parquet_files = [f for f in files if f.endswith('.parquet')]
        print(f"    Found {len(parquet_files)} parquet files")

        for filename in parquet_files:
            output_path = type_dir / filename

            # Check if file already exists
            if not force and output_path.exists():
                size_mb = output_path.stat().st_size / 1024 / 1024
                print(f"    {filename}: exists ({size_mb:.1f} MB), skipping")
                skipped_files += 1
                continue

            # Build S3 URL
            url = f"https://{S3_BUCKET}.s3.amazonaws.com/{s3_prefix}{filename}"

            print(f"    Downloading {filename}...")

            start = time.time()
            try:
                response = requests.get(url, stream=True)
                response.raise_for_status()

                file_size = int(response.headers.get('content-length', 0))
                downloaded_size = 0
                last_report = 0

                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192 * 1024):  # 8MB chunks
                        if chunk:
                            f.write(chunk)
                            downloaded_size += len(chunk)

                            # Report progress every 100MB
                            current_mb = downloaded_size // (1024 * 1024)
                            if current_mb - last_report >= 100:
                                if file_size > 0:
                                    percent = downloaded_size / file_size * 100
                                    print(f"      Progress: {current_mb} MB / {file_size // (1024*1024)} MB ({percent:.1f}%)")
                                else:
                                    print(f"      Progress: {current_mb} MB")
                                last_report = current_mb

                elapsed = time.time() - start
                size_mb = downloaded_size / 1024 / 1024
                speed = size_mb / elapsed if elapsed > 0 else 0
                print(f"      Complete: {size_mb:.1f} MB in {format_duration(elapsed)} ({speed:.1f} MB/s)")
                downloaded_files += 1
                total_bytes += downloaded_size

            except requests.RequestException as e:
                print(f"      ERROR: {e}")
                if output_path.exists():
                    output_path.unlink()
                sys.exit(1)

    print("\n" + "=" * 60)
    print("Download Complete!")
    print("=" * 60)
    print(f"Downloaded: {downloaded_files} files ({total_bytes / (1024*1024*1024):.2f} GB)")
    print(f"Skipped: {skipped_files} files")
    print(f"Total time: {format_duration(time.time() - total_start)}")

    # List files by type
    print("\nFiles in data directory:")
    for div_type in types_to_download:
        type_dir = data_dir / div_type
        if type_dir.exists():
            files = list(type_dir.glob("*.parquet"))
            total_size = sum(f.stat().st_size for f in files)
            print(f"  {div_type}/: {len(files)} files, {total_size / (1024*1024*1024):.2f} GB")


# ============================================================================
# Step 1: Reset/Truncate Tables
# ============================================================================

def reset_tables(conn: psycopg.Connection) -> None:
    """Truncate all geo tables to prepare for fresh import."""
    print("\n[1/8] Resetting tables...")

    with conn.cursor() as cur:
        for table in TABLES_TO_TRUNCATE:
            print(f"  Truncating {table}...", end=" ")
            cur.execute(sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(sql.Identifier(table)))
            print("done")
    conn.commit()
    print("  Tables reset complete")


# ============================================================================
# Step 2: Disable FK Constraints and Triggers
# ============================================================================

def disable_constraints(conn: psycopg.Connection) -> None:
    """Disable FK triggers and drop indexes for faster bulk import."""
    print("\n[2/8] Disabling constraints and indexes...")

    with conn.cursor() as cur:
        # Disable triggers
        for table in TABLES_WITH_TRIGGERS:
            print(f"  Disabling triggers on {table}...")
            cur.execute(sql.SQL("ALTER TABLE {} DISABLE TRIGGER ALL").format(sql.Identifier(table)))

        # Drop indexes
        for idx in INDEXES_TO_DROP:
            print(f"  Dropping index {idx}...")
            cur.execute(sql.SQL("DROP INDEX IF EXISTS {}").format(sql.Identifier(idx)))

        # Drop FK constraint on geo_names
        print("  Dropping geo_names FK constraint...")
        cur.execute("ALTER TABLE geo_names DROP CONSTRAINT IF EXISTS geo_names_language_code_fkey")

    conn.commit()
    print("  Constraints disabled")


# ============================================================================
# Step 3: Import Countries with Continent Mapping
# ============================================================================

def import_countries(conn: psycopg.Connection, duck: duckdb.DuckDBPyConnection,
                     parquet_pattern: str, source_id: int) -> dict:
    """Import countries from Overture data with continent mapping."""
    print("\n[3/8] Importing countries...")
    start = time.time()

    # Get or create continent cache
    continent_cache = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, code FROM geo_continents WHERE code != 'XX'")
        for row in cur.fetchall():
            continent_cache[row[1]] = row[0]

    # Ensure "Unmapped" continent exists
    unmapped_id = None
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM geo_continents WHERE code = 'XX'")
        row = cur.fetchone()
        if row:
            unmapped_id = row[0]
        else:
            cur.execute("INSERT INTO geo_continents (code, name) VALUES ('XX', 'Unmapped') RETURNING id")
            unmapped_id = cur.fetchone()[0]
    conn.commit()

    # Query countries from parquet
    # Name priority: English common > any English name > primary (local) name
    query = f"""
    SELECT DISTINCT
        p.id as overture_id,
        COALESCE(p.country, p.region) as country_code,
        COALESCE(
            p.names.common['en'],
            (SELECT v FROM (SELECT UNNEST(map_values(p.names.common)) as v) t WHERE v ~ '^[A-Za-z]' LIMIT 1),
            p.names.primary
        ) as name
    FROM read_parquet('{parquet_pattern}') p
    WHERE p.subtype IN ('country', 'dependency')
      AND p.names.primary IS NOT NULL
      AND (p.country IS NOT NULL OR p.region IS NOT NULL)
    """

    result = duck.execute(query)
    countries = []
    seen = set()

    while True:
        batch = result.fetchmany(BATCH_SIZE)
        if not batch:
            break
        for overture_id, country_code, name in batch:
            if not country_code or len(country_code) != 2:
                continue
            if country_code in seen:
                continue
            seen.add(country_code)
            countries.append((overture_id, country_code, name))

    print(f"  Found {len(countries)} countries")

    # Insert with unmapped continent first
    with conn.cursor() as cur:
        for overture_id, country_code, name in countries:
            cur.execute("""
                INSERT INTO geo_countries (code, name, continent_id, source_id, overture_id)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (code) DO NOTHING
            """, (country_code, name, unmapped_id, source_id, overture_id))
    conn.commit()

    # Map to real continents
    unmapped = []
    mapped = 0
    with conn.cursor() as cur:
        cur.execute("SELECT id, code, name FROM geo_countries WHERE continent_id = %s", (unmapped_id,))
        for country_id, code, name in cur.fetchall():
            continent_code = COUNTRY_TO_CONTINENT.get(code)
            if not continent_code:
                unmapped.append(f"{code} ({name})")
                continue
            continent_id = continent_cache.get(continent_code)
            if not continent_id:
                unmapped.append(f"{code} -> {continent_code} (continent not in DB)")
                continue
            cur.execute("UPDATE geo_countries SET continent_id = %s WHERE id = %s",
                       (continent_id, country_id))
            mapped += 1
    conn.commit()

    if unmapped:
        print(f"  WARNING: {len(unmapped)} countries unmapped: {', '.join(unmapped[:5])}...")

    # Build country cache for later steps
    country_cache = {}
    with conn.cursor() as cur:
        cur.execute("SELECT code, id, continent_id FROM geo_countries")
        for code, cid, cont_id in cur.fetchall():
            country_cache[code] = {"id": cid, "continent_id": cont_id}

    print(f"  Countries imported: {mapped} in {format_duration(time.time() - start)}")
    return country_cache


# ============================================================================
# Step 4: Import Regions (2-pass hierarchy)
# ============================================================================

def import_regions(conn: psycopg.Connection, duck: duckdb.DuckDBPyConnection,
                   parquet_pattern: str, source_id: int, country_cache: dict) -> dict:
    """Import regions with 2-pass hierarchy (top-level then sub-regions)."""
    print("\n[4/8] Importing regions...")
    start = time.time()

    # Build region type cache
    region_type_cache = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, code, overture_subtype FROM geo_region_types")
        for row in cur.fetchall():
            region_type_cache[row[1]] = row[0]
            if row[2]:
                region_type_cache[row[2]] = row[0]

    # Pass 1: Top-level regions
    # Name priority: English common > any English name > primary (local) name
    print("  Pass 1: Top-level regions...")
    query_top = f"""
    SELECT p.id as overture_id, p.country, p.region,
        COALESCE(
            p.names.common['en'],
            (SELECT v FROM (SELECT UNNEST(map_values(p.names.common)) as v) t WHERE v ~ '^[A-Za-z]' LIMIT 1),
            p.names.primary
        ) as name
    FROM read_parquet('{parquet_pattern}') p
    WHERE p.subtype = 'region'
      AND p.names.primary IS NOT NULL
      AND p.country IS NOT NULL
    """

    result = duck.execute(query_top)
    top_level_map = {}  # overture_id -> db_id
    top_count = 0

    region_type_id = region_type_cache.get("region", 1)

    while True:
        batch = result.fetchmany(BATCH_SIZE)
        if not batch:
            break

        with conn.cursor() as cur:
            for overture_id, country_code, region, name in batch:
                if not country_code or country_code not in country_cache:
                    continue
                country_id = country_cache[country_code]["id"]
                region_code = extract_region_code(overture_id, region)

                cur.execute("""
                    INSERT INTO geo_regions (country_id, region_type_id, code, name, overture_id, source_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    RETURNING id
                """, (country_id, region_type_id, region_code, name, overture_id, source_id))
                row = cur.fetchone()
                if row:
                    top_level_map[overture_id] = row[0]
                    top_count += 1
        conn.commit()

    print(f"    Top-level regions: {top_count}")

    # Pass 2: Sub-regions (county, localadmin)
    # Name priority: English common > any English name > primary (local) name
    print("  Pass 2: Sub-regions...")
    query_sub = f"""
    SELECT p.id as overture_id, p.country, p.region, p.subtype,
        COALESCE(
            p.names.common['en'],
            (SELECT v FROM (SELECT UNNEST(map_values(p.names.common)) as v) t WHERE v ~ '^[A-Za-z]' LIMIT 1),
            p.names.primary
        ) as name,
        p.parent_division_id
    FROM read_parquet('{parquet_pattern}') p
    WHERE p.subtype IN ('county', 'localadmin')
      AND p.names.primary IS NOT NULL
      AND p.country IS NOT NULL
    """

    result = duck.execute(query_sub)
    sub_count = 0
    processed = 0

    while True:
        batch = result.fetchmany(BATCH_SIZE)
        if not batch:
            break

        with conn.cursor() as cur:
            for overture_id, country_code, region, subtype, name, parent_id in batch:
                processed += 1
                if not country_code or country_code not in country_cache:
                    continue

                country_id = country_cache[country_code]["id"]
                region_type_id = region_type_cache.get(subtype, region_type_cache.get("county", 2))
                region_code = extract_region_code(overture_id, region)
                parent_region_id = top_level_map.get(parent_id) if parent_id else None

                cur.execute("""
                    INSERT INTO geo_regions (country_id, parent_region_id, region_type_id, code, name, overture_id, source_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (country_id, parent_region_id, region_type_id, region_code, name, overture_id, source_id))
                sub_count += 1
        conn.commit()

        if processed % REPORT_EVERY == 0:
            print(f"    Sub-regions: {sub_count} ({processed} processed)...")

    print(f"    Sub-regions: {sub_count}")

    # Build region map for localities
    region_map = {}
    with conn.cursor() as cur:
        cur.execute("SELECT overture_id, id FROM geo_regions WHERE overture_id IS NOT NULL")
        for oid, rid in cur.fetchall():
            region_map[oid] = rid

    print(f"  Regions imported: {top_count + sub_count} in {format_duration(time.time() - start)}")
    return region_map


# ============================================================================
# Step 5: Import Localities (bulk streaming)
# ============================================================================

def import_localities(conn: psycopg.Connection, duck: duckdb.DuckDBPyConnection,
                      parquet_pattern: str, source_id: int, country_cache: dict) -> None:
    """Import all localities using streaming bulk insert.

    Stores parent_overture_id exactly as Overture provides it. Hierarchy resolution
    is done later by refresh_geo_search_index() which builds the denormalized
    search index with resolved parent relationships.
    """
    print("\n[5/8] Importing localities...")
    start = time.time()

    # Build locality type cache
    locality_type_cache = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, code, overture_subtype FROM geo_locality_types")
        for row in cur.fetchall():
            locality_type_cache[row[1]] = row[0]
            if row[2]:
                locality_type_cache[row[2]] = row[0]

    fallback_type = locality_type_cache.get("locality", 1)

    # Only import locality-type subtypes (not administrative divisions)
    # Administrative divisions are handled separately:
    #   - country, dependency -> geo_countries
    #   - region, county, localadmin -> geo_regions
    # Locality subtypes: locality, neighborhood, macrohood, microhood
    #
    # Name priority: English common > any English name > primary (local) name
    # This ensures display names are in English when available
    query = f"""
    SELECT
        p.id as overture_id,
        p.parent_division_id,
        p.country,
        p.subtype,
        COALESCE(p.class, p.subtype) as type_lookup,
        COALESCE(
            p.names.common['en'],
            (SELECT v FROM (SELECT UNNEST(map_values(p.names.common)) as v) t WHERE v ~ '^[A-Za-z]' LIMIT 1),
            p.names.primary
        ) as name,
        p.names.primary as local_name,
        ST_X(p.geometry) as lng,
        ST_Y(p.geometry) as lat,
        p.population
    FROM read_parquet('{parquet_pattern}') p
    WHERE p.subtype IN ('locality', 'neighborhood', 'macrohood', 'microhood')
      AND p.names.primary IS NOT NULL
      AND p.country IS NOT NULL
      AND p.geometry IS NOT NULL
    """

    result = duck.execute(query)
    imported = 0
    skipped = 0
    processed = 0

    # Collect coordinate data to insert into geo_locality_locations after locality import
    coordinate_data = []

    with conn.cursor() as cur:
        # Use COPY for maximum speed
        # parent_overture_id is stored as-is from Overture (hierarchy resolved in search index)
        # Note: latitude/longitude/elevation_m are stored in geo_locality_locations/geo_locality_elevations
        with cur.copy("""
            COPY geo_localities (
                locality_type_id, name, name_ascii,
                timezone, population, continent_id, country_id,
                source_id, overture_id, parent_overture_id
            ) FROM STDIN
        """) as copy:
            while True:
                batch = result.fetchmany(BATCH_SIZE)
                if not batch:
                    break

                for overture_id, parent_overture_id, country_code, subtype, type_lookup, name, local_name, lng, lat, population in batch:
                    processed += 1

                    if not country_code or country_code not in country_cache:
                        skipped += 1
                        continue

                    if lat is None or lng is None:
                        skipped += 1
                        continue

                    country_info = country_cache[country_code]
                    locality_type_id = locality_type_cache.get(type_lookup, fallback_type)

                    # Use English name for display, ASCII version for search
                    # name = English common name (or fallback to local)
                    # name_ascii = ASCII-safe version for basic search matching
                    name_ascii = name.encode('ascii', 'ignore').decode('ascii') or local_name.encode('ascii', 'ignore').decode('ascii') or name

                    copy.write_row((
                        locality_type_id,
                        name,
                        name_ascii,
                        "UTC",  # timezone
                        population,
                        country_info["continent_id"],
                        country_info["id"],
                        source_id,
                        overture_id,
                        parent_overture_id,  # Store raw Overture parent reference
                    ))
                    # Store coordinates for geo_locality_locations insert
                    coordinate_data.append((overture_id, lat, lng))
                    imported += 1

                if processed % REPORT_EVERY == 0:
                    print(f"    Progress: {imported:,} imported, {skipped:,} skipped ({processed:,} processed)...")

    conn.commit()
    print(f"  Localities imported: {imported:,} in {format_duration(time.time() - start)}")

    # Step 5b: Insert coordinates into geo_locality_locations
    print("  Populating geo_locality_locations...")
    coord_start = time.time()

    # Build locality ID cache (overture_id -> id) for coordinate insertion
    locality_id_cache = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, overture_id FROM geo_localities WHERE overture_id IS NOT NULL")
        for row in cur.fetchall():
            locality_id_cache[row[1]] = row[0]

    # Batch insert coordinates into geo_locality_locations
    coord_inserted = 0
    batch_size = 10000
    for i in range(0, len(coordinate_data), batch_size):
        batch = coordinate_data[i:i + batch_size]
        values = []
        params = []
        for overture_id, lat, lng in batch:
            if overture_id in locality_id_cache:
                values.append("(%s, %s, %s, %s, %s)")
                params.extend([locality_id_cache[overture_id], source_id, lat, lng, 100])  # accuracy_m = 100 for Overture

        if values:
            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO geo_locality_locations (locality_id, source_id, latitude, longitude, accuracy_m)
                    VALUES {','.join(values)}
                """, params)
                coord_inserted += len(values)
            conn.commit()

        if coord_inserted % REPORT_EVERY == 0 and coord_inserted > 0:
            print(f"    Coordinates: {coord_inserted:,} inserted...")

    print(f"  Coordinates inserted: {coord_inserted:,} in {format_duration(time.time() - coord_start)}")


# ============================================================================
# Step 5c: Remap Disputed Territories
# ============================================================================

def remap_disputed_territories(conn: psycopg.Connection, country_cache: dict) -> None:
    """Remap disputed territory localities and regions to target countries, then delete source countries.

    This function handles political remapping (e.g., West Bank -> Israel):
    1. Remaps all regions from source to target country
    2. Remaps all localities from source to target country
    3. Finds the country-level locality entry (e.g., "West Bank" as a locality)
    4. Clears parent_overture_id for localities whose parent was the country-level entry
    5. Deletes the country-level locality entry
    6. Deletes the source country entry
    """
    if not COUNTRY_REMAPPING:
        return

    print("\n  Remapping disputed territories...")

    for source_code, target_code in COUNTRY_REMAPPING.items():
        if source_code not in country_cache:
            print(f"    {source_code}: not found in import, skipping")
            continue
        if target_code not in country_cache:
            print(f"    WARNING: Target country {target_code} not in cache, skipping {source_code}")
            continue

        target_info = country_cache[target_code]
        source_info = country_cache[source_code]

        with conn.cursor() as cur:
            # Step 1: Get the source country name and overture_id before we start modifying
            cur.execute("SELECT name, overture_id FROM geo_countries WHERE id = %s", (source_info["id"],))
            row = cur.fetchone()
            source_country_name = row[0] if row else None
            source_country_overture_id = row[1] if row else None

            # Step 2: Remap regions from source country to target country
            cur.execute("""
                UPDATE geo_regions
                SET country_id = %s, continent_id = %s
                WHERE country_id = %s
            """, (target_info["id"], target_info["continent_id"], source_info["id"]))
            regions_updated = cur.rowcount

            # Step 3: Remap localities from source country to target country
            cur.execute("""
                UPDATE geo_localities
                SET country_id = %s, continent_id = %s
                WHERE country_id = %s
            """, (target_info["id"], target_info["continent_id"], source_info["id"]))
            localities_updated = cur.rowcount

            # Step 4: Find the country-level locality entry
            # (locality with same name as the source country that has no parent_overture_id)
            country_locality_id = None
            country_locality_overture_id = None
            if source_country_name:
                cur.execute("""
                    SELECT id, overture_id FROM geo_localities
                    WHERE country_id = %s
                      AND parent_overture_id IS NULL
                      AND name = %s
                """, (target_info["id"], source_country_name))
                row = cur.fetchone()
                if row:
                    country_locality_id = row[0]
                    country_locality_overture_id = row[1]

            # Step 5: Clear parent_overture_id for localities whose parent was the country-level entry
            parents_cleared = 0
            if country_locality_overture_id:
                cur.execute("""
                    UPDATE geo_localities
                    SET parent_overture_id = NULL
                    WHERE parent_overture_id = %s
                """, (country_locality_overture_id,))
                parents_cleared = cur.rowcount

            # Step 6: Delete the country-level locality entry
            country_localities_deleted = 0
            if country_locality_id:
                cur.execute("DELETE FROM geo_localities WHERE id = %s", (country_locality_id,))
                country_localities_deleted = cur.rowcount

            # Step 7: Delete source country
            cur.execute("DELETE FROM geo_countries WHERE id = %s", (source_info["id"],))

            print(f"    {source_code} → {target_code}: {regions_updated} regions, {localities_updated:,} localities remapped")
            if parents_cleared > 0:
                print(f"      Cleared {parents_cleared} parent references to country-level entry")
            if country_localities_deleted > 0:
                print(f"      Deleted {country_localities_deleted} country-level locality entry ({source_country_name})")

        conn.commit()

        # Remove from cache so geo-index doesn't try to use it
        del country_cache[source_code]


# ============================================================================
# Step 5c: Create Synthetic Regions for Orphan Localities
# ============================================================================

def create_synthetic_regions(conn: psycopg.Connection, country_cache: dict) -> None:
    """Create synthetic regions for localities that have no region/county/localadmin ancestor.

    This function:
    1. Finds all localities that have no region in their parent_overture_id chain
       (i.e., no parent is a region, county, or localadmin)
    2. Groups orphans by country
    3. Creates synthetic regions using SYNTHETIC_REGION_MAPPING
    4. Updates orphan localities to point to the synthetic region

    Only ~3,400 localities (0.076%) need synthetic regions - these are mostly in:
    - Israeli-administered territories (XH, XW, XZ)
    - Dutch Caribbean (AW, BQ, CW, SX)
    - City-states (SG, VA)
    - Small island nations
    - Research stations (AQ, SJ, TF)
    """
    print("\n  Creating synthetic regions for orphan localities...")
    start = time.time()

    # Get the synthetic source ID
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM geo_data_sources WHERE key = 'synthetic'")
        row = cur.fetchone()
        if not row:
            # Create the synthetic source if it doesn't exist
            cur.execute("""
                INSERT INTO geo_data_sources (key, name, description, data_type_id, priority)
                VALUES ('synthetic', 'Synthetic', 'Auto-generated geographic entities', 1, 5)
                RETURNING id
            """)
            row = cur.fetchone()
        synthetic_source_id = row[0]
        conn.commit()

    # Get the locality_group region type ID (or create it)
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM geo_region_types WHERE code = 'locality_group'")
        row = cur.fetchone()
        if not row:
            cur.execute("""
                INSERT INTO geo_region_types (code, name, sort_order)
                VALUES ('locality_group', 'Locality Group', 100)
                RETURNING id
            """)
            row = cur.fetchone()
        locality_group_type_id = row[0]
        conn.commit()

    # Build a set of all region overture_ids (region, county, localadmin)
    # These are entities that count as "regions" for hierarchy purposes
    region_overture_ids = set()
    with conn.cursor() as cur:
        cur.execute("SELECT overture_id FROM geo_regions WHERE overture_id IS NOT NULL")
        for row in cur.fetchall():
            region_overture_ids.add(row[0])

    print(f"    Loaded {len(region_overture_ids):,} region overture_ids")

    # Build parent chain lookup for all localities
    # parent_overture_id -> list of locality_ids that have this parent
    locality_parents = {}  # locality_id -> parent_overture_id
    locality_countries = {}  # locality_id -> country_code
    with conn.cursor() as cur:
        cur.execute("""
            SELECT l.id, l.parent_overture_id, c.code
            FROM geo_localities l
            JOIN geo_countries c ON l.country_id = c.id
            WHERE l.overture_id IS NOT NULL
        """)
        for locality_id, parent_oid, country_code in cur.fetchall():
            locality_parents[locality_id] = parent_oid
            locality_countries[locality_id] = country_code

    print(f"    Loaded {len(locality_parents):,} localities")

    # Build overture_id -> parent_overture_id lookup for walking chains
    # Include both regions and localities
    overture_to_parent = {}
    with conn.cursor() as cur:
        # Regions
        cur.execute("""
            SELECT r.overture_id, r2.overture_id as parent_overture_id
            FROM geo_regions r
            LEFT JOIN geo_regions r2 ON r.parent_region_id = r2.id
            WHERE r.overture_id IS NOT NULL
        """)
        for oid, parent_oid in cur.fetchall():
            overture_to_parent[oid] = parent_oid

        # Localities (for nested locality chains)
        cur.execute("""
            SELECT overture_id, parent_overture_id
            FROM geo_localities
            WHERE overture_id IS NOT NULL
        """)
        for oid, parent_oid in cur.fetchall():
            overture_to_parent[oid] = parent_oid

    # Find orphan localities (no region in ancestry chain)
    orphans_by_country = {}  # country_code -> list of locality_ids

    for locality_id, parent_oid in locality_parents.items():
        # Walk up the parent chain looking for a region
        current = parent_oid
        found_region = False
        max_depth = 20  # Prevent infinite loops

        while current and max_depth > 0:
            if current in region_overture_ids:
                found_region = True
                break
            current = overture_to_parent.get(current)
            max_depth -= 1

        if not found_region:
            country_code = locality_countries[locality_id]
            if country_code not in orphans_by_country:
                orphans_by_country[country_code] = []
            orphans_by_country[country_code].append(locality_id)

    total_orphans = sum(len(ids) for ids in orphans_by_country.values())
    print(f"    Found {total_orphans:,} orphan localities in {len(orphans_by_country)} countries")

    if total_orphans == 0:
        print("    No synthetic regions needed")
        return

    # Create synthetic regions and update orphans
    created_regions = {}  # region_code -> region_id
    updated_localities = 0

    with conn.cursor() as cur:
        for country_code, orphan_ids in sorted(orphans_by_country.items(), key=lambda x: -len(x[1])):
            # Look up the mapping for this country
            mapping = SYNTHETIC_REGION_MAPPING.get(country_code)

            if not mapping:
                # No mapping defined - create a country-specific one
                # Get English country name
                cur.execute("SELECT name FROM geo_countries WHERE code = %s", (country_code,))
                row = cur.fetchone()
                country_name = row[0] if row else country_code
                region_code = f"{country_code}-GEN"
                region_name = country_name
                target_country = country_code
            else:
                region_code, region_name, target_country = mapping

            # Get target country ID
            if target_country not in country_cache:
                print(f"    WARNING: Target country {target_country} not in cache, skipping {country_code}")
                continue

            target_country_id = country_cache[target_country]["id"]
            target_continent_id = country_cache[target_country]["continent_id"]

            # Create synthetic region if it doesn't exist
            if region_code not in created_regions:
                # Check if it already exists
                cur.execute("SELECT id FROM geo_regions WHERE code = %s", (region_code,))
                row = cur.fetchone()
                if row:
                    created_regions[region_code] = row[0]
                else:
                    # Create synthetic overture_id
                    synthetic_overture_id = f"synthetic:{region_code}"

                    cur.execute("""
                        INSERT INTO geo_regions (
                            country_id, continent_id, region_type_id, code, name,
                            overture_id, source_id
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        target_country_id, target_continent_id, locality_group_type_id,
                        region_code, region_name, synthetic_overture_id, synthetic_source_id
                    ))
                    region_id = cur.fetchone()[0]
                    created_regions[region_code] = region_id
                    print(f"    Created synthetic region: {region_code} ({region_name})")

            region_id = created_regions[region_code]
            synthetic_overture_id = f"synthetic:{region_code}"

            # Update orphan localities to point to the synthetic region
            # We update parent_overture_id so the search index builder will find the region
            cur.execute("""
                UPDATE geo_localities
                SET parent_overture_id = %s
                WHERE id = ANY(%s)
            """, (synthetic_overture_id, orphan_ids))
            updated = cur.rowcount
            updated_localities += updated

            if len(orphan_ids) >= 10:
                print(f"    {country_code}: {updated:,} localities → {region_code}")

    conn.commit()

    print(f"  Synthetic regions: {len(created_regions)} created, {updated_localities:,} localities updated")
    print(f"  Completed in {format_duration(time.time() - start)}")


# ============================================================================
# Step 5d: Manual Jerusalem Override
# ============================================================================

def override_jerusalem_region(conn: psycopg.Connection, country_cache: dict) -> None:
    """Manually override Jerusalem localities to be in Jerusalem District region.

    This ensures that specific Jerusalem localities that were originally in XW (West Bank)
    territory are moved to IL-JERUSALEM-DISTRICT region instead of IL-JUDEA-SAMARIA.

    From the parquet data, these are:
    - "Jerusalem" (ירושלים) - locality in XW
    - "East Jerusalem" (القدس الشرقية) - locality in XW
    """
    print("\n  Applying Jerusalem region override...")

    # Find the Jerusalem District region
    with conn.cursor() as cur:
        cur.execute("SELECT id, overture_id FROM geo_regions WHERE code = 'IL-JERUSALEM-DISTRICT'")
        row = cur.fetchone()
        if not row:
            print("    WARNING: Jerusalem District region not found, skipping override")
            return

        jerusalem_region_id = row[0]
        jerusalem_overture_id = row[1]

        # Get the Judea and Samaria region overture_id to move localities FROM it
        cur.execute("SELECT overture_id FROM geo_regions WHERE code = 'IL-JUDEA-SAMARIA'")
        row = cur.fetchone()
        if not row:
            print("    WARNING: Judea and Samaria region not found, skipping override")
            return

        judea_samaria_overture_id = row[0]

        # Update only the two specific Jerusalem localities:
        # 1. Are currently pointing to Judea and Samaria region
        # 2. Have exact name "Jerusalem" or "East Jerusalem"
        cur.execute("""
            UPDATE geo_localities
            SET parent_overture_id = %s
            WHERE parent_overture_id = %s
              AND name IN ('Jerusalem', 'East Jerusalem')
              AND country_id = (SELECT id FROM geo_countries WHERE code = 'IL')
        """, (jerusalem_overture_id, judea_samaria_overture_id))

        updated = cur.rowcount
        if updated > 0:
            print(f"    Moved {updated} Jerusalem localities from Judea and Samaria to Jerusalem District")

    conn.commit()


# ============================================================================
# Step 6: Import Admin Boundaries (country/region polygons)
# ============================================================================

def import_admin_boundaries(conn: psycopg.Connection, duck: duckdb.DuckDBPyConnection,
                            data_dir: Path) -> None:
    """Import country and region boundaries from division_area parquet files.

    Supports multiple directory structures:
    1. New: data_dir/division_area/*.parquet (sharded files from S3)
    2. Legacy: data_dir/division_area*.parquet (single or glob pattern)

    Uses Python caches for ID resolution and batch updates for speed.
    """
    print("\n[6/8] Importing admin boundaries...")

    # Check for new structure first (subdirectory with sharded files)
    division_area_subdir = data_dir / "division_area"
    if division_area_subdir.exists():
        parquet_files = list(division_area_subdir.glob("*.parquet"))
        if parquet_files:
            parquet_pattern = str(division_area_subdir / "*.parquet")
        else:
            print(f"  No parquet files in {division_area_subdir}, skipping boundaries")
            return
    else:
        # Legacy: files in root directory
        parquet_files = list(data_dir.glob("division_area*.parquet"))
        if not parquet_files:
            print("  No division_area parquet files found, skipping boundaries")
            print("  Run 'python import-overture.py download' to download boundary data")
            return
        parquet_pattern = str(data_dir / "division_area*.parquet")

    print(f"  Found {len(parquet_files)} boundary parquet files")
    start = time.time()

    # Build Python caches for ID resolution (avoids DB lookups)
    print("  Building ID caches...")
    country_id_cache = {}  # code -> id
    region_id_cache = {}   # overture_id -> id

    with conn.cursor() as cur:
        cur.execute("SELECT id, code FROM geo_countries")
        for row in cur.fetchall():
            country_id_cache[row[1]] = row[0]

        cur.execute("SELECT id, overture_id FROM geo_regions WHERE overture_id IS NOT NULL")
        for row in cur.fetchall():
            region_id_cache[row[1]] = row[0]

    print(f"    Cached {len(country_id_cache)} countries, {len(region_id_cache):,} regions")

    # Import country boundaries using batch updates
    # Use ST_Union to aggregate all polygons for each country into a single MultiPolygon
    # This preserves islands, exclaves, and other disconnected territories
    print("  Importing country boundaries...")
    query_countries = f"""
    SELECT country, ST_AsWKB(ST_Union_Agg(geometry)) as geom_wkb
    FROM read_parquet('{parquet_pattern}')
    WHERE subtype IN ('country', 'dependency')
      AND country IS NOT NULL
      AND geometry IS NOT NULL
    GROUP BY country
    """

    result = duck.execute(query_countries)
    country_updated = 0

    while True:
        batch = result.fetchmany(BOUNDARY_BATCH_SIZE)
        if not batch:
            break

        # Filter to only countries we have in cache
        valid_updates = []
        for country_code, geometry in batch:
            if country_code in country_id_cache:
                geom_bytes = bytes(geometry) if not isinstance(geometry, bytes) else geometry
                valid_updates.append((geom_bytes, country_id_cache[country_code]))

        if valid_updates:
            with conn.cursor() as cur:
                cur.executemany("""
                    UPDATE geo_countries
                    SET boundary = ST_Multi(ST_GeomFromWKB(%s, 4326))
                    WHERE id = %s
                """, valid_updates)
                country_updated += len(valid_updates)
            conn.commit()

    print(f"    Countries: {country_updated} boundaries updated")

    # Import region boundaries using batch updates with ID cache
    # Use ST_Union to aggregate all polygons for each region into a single MultiPolygon
    # This preserves disconnected territories (e.g., Alaska for US regions)
    print("  Importing region boundaries...")
    query_regions = f"""
    SELECT division_id, ST_AsWKB(ST_Union_Agg(geometry)) as geom_wkb
    FROM read_parquet('{parquet_pattern}')
    WHERE subtype IN ('region', 'county', 'localadmin')
      AND division_id IS NOT NULL
      AND geometry IS NOT NULL
    GROUP BY division_id
    """

    result = duck.execute(query_regions)
    region_updated = 0
    region_processed = 0

    while True:
        batch = result.fetchmany(BOUNDARY_BATCH_SIZE)
        if not batch:
            break

        # Filter to only regions we have in cache, resolve IDs in Python
        valid_updates = []
        for division_id, geometry in batch:
            region_processed += 1
            if division_id in region_id_cache:
                geom_bytes = bytes(geometry) if not isinstance(geometry, bytes) else geometry
                valid_updates.append((geom_bytes, region_id_cache[division_id]))

        if valid_updates:
            with conn.cursor() as cur:
                cur.executemany("""
                    UPDATE geo_regions
                    SET boundary = ST_Multi(ST_GeomFromWKB(%s, 4326))
                    WHERE id = %s
                """, valid_updates)
                region_updated += len(valid_updates)
            conn.commit()

        if region_processed % 10000 == 0:
            print(f"    Regions: {region_updated:,} updated ({region_processed:,} processed)...")

    print(f"    Regions: {region_updated:,} boundaries updated")

    # Import locality boundaries using batch updates with ID cache
    print("  Importing locality boundaries...")

    # Build locality ID cache (overture_id -> id)
    locality_id_cache = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, overture_id FROM geo_localities WHERE overture_id IS NOT NULL")
        for row in cur.fetchall():
            locality_id_cache[row[1]] = row[0]
    print(f"    Cached {len(locality_id_cache):,} localities")

    # Use ST_Union to aggregate all polygons for each locality into a single MultiPolygon
    # This preserves disconnected parts of cities (e.g., cities with exclaves)
    query_localities = f"""
    SELECT division_id, ST_AsWKB(ST_Union_Agg(geometry)) as geom_wkb
    FROM read_parquet('{parquet_pattern}')
    WHERE subtype IN ('locality', 'neighborhood', 'macrohood', 'microhood')
      AND division_id IS NOT NULL
      AND geometry IS NOT NULL
    GROUP BY division_id
    """

    result = duck.execute(query_localities)
    locality_updated = 0
    locality_processed = 0

    while True:
        batch = result.fetchmany(BOUNDARY_BATCH_SIZE)
        if not batch:
            break

        # Filter to only localities we have in cache, resolve IDs in Python
        valid_updates = []
        for division_id, geometry in batch:
            locality_processed += 1
            if division_id in locality_id_cache:
                geom_bytes = bytes(geometry) if not isinstance(geometry, bytes) else geometry
                valid_updates.append((geom_bytes, locality_id_cache[division_id]))

        if valid_updates:
            with conn.cursor() as cur:
                cur.executemany("""
                    UPDATE geo_localities
                    SET boundary = ST_Multi(ST_GeomFromWKB(%s, 4326))
                    WHERE id = %s
                """, valid_updates)
                locality_updated += len(valid_updates)
            conn.commit()

        if locality_processed % 50000 == 0:
            print(f"    Localities: {locality_updated:,} updated ({locality_processed:,} processed)...")

    print(f"    Localities: {locality_updated:,} boundaries updated")
    print(f"  Boundaries imported in {format_duration(time.time() - start)}")


# ============================================================================
# Step 7: Import Multi-language Names
# ============================================================================

def import_names(conn: psycopg.Connection, duck: duckdb.DuckDBPyConnection,
                 parquet_pattern: str, source_id: int) -> None:
    """Import multi-language names from Overture data."""
    print("\n[7/8] Importing multi-language names...")
    start = time.time()
    total_names = 0

    # Process each entity type
    for entity_type, subtypes, table_name in [
        ("country", ["country", "dependency"], "geo_countries"),
        ("region", ["region", "county", "localadmin"], "geo_regions"),
        ("locality", ["locality", "neighborhood", "macrohood", "microhood"], "geo_localities"),
    ]:
        print(f"  Processing {entity_type} names...")
        subtype_list = ", ".join(f"'{s}'" for s in subtypes)

        # Primary names - stored with 'xx' language code since Overture's
        # names.primary is the local/native language name, NOT English.
        # English names come from names.common['en'] which is imported separately.
        # 'xx' is ISO 639 reserved code for "no linguistic content" / unspecified language.
        query_primary = f"""
        SELECT DISTINCT p.id as overture_id, p.names.primary as name
        FROM read_parquet('{parquet_pattern}') p
        WHERE p.subtype IN ({subtype_list}) AND p.names.primary IS NOT NULL
        """

        result = duck.execute(query_primary)
        primary_count = 0
        primary_processed = 0

        while True:
            batch = result.fetchmany(NAMES_BATCH_SIZE)
            if not batch:
                break

            primary_processed += len(batch)
            values = []
            params = [entity_type, source_id]
            for overture_id, name in batch:
                values.append("(%s, %s)")
                params.extend([overture_id, str(name)])

            if values:
                with conn.cursor() as cur:
                    # Use 'xx' language code for primary names (native/local language)
                    # This prevents them from being picked up as English display names
                    cur.execute(f"""
                        INSERT INTO geo_names (entity_type, entity_id, language_code, name, name_type, source_id)
                        SELECT %s, t.id, 'xx', v.name, 'primary', %s
                        FROM (VALUES {','.join(values)}) AS v(overture_id, name)
                        JOIN {table_name} t ON t.overture_id = v.overture_id
                    """, params)
                    primary_count += cur.rowcount
                conn.commit()

            if primary_processed % REPORT_EVERY == 0:
                print(f"      Primary progress: {primary_count:,} inserted ({primary_processed:,} processed)...")

        print(f"    Primary (local language): {primary_count:,}")
        total_names += primary_count

        # Common names (2-letter language codes only)
        query_common = f"""
        SELECT DISTINCT p.id as overture_id, lang as language_code, name
        FROM read_parquet('{parquet_pattern}') p,
        LATERAL (SELECT UNNEST(map_keys(p.names.common)) as lang, UNNEST(map_values(p.names.common)) as name)
        WHERE p.subtype IN ({subtype_list}) AND p.names.common IS NOT NULL AND name IS NOT NULL
          AND length(lang) = 2
        """

        result = duck.execute(query_common)
        common_count = 0
        common_processed = 0

        while True:
            batch = result.fetchmany(NAMES_BATCH_SIZE)
            if not batch:
                break

            common_processed += len(batch)
            values = []
            params = [entity_type, source_id]
            for overture_id, lang, name in batch:
                values.append("(%s, %s, %s)")
                params.extend([overture_id, str(lang) if lang else "en", str(name)])

            if values:
                with conn.cursor() as cur:
                    cur.execute(f"""
                        INSERT INTO geo_names (entity_type, entity_id, language_code, name, name_type, source_id)
                        SELECT %s, t.id, v.lang, v.name, 'common', %s
                        FROM (VALUES {','.join(values)}) AS v(overture_id, lang, name)
                        JOIN {table_name} t ON t.overture_id = v.overture_id
                    """, params)
                    common_count += cur.rowcount
                conn.commit()

            if common_processed % REPORT_EVERY == 0:
                print(f"      Common progress: {common_count:,} inserted ({common_processed:,} processed)...")

        print(f"    Common: {common_count:,}")
        total_names += common_count

        # Rule-based names
        query_rules = f"""
        SELECT DISTINCT p.id as overture_id,
            COALESCE(r.language, 'en') as language_code,
            r.value as name, r.variant as name_type
        FROM read_parquet('{parquet_pattern}') p,
        LATERAL (SELECT UNNEST(p.names.rules) as r)
        WHERE p.subtype IN ({subtype_list}) AND p.names.rules IS NOT NULL
          AND r.value IS NOT NULL AND r.variant IN ('official', 'alternate', 'short')
          AND (r.language IS NULL OR length(r.language) = 2)
        """

        result = duck.execute(query_rules)
        rules_count = 0
        rules_processed = 0

        while True:
            batch = result.fetchmany(NAMES_BATCH_SIZE)
            if not batch:
                break

            rules_processed += len(batch)
            values = []
            params = [entity_type, source_id]
            for overture_id, lang, name, name_type in batch:
                values.append("(%s, %s, %s, %s)")
                params.extend([overture_id, str(lang) if lang else "en", str(name), name_type])

            if values:
                with conn.cursor() as cur:
                    cur.execute(f"""
                        INSERT INTO geo_names (entity_type, entity_id, language_code, name, name_type, source_id)
                        SELECT %s, t.id, v.lang, v.name, v.name_type, %s
                        FROM (VALUES {','.join(values)}) AS v(overture_id, lang, name, name_type)
                        JOIN {table_name} t ON t.overture_id = v.overture_id
                    """, params)
                    rules_count += cur.rowcount
                conn.commit()

            if rules_processed % REPORT_EVERY == 0:
                print(f"      Rules progress: {rules_count:,} inserted ({rules_processed:,} processed)...")

        print(f"    Rules: {rules_count:,}")
        total_names += rules_count

    print(f"  Names imported: {total_names:,} in {format_duration(time.time() - start)}")


# ============================================================================
# Step 8: Re-enable Constraints and Indexes
# ============================================================================

def enable_constraints(conn: psycopg.Connection) -> None:
    """Re-enable FK triggers and recreate indexes."""
    print("\n[8/8] Re-enabling constraints and indexes...")

    with conn.cursor() as cur:
        # Enable triggers
        for table in TABLES_WITH_TRIGGERS:
            print(f"  Enabling triggers on {table}...")
            cur.execute(sql.SQL("ALTER TABLE {} ENABLE TRIGGER ALL").format(sql.Identifier(table)))

        # Recreate indexes
        for ddl in INDEXES_DDL:
            idx_name = ddl.split("IF NOT EXISTS ")[1].split(" ON")[0]
            print(f"  Creating index {idx_name}...")
            cur.execute(ddl)

        # Restore FK constraint on geo_names
        print("  Restoring geo_names FK constraint...")
        cur.execute("""
            ALTER TABLE geo_names
            ADD CONSTRAINT geo_names_language_code_fkey
            FOREIGN KEY (language_code) REFERENCES languages(code) ON DELETE CASCADE
        """)

    conn.commit()
    print("  Constraints enabled")


# ============================================================================
# Main Entry Point
# ============================================================================

def run_import(args) -> None:
    """Run the full import process."""
    # Get database URL
    database_url = args.database_url or get_database_url()
    if not database_url:
        print("Error: DATABASE_URL not set")
        sys.exit(1)

    # Validate data directory
    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"Error: Data directory does not exist: {data_dir}")
        sys.exit(1)

    # Find division parquet files (point data)
    # Support multiple directory structures:
    # 1. New: data_dir/division/*.parquet (sharded files from S3)
    # 2. Legacy: data_dir/division.parquet (single file)
    # 3. Legacy: data_dir/divisions-*.parquet (numbered files)
    division_subdir = data_dir / "division"
    if division_subdir.exists():
        # New structure: sharded files in subdirectory
        parquet_files = list(division_subdir.glob("*.parquet"))
        if not parquet_files:
            print(f"Error: No parquet files found in {division_subdir}")
            sys.exit(1)
        parquet_pattern = str(division_subdir / "*.parquet")
    else:
        # Legacy: single file or numbered files in root
        division_file = data_dir / "division.parquet"
        if division_file.exists():
            parquet_files = [division_file]
            parquet_pattern = str(division_file)
        else:
            parquet_files = list(data_dir.glob("divisions-*.parquet"))
            if not parquet_files:
                print(f"Error: No division parquet files found in {data_dir}")
                print("  Expected: {data_dir}/division/*.parquet (new) or {data_dir}/division.parquet (legacy)")
                sys.exit(1)
            parquet_pattern = str(data_dir / "divisions-*.parquet")

    print("=" * 60)
    print("Overture Geographic Data Import")
    print("=" * 60)
    print(f"Data directory: {data_dir}")
    print(f"Parquet files: {len(parquet_files)}")
    print(f"Skip boundaries: {args.skip_boundaries}")
    print(f"Skip names: {args.skip_names}")

    total_start = time.time()

    # Connect to PostgreSQL
    print("\nConnecting to PostgreSQL...")
    conn = psycopg.connect(database_url)

    # Create DuckDB connection (in-memory, just for parquet reading)
    duck = duckdb.connect(":memory:")
    # Load spatial extension for geometry parsing
    duck.execute("INSTALL spatial; LOAD spatial;")

    # Get Overture source ID
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM geo_data_sources WHERE key = 'overture'")
        row = cur.fetchone()
        source_id = row[0] if row else 1
    print(f"Overture source ID: {source_id}")

    try:
        # Execute all steps
        reset_tables(conn)
        disable_constraints(conn)
        country_cache = import_countries(conn, duck, parquet_pattern, source_id)
        region_map = import_regions(conn, duck, parquet_pattern, source_id, country_cache)
        import_localities(conn, duck, parquet_pattern, source_id, country_cache)

        # Create synthetic regions BEFORE remapping disputed territories
        # This ensures XW/XH/XZ localities get assigned to IL-TERRITORY while still
        # under their original country codes, then remap moves them to Israel
        create_synthetic_regions(conn, country_cache)
        remap_disputed_territories(conn, country_cache)

        # Apply manual Jerusalem override AFTER synthetic regions and remapping
        override_jerusalem_region(conn, country_cache)

        if not args.skip_boundaries:
            import_admin_boundaries(conn, duck, data_dir)

        if not args.skip_names:
            import_names(conn, duck, parquet_pattern, source_id)

        enable_constraints(conn)

        # Final statistics
        print("\n" + "=" * 60)
        print("Import Complete!")
        print("=" * 60)

        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM geo_countries WHERE overture_id IS NOT NULL")
            countries = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM geo_regions WHERE overture_id IS NOT NULL")
            regions = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM geo_localities WHERE overture_id IS NOT NULL")
            localities = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM geo_names")
            names = cur.fetchone()[0]

        print(f"Countries:     {countries:,}")
        print(f"Regions:       {regions:,}")
        print(f"Localities:    {localities:,}")
        print(f"Names:         {names:,}")
        print(f"Total time:    {format_duration(time.time() - total_start)}")
        print()
        print("Next step: Run 'geo-index' to build the search index")

    finally:
        duck.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Unified Overture Geographic Data Importer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Download data from Overture S3
    python import-overture.py download --data-dir ./data/overture
    python import-overture.py download --release 2025-01 --force

    # Run import (default command)
    python import-overture.py import --data-dir ./data/overture
    python import-overture.py --data-dir ./data/overture --skip-boundaries
    python import-overture.py --data-dir ./data/overture --skip-names
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Download subcommand
    download_parser = subparsers.add_parser(
        "download",
        help="Download Overture parquet files from S3"
    )
    download_parser.add_argument(
        "--data-dir",
        default=DEFAULT_DATA_DIR,
        help=f"Output directory for parquet files (default: {DEFAULT_DATA_DIR})"
    )
    download_parser.add_argument(
        "--release",
        default=DEFAULT_RELEASE,
        help=f"Overture release version (default: {DEFAULT_RELEASE})"
    )
    download_parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-download of existing files"
    )
    download_parser.add_argument(
        "--division-only",
        action="store_true",
        help="Only download division data (skip division_area boundaries, ~3.3GB)"
    )

    # Import subcommand
    import_parser = subparsers.add_parser(
        "import",
        help="Run full import of Overture data"
    )
    import_parser.add_argument(
        "--data-dir",
        default=DEFAULT_DATA_DIR,
        help=f"Directory containing Overture parquet files (default: {DEFAULT_DATA_DIR})"
    )
    import_parser.add_argument(
        "--database-url",
        default=None,
        help="PostgreSQL connection URL (defaults to DATABASE_URL env)"
    )
    import_parser.add_argument(
        "--skip-boundaries",
        action="store_true",
        help="Skip importing admin boundaries (country/region polygons)"
    )
    import_parser.add_argument(
        "--skip-names",
        action="store_true",
        help="Skip importing multi-language names"
    )

    # Also allow import flags on root parser for backward compatibility
    parser.add_argument(
        "--data-dir",
        default=DEFAULT_DATA_DIR,
        help=f"Directory containing Overture parquet files (default: {DEFAULT_DATA_DIR})"
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help="PostgreSQL connection URL (defaults to DATABASE_URL env)"
    )
    parser.add_argument(
        "--skip-boundaries",
        action="store_true",
        help="Skip importing admin boundaries (country/region polygons)"
    )
    parser.add_argument(
        "--skip-names",
        action="store_true",
        help="Skip importing multi-language names"
    )

    args = parser.parse_args()

    if args.command == "download":
        download_overture_data(
            data_dir=Path(args.data_dir),
            release=args.release,
            force=args.force,
            division_only=args.division_only
        )
    elif args.command == "import":
        run_import(args)
    else:
        # Default to import if no command specified
        run_import(args)


if __name__ == "__main__":
    main()
