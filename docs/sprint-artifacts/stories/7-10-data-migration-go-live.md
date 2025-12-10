# Story 7.10: Data Migration & Go-Live

Status: ready-for-dev

## Story

As a **developer**,
I want **to migrate production data from Xata to AWS PostgreSQL**,
So that **the new infrastructure has all existing data with zero loss**.

## Acceptance Criteria

1. **AC1:** pg_dump exports data from Xata PostgreSQL
2. **AC2:** pg_restore imports to AWS PostgreSQL
3. **AC3:** Data integrity verified (row counts match)
4. **AC4:** All API endpoints tested against new DB
5. **AC5:** DNS cutover plan documented
6. **AC6:** Rollback plan documented
7. **AC7:** Go-live executed with zero data loss

## Tasks / Subtasks

- [ ] **Task 1: Migration Script** (AC: 1, 2)
  - [ ] 1.1 Create migration script `/scripts/migrate-to-aws.sh`
  - [ ] 1.2 Configure Xata connection string
  - [ ] 1.3 Run `pg_dump` with custom format (-Fc)
  - [ ] 1.4 Transfer dump file to AWS EC2
  - [ ] 1.5 Run `pg_restore` on AWS PostgreSQL
  - [ ] 1.6 Handle extensions (PostGIS, pg_cron)

- [ ] **Task 2: Data Integrity Verification** (AC: 3)
  - [ ] 2.1 Create verification script `/scripts/verify-migration.sh`
  - [ ] 2.2 Count rows in all tables (source vs target)
  - [ ] 2.3 Compare checksums for critical tables
  - [ ] 2.4 Verify PostGIS geometry data
  - [ ] 2.5 Generate verification report

- [ ] **Task 3: API Testing** (AC: 4)
  - [ ] 3.1 Run E2E test suite against AWS backend
  - [ ] 3.2 Test zmanim calculations match
  - [ ] 3.3 Test publisher management flows
  - [ ] 3.4 Test admin operations
  - [ ] 3.5 Test authentication (Clerk JWT)
  - [ ] 3.6 Compare response times

- [ ] **Task 4: DNS Cutover Plan** (AC: 5)
  - [ ] 4.1 Document current DNS configuration
  - [ ] 4.2 Create step-by-step cutover procedure
  - [ ] 4.3 Calculate DNS propagation time
  - [ ] 4.4 Identify low-traffic window
  - [ ] 4.5 Prepare monitoring dashboard

- [ ] **Task 5: Rollback Plan** (AC: 6)
  - [ ] 5.1 Document rollback triggers (what failures trigger rollback)
  - [ ] 5.2 Create rollback script (revert DNS)
  - [ ] 5.3 Estimate rollback time
  - [ ] 5.4 Test rollback procedure in staging
  - [ ] 5.5 Document data sync-back if needed

- [ ] **Task 6: Go-Live Execution** (AC: 7)
  - [ ] 6.1 Announce maintenance window
  - [ ] 6.2 Enable Xata read-only mode (if possible)
  - [ ] 6.3 Run final pg_dump from Xata
  - [ ] 6.4 Import to AWS PostgreSQL
  - [ ] 6.5 Verify data integrity
  - [ ] 6.6 Run smoke tests
  - [ ] 6.7 Update DNS to CloudFront
  - [ ] 6.8 Monitor for 30 minutes
  - [ ] 6.9 Confirm go-live success or initiate rollback

- [ ] **Task 7: Post-Migration** (AC: 1-7)
  - [ ] 7.1 Monitor CloudWatch metrics for 24 hours
  - [ ] 7.2 Verify backup runs successfully
  - [ ] 7.3 Update documentation with new endpoints
  - [ ] 7.4 Decommission Xata database (after 7 days)
  - [ ] 7.5 Update .env.example files

## Dev Notes

### Architecture Alignment

This story executes the **actual migration** from:
- **Xata PostgreSQL** → **AWS EC2 PostgreSQL**
- **Vercel** → **S3 + CloudFront**
- **Fly.io API** → **EC2 API**
- **Upstash Redis** → **EC2 Redis**

