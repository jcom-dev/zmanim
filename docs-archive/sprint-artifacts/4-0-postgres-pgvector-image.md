# Story 4.0: PostgreSQL 17 with PostGIS + pgvector Docker Image

Status: review

## Story

As a **developer**,
I want **a custom PostgreSQL Docker image with PostGIS and pgvector extensions**,
so that **our local development environment matches production capabilities and supports vector embeddings for AI features**.

## Acceptance Criteria

1. **AC-4.0.1**: Custom Docker image builds successfully with PostgreSQL 17, PostGIS 3.5+, and pgvector 0.8.0
2. **AC-4.0.2**: `CREATE EXTENSION vector;` succeeds on database initialization without manual intervention
3. **AC-4.0.3**: `CREATE EXTENSION postgis;` succeeds on database initialization
4. **AC-4.0.4**: Coder workspace Terraform uses the custom image for PostgreSQL container
5. **AC-4.0.5**: E2E tests pass with pgvector-enabled database (docker-compose)
6. **AC-4.0.6**: PostgreSQL version check shows 17.x (`SELECT version();`)
7. **AC-4.0.7**: Existing migrations run successfully on the new image
8. **AC-4.0.8**: Valid OpenAI API key configured and verified (for embeddings in Stories 4.7+)
9. **AC-4.0.9**: Valid Anthropic API key configured and verified (for AI features in Stories 4.8+)
10. **AC-4.0.10**: All tests pass (unit, integration, E2E) before marking ready for review

## DoD Gate

**This story is NOT ready for review until:**
- [x] All existing E2E tests pass with new PostgreSQL image
- [x] Manual verification of pgvector extension creation
- [x] Manual verification of PostGIS extension creation
- [x] Coder workspace rebuilds successfully
- [x] OpenAI API key verified: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"` returns 200
- [x] Anthropic API key verified: test call to Claude API succeeds

## Tasks / Subtasks

- [x] Task 1: Create custom PostgreSQL Dockerfile (AC: 1, 2, 3)
  - [x] 1.1 Create `.coder/docker/Dockerfile.postgres` based on `postgis/postgis:17-3.5`
  - [x] 1.2 Install pgvector build dependencies (build-essential, git, postgresql-server-dev-17)
  - [x] 1.3 Clone and build pgvector v0.8.0 from source
  - [x] 1.4 Clean up build dependencies to minimize image size
  - [x] 1.5 Create `.coder/docker/init-extensions.sql` to auto-enable extensions

- [x] Task 2: Update Coder workspace Terraform (AC: 4)
  - [x] 2.1 Modify `.coder/zmanim-workspace.tf` to use custom image
  - [x] 2.2 Update image reference to `zmanim-postgres:17-postgis-pgvector`
  - [x] 2.3 Ensure container mounts init script (via docker_image build block)

- [x] Task 3: Update build/push scripts (AC: 1)
  - [x] 3.1 Update `.coder/push-template.sh` to verify Dockerfile exists
  - [x] 3.2 Terraform handles image build via docker_image resource

- [x] Task 4: Update docker-compose for E2E tests (AC: 5)
  - [x] 4.1 Modify `docker-compose.yml` postgres-test service to build from custom Dockerfile
  - [x] 4.2 Image tagged as `zmanim-postgres:17-postgis-pgvector-test`

- [x] Task 5: Verification testing (AC: 6, 7, 10) **REQUIRES CODER REBUILD**
  - [x] 5.1 Verify PostgreSQL version is 17.x
  - [x] 5.2 Verify pgvector extension creation works
  - [x] 5.3 Verify PostGIS extension creation works
  - [x] 5.4 Run all existing migrations
  - [x] 5.5 Run E2E test suite

- [x] Task 6: API key configuration and verification (AC: 8, 9)
  - [x] 6.1 Update `.coder/zmanim-workspace.tf` to include `OPENAI_API_KEY` env var from Coder parameter (already done)
  - [x] 6.2 Update `.coder/zmanim-workspace.tf` to include `ANTHROPIC_API_KEY` env var from Coder parameter (already done)
  - [x] 6.3 Update `.coder/push-template.sh` to source from `.env.openai` and `.env.claude` (already done)
  - [x] 6.4 Terraform variables for API keys (sensitive=true) (already configured)
  - [x] 6.5 Create verification script `scripts/verify-api-keys.sh`
  - [x] 6.6 Test OpenAI API connectivity (requires keys to be set)
  - [x] 6.7 Test Anthropic API connectivity (requires keys to be set)
  - [x] 6.8 Add `.env.example` files with placeholder keys (already exist)

## Dev Notes

### Dockerfile Structure

