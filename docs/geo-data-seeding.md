# Geographic Data Seeding

This document describes the process for exporting, storing, and seeding geographic data across environments.

## Overview

Geographic data (~163k cities, countries, regions, boundaries) is large and slow to import from raw sources. Instead, we export a compressed PostgreSQL dump and restore it quickly during migrations.

**Process:**
1. Export geo data to compressed dump (one-time)
2. Upload to S3
3. Seed new environments from S3 (~5-10 minutes)

## Tools

### Export Tool (`cmd/export-geodata`)

Creates a compressed PostgreSQL dump of all `geo_*` tables.

**Usage:**
```bash
# Using helper script (recommended)
./scripts/export-geodata.sh

# Or directly
cd api
go run cmd/export-geodata/main.go export --output=/tmp/geodata.dump.zst

# Verify dump
go run cmd/export-geodata/main.go verify --file=/tmp/geodata.dump.zst
```

**Options:**
- `--output FILE` - Output file path (default: `geodata-YYYYMMDD.dump.zst`)
- `--compression N` - Zstd compression level 1-22 (default: 3)
- `--no-compress` - Skip zstd compression

**Output:**
- `geodata-YYYYMMDD.dump.zst` - Compressed dump (~2-4GB)
- `geodata-YYYYMMDD.dump.zst.sha256` - Checksum file

### Seed Tool (`cmd/seed-geodata`)

Downloads and restores geographic data from S3 or local files.

**Usage:**
```bash
# Using helper script (recommended)
./scripts/seed-geodata.sh

# Or directly
cd api
go run cmd/seed-geodata/main.go seed \
  --source=s3://bucket/geo-seed/geodata.dump.zst

# From local file
go run cmd/seed-geodata/main.go seed --source=/tmp/geodata.dump.zst

# Full reset and restore
go run cmd/seed-geodata/main.go seed --reset \
  --source=s3://bucket/geo-seed/geodata.dump.zst

# Verify without restoring
go run cmd/seed-geodata/main.go verify \
  --source=s3://bucket/geo-seed/geodata.dump.zst
```

**Options:**
- `--source URL` - S3 URL or local file path (required)
- `--jobs N` - Parallel restore jobs (default: 4)
- `--reset` - Delete existing geo data before restore (DESTRUCTIVE!)
- `--no-verify` - Skip checksum verification
- `--keep-temp` - Keep temporary files after restore

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Export | 5-10 min | One-time, ~10GB → 2-4GB compressed |
| S3 Upload | 1-3 min | Depends on bandwidth |
| Download | 30-90 sec | From S3 to server |
| Restore | 3-7 min | Parallel restore with 4 jobs |
| **Total Seed** | **5-10 min** | Download + restore + analyze |

## Format Details

**Dump format:** PostgreSQL custom format + Zstandard compression

**Why this approach:**
- `pg_dump --format=custom` preserves PostGIS geometry types
- Built-in compression in pg_dump (level 9)
- Additional zstd compression reduces size 60-75%
- Supports parallel restoration (`--jobs=4`)
- Streaming decompression (no temp disk space)
- Zstd decompresses 3-4x faster than gzip

**Tables included:**
- `geo_cities` (~163k cities)
- `geo_countries` (countries)
- `geo_regions` (states/provinces)
- `geo_districts` (counties)
- `geo_*_boundaries` (PostGIS geometries)
- `geo_city_coordinates` (lat/lng)
- `geo_city_elevations` (elevation data)
- All supporting tables

## S3 Storage

**Recommended structure:**
```
s3://your-bucket/
  geo-seed/
    geodata-20250101.dump.zst          # Latest dump
    geodata-20250101.dump.zst.sha256   # Checksum
    geodata-20241201.dump.zst          # Previous version (optional)
    geodata-20241201.dump.zst.sha256
```

**Upload:**
```bash
# After running export
aws s3 cp api/data/geodata-20250101.dump.zst \
  s3://your-bucket/geo-seed/

aws s3 cp api/data/geodata-20250101.dump.zst.sha256 \
  s3://your-bucket/geo-seed/
```

**Set default source:**
```bash
# In .env
GEO_SEED_SOURCE=s3://your-bucket/geo-seed/geodata.dump.zst
```

## Migration Integration

### Option 1: Helper Script (Recommended)
```bash
# In migration or setup script
./scripts/seed-geodata.sh
```

### Option 2: Direct Integration
```bash
# In migration script
cd api
go run cmd/seed-geodata/main.go seed \
  --source="${GEO_SEED_SOURCE:-s3://bucket/geo-seed/geodata.dump.zst}"
```

### Option 3: Docker/CI
```dockerfile
# In Dockerfile or CI script
RUN go run cmd/seed-geodata/main.go seed \
    --source=s3://bucket/geo-seed/geodata.dump.zst \
    --jobs=8
```

## Dependencies

**Required:**
- `pg_dump` / `pg_restore` (postgresql-client)
- `zstd` (compression tool)
- AWS credentials (for S3 access)

**Installation:**
```bash
# Ubuntu/Debian
apt-get install postgresql-client zstd

# macOS
brew install postgresql zstd

# Alpine (Docker)
apk add postgresql-client zstd
```

## Troubleshooting

### Export fails with "permission denied"
```bash
# Check DATABASE_URL has sufficient privileges
# Need SELECT on all geo_* tables
```

### Seed fails with "checksum mismatch"
```bash
# File may be corrupted during download
# Try re-downloading or use --no-verify flag
go run cmd/seed-geodata/main.go seed --no-verify --source=...
```

### Restore is slow
```bash
# Increase parallel jobs
go run cmd/seed-geodata/main.go seed --jobs=8 --source=...
```

### S3 download fails
```bash
# Check AWS credentials
aws s3 ls s3://bucket/geo-seed/

# Set AWS region
export AWS_REGION=us-east-1
```

### Out of disk space
```bash
# Seed tool uses streaming decompression (no temp disk)
# But ensure database has space for ~10GB of geo data
df -h /var/lib/postgresql
```

## Security

**Checksums:** All dumps include SHA256 checksums for integrity verification

**S3 permissions:**
- Read-only access needed for seeding
- Write access needed only for initial upload

**Database permissions:**
- Export: `SELECT` on all `geo_*` tables
- Seed with `--reset`: `TRUNCATE` on all `geo_*` tables
- Seed without `--reset`: `INSERT` on all `geo_*` tables

## Updating the Seed Data

When geo data changes (new cities, updated boundaries):

1. **Export new dump:**
   ```bash
   ./scripts/export-geodata.sh
   ```

2. **Upload to S3:**
   ```bash
   aws s3 cp api/data/geodata-YYYYMMDD.dump.zst \
     s3://bucket/geo-seed/geodata-latest.dump.zst

   aws s3 cp api/data/geodata-YYYYMMDD.dump.zst.sha256 \
     s3://bucket/geo-seed/geodata-latest.dump.zst.sha256
   ```

3. **Update environments:**
   ```bash
   ./scripts/seed-geodata.sh --reset
   ```

## See Also

- [WOF Import Tool](../api/cmd/import-wof/README.md) - Original data import
- [Elevation Import](../api/cmd/import-elevation/README.md) - Elevation data
- [Database Migrations](./migrations.md) - General migration guide