**Migration Strategy: Big Bang with Safety Net**
- Stop writes to Xata
- Export everything
- Import to AWS
- Verify
- Switch DNS
- Keep Xata running (read-only) for 7 days as rollback

### Migration Timeline

```
T-7 days:   Test migration on staging
T-1 day:    Announce maintenance window
T-0 hour:   Start maintenance window
T+5 min:    Enable Xata read-only
T+10 min:   Run pg_dump
T+20 min:   Transfer to AWS
T+30 min:   Run pg_restore
T+45 min:   Verify data integrity
T+60 min:   Run smoke tests
T+75 min:   Update DNS to CloudFront
T+90 min:   Monitor, confirm success
T+7 days:   Decommission Xata
```

### Migration Script

```bash
#!/bin/bash
# /scripts/migrate-to-aws.sh
set -euo pipefail

XATA_URL="postgresql://xxx:xxx@xxx.xata.sh:5432/zmanim"
AWS_HOST="10.0.1.x"  # EC2 private IP
AWS_PASSWORD=$(aws ssm get-parameter --name /zmanim/prod/postgres-password --with-decryption --query Parameter.Value --output text)

echo "Starting migration at $(date)"

# 1. Export from Xata
echo "Exporting from Xata..."
pg_dump -Fc --no-owner --no-acl "$XATA_URL" > /tmp/zmanim.dump
echo "Export complete: $(ls -lh /tmp/zmanim.dump)"

# 2. Transfer to AWS (if running locally)
# scp /tmp/zmanim.dump ec2-user@$AWS_HOST:/tmp/

# 3. Import to AWS
echo "Importing to AWS PostgreSQL..."
PGPASSWORD=$AWS_PASSWORD pg_restore -h localhost -U zmanim -d zmanim \
  --no-owner --no-acl --clean --if-exists /tmp/zmanim.dump

echo "Migration complete at $(date)"
```

### Verification Script

```bash
#!/bin/bash
# /scripts/verify-migration.sh

XATA_URL="postgresql://xxx:xxx@xxx.xata.sh:5432/zmanim"
AWS_URL="postgresql://zmanim:xxx@localhost/zmanim"

TABLES="publishers publisher_zmanim master_zmanim_registry cities publisher_coverage"

echo "=== Data Verification Report ==="
echo "Generated: $(date)"
echo ""

for table in $TABLES; do
  XATA_COUNT=$(psql "$XATA_URL" -t -c "SELECT COUNT(*) FROM $table")
  AWS_COUNT=$(psql "$AWS_URL" -t -c "SELECT COUNT(*) FROM $table")

  if [ "$XATA_COUNT" -eq "$AWS_COUNT" ]; then
    echo "✅ $table: $AWS_COUNT rows (match)"
  else
    echo "❌ $table: Xata=$XATA_COUNT, AWS=$AWS_COUNT (MISMATCH)"
  fi
done
```

### Cutover Checklist

**Pre-Cutover:**
- [ ] All E2E tests pass on AWS staging
- [ ] Backup verified on AWS
- [ ] Team notified of maintenance window
- [ ] Rollback script tested
- [ ] Monitoring dashboard ready

**During Cutover:**
- [ ] Xata read-only confirmed
- [ ] pg_dump completed
- [ ] pg_restore completed
- [ ] Row counts verified
- [ ] Smoke tests passed
- [ ] DNS updated
- [ ] SSL certificate working

**Post-Cutover:**
- [ ] All endpoints responding
- [ ] No 5xx errors
- [ ] Cache warming (optional)
- [ ] CloudWatch metrics normal
- [ ] Backup job scheduled

### Rollback Triggers

Initiate rollback if ANY of these occur:
1. Data verification fails (row count mismatch)
2. Smoke tests fail (>10% of tests)
3. 5xx error rate >5% after DNS switch
4. API latency >500ms (sustained)
5. Team decision

**Rollback Steps:**
1. Revert DNS to old Vercel/Fly.io endpoints
2. Re-enable Xata writes
3. Investigate AWS issues
4. Plan re-migration

### References

- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Story-7.10]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Story-7.10]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Test-Strategy-Summary]

## Dev Agent Record

### Context Reference

[7-10-data-migration-go-live.context.xml](./7-10-data-migration-go-live.context.xml)

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