```dockerfile
# .coder/docker/Dockerfile.postgres
FROM postgis/postgis:17-3.5

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    postgresql-server-dev-17 \
    && rm -rf /var/lib/apt/lists/*

# Install pgvector
RUN git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make \
    && make install \
    && rm -rf /tmp/pgvector

# Clean up build dependencies
RUN apt-get purge -y --auto-remove build-essential git postgresql-server-dev-17

# Add initialization script to enable extensions
COPY init-extensions.sql /docker-entrypoint-initdb.d/
```

### Init Script

```sql
-- .coder/docker/init-extensions.sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
```

### Version Alignment

| Component | Version | Notes |
|-----------|---------|-------|
| PostgreSQL | 17 | Latest stable version |
| PostGIS | 3.5 | Latest stable from base image |
| pgvector | 0.8.0 | Latest stable (Nov 2024) |

### Coder Terraform API Key Parameters

```terraform
# .coder/zmanim-workspace.tf

data "coder_parameter" "openai_api_key" {
  name        = "openai_api_key"
  display_name = "OpenAI API Key"
  description  = "API key for OpenAI embeddings (text-embedding-3-small)"
  type        = "string"
  mutable     = true
  sensitive   = true
  default     = ""
}

data "coder_parameter" "anthropic_api_key" {
  name        = "anthropic_api_key"
  display_name = "Anthropic API Key"
  description  = "API key for Claude AI (formula generation)"
  type        = "string"
  mutable     = true
  sensitive   = true
  default     = ""
}

# In the container resource, add environment variables:
resource "docker_container" "workspace" {
  # ... existing config ...

  env = [
    # ... existing env vars ...
    "OPENAI_API_KEY=${data.coder_parameter.openai_api_key.value}",
    "ANTHROPIC_API_KEY=${data.coder_parameter.anthropic_api_key.value}",
  ]
}
```

### push-template.sh Validation

```bash
# scripts/push-template.sh additions

echo "Validating Coder parameters..."
if ! coder templates list | grep -q "zmanim"; then
  echo "WARNING: Template not found. Creating new template..."
fi

echo "Reminder: Set OPENAI_API_KEY and ANTHROPIC_API_KEY in Coder workspace parameters"
echo "These are required for AI features in Epic 4"
```

### Project Structure Notes

- New directory: `.coder/docker/` for Docker build files
- Modified: `.coder/zmanim-workspace.tf`
- Modified: `scripts/push-template.sh`
- Modified: `docker-compose.yml`

### Testing Standards

- Verify with `SELECT version();` returns PostgreSQL 17.x
- Verify with `SELECT * FROM pg_extension WHERE extname = 'vector';`
- Verify with `SELECT * FROM pg_extension WHERE extname = 'postgis';`
- Run full E2E suite to ensure no regressions

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-4.md#Infrastructure Requirements]
- [Source: docs/epic-4-algorithm-editor-ux.md#Story 4.0]
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [PostGIS Docker Hub](https://hub.docker.com/r/postgis/postgis)

## Dev Agent Record

### Context Reference

docs/sprint-artifacts/stories/4-0-postgres-pgvector-image.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

2025-11-27: Started implementation of custom PostgreSQL 17 + PostGIS + pgvector Docker image

### Completion Notes List

- Created custom Dockerfile based on postgis/postgis:17-3.5 with pgvector 0.8.0
- Added init-extensions.sql to auto-enable PostGIS and pgvector on database creation
- Updated Terraform to use docker_image resource with build block for custom image
- Updated docker-compose.yml to build custom image for E2E tests
- Created verify-api-keys.sh script for API key validation
- **VERIFIED**: PostgreSQL 17.5 running with PostGIS 3.5.2 and pgvector 0.8.0
- **VERIFIED**: All existing migrations run successfully on new image
- **VERIFIED**: Both extensions (postgis, vector) create without errors
- **VERIFIED**: OpenAI API key configured and tested (HTTP 200)
- **VERIFIED**: Anthropic API key configured and tested (HTTP 200)
- Removed .claude.json copying from push-template.sh (user request)

### File List

**New files:**
- .coder/docker/Dockerfile.postgres
- .coder/docker/init-extensions.sql
- scripts/verify-api-keys.sh

**Modified files:**
- .coder/zmanim-workspace.tf (added docker_image resource, updated postgres container)
- .coder/push-template.sh (added Dockerfile verification, removed .claude.json copying)
- docker-compose.yml (updated postgres-test service to build custom image)
- docs/sprint-artifacts/sprint-status.yaml (status: ready-for-dev → in-progress → review)
- docs/sprint-artifacts/4-0-postgres-pgvector-image.md (marked all tasks complete, updated status)
