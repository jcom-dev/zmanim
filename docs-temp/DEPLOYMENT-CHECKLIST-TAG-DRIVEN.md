# Tag-Driven Architecture - Deployment Checklist

**Migration**: Eliminate Hardcoded Event Logic
**Date**: 2025-12-24
**Status**: READY FOR PRODUCTION

---

## Pre-Deployment

### 1. Code Review

- [ ] All migration files reviewed and tested
- [ ] No hardcoded event logic in code (run validation script)
- [ ] Test coverage >= 85% for calendar package
- [ ] All CI checks passing
- [ ] No TODO/FIXME comments in committed code

```bash
./scripts/validate-no-hardcoded-logic.sh
./scripts/validate-hebcal-coverage.sh
./scripts/validate-ci-checks.sh
cd api && go test ./internal/calendar/... -cover
```

### 2. Database Preparation

- [ ] Backup production database
- [ ] Test migrations on staging database
- [ ] Verify rollback plan (if needed)
- [ ] Check for table locks during migration
- [ ] Estimate migration duration

```bash
# Backup production
pg_dump $PROD_DATABASE_URL > backup-before-tag-migration-$(date +%Y%m%d).sql

# Test on staging
psql $STAGING_DATABASE_URL < db/migrations/20251224204010_add_missing_hebcal_events.sql
psql $STAGING_DATABASE_URL < db/migrations/20251224210000_sync_hebcal_events.sql
psql $STAGING_DATABASE_URL < db/migrations/20251224220000_add_tag_metadata.sql
psql $STAGING_DATABASE_URL < db/migrations/20251224220001_populate_tag_metadata.sql
psql $STAGING_DATABASE_URL < db/migrations/20251224230000_add_tisha_bav_category_tags.sql

# Verify data
./scripts/verify-hebcal-sync.sh
```

### 3. Testing

- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual smoke tests completed
- [ ] Edge cases tested (see test matrix below)
- [ ] Performance tests (response time < 500ms)

**Test Matrix**:
```
✓ Regular weekday (Tue, Dec 24, 2025)
✓ Erev Shabbos (Fri, Dec 26, 2025)
✓ Shabbos (Sat, Dec 27, 2025)
✓ Fast day (Asara B'Teves, Tue, Jan 7, 2026)
✓ Fast day on Erev Shabbos (edge case)
✓ Chanukah (Dec 25 - Jan 1, 2025)
✓ Yom Tov (Pesach, Shavuos, etc.)
✓ Multiple events same day (Rosh Chodesh Chanukah)
```

### 4. Documentation

- [ ] Architecture docs completed (`docs/architecture/tag-driven-events.md`)
- [ ] Migration guide completed (`docs/migration/eliminate-hardcoded-logic.md`)
- [ ] Quick start guide created (`docs/TAG-QUICK-START.md`)
- [ ] CLAUDE.md updated with tag-driven patterns
- [ ] CHANGELOG.md updated with user-facing changes
- [ ] API documentation updated (Swagger)

### 5. Monitoring Setup

- [ ] Error tracking configured (Sentry/CloudWatch)
- [ ] Performance monitoring enabled
- [ ] Database query monitoring active
- [ ] HebCal API rate limiting checked
- [ ] Alert thresholds configured

---

## Deployment Steps

### Step 1: Database Migration (Staging)

```bash
# Connect to staging database
source api/.env.staging
psql "$DATABASE_URL"

# Run migrations in order
\i db/migrations/20251224204010_add_missing_hebcal_events.sql
\i db/migrations/20251224210000_sync_hebcal_events.sql
\i db/migrations/20251224220000_add_tag_metadata.sql
\i db/migrations/20251224220001_populate_tag_metadata.sql
\i db/migrations/20251224230000_add_tisha_bav_category_tags.sql

# Verify
\dt tag_*
SELECT COUNT(*) FROM tag_event_mappings;  -- Should be ~40-50 rows
SELECT COUNT(*) FROM zman_tags WHERE tag_type_id = 170;  -- Should be ~25-30 event tags
```

**Expected Duration**: 2-3 seconds per migration (very fast, no large data changes)

### Step 2: Deploy Code (Staging)

```bash
# Build and deploy
cd api
go build -o bin/api ./cmd/api

# Deploy to staging server
scp bin/api staging:/opt/zmanim/
ssh staging "sudo systemctl restart zmanim-api"

# Check logs
ssh staging "sudo journalctl -u zmanim-api -f"
```

### Step 3: Smoke Test (Staging)

```bash
# Test public endpoint
curl -s https://staging.zmanim.shtetl.io/api/v1/countries | jq '.'

# Test zmanim endpoint
TOKEN=$(node scripts/get-test-token.js staging)
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  "https://staging.zmanim.shtetl.io/api/v1/publisher/zmanim?locality_id=281184&date=2025-12-26" \
  | jq '.'

# Verify active_event_codes present
# Should show: ["erev_shabbos"] for Dec 26, 2025
```

### Step 4: Validation (Staging)

- [ ] Check `active_event_codes` in API responses
- [ ] Verify zmanim filtering working correctly
- [ ] Test multiple dates with different events
- [ ] Confirm no errors in logs
- [ ] Check response times (< 500ms)

```bash
# Test suite
cd api
go test -v ./internal/calendar/... -run TestEventCoverage
go test -v ./internal/handlers/... -run TestZmanimIntegration

# Validation scripts
./scripts/validate-hebcal-coverage.sh
./scripts/verify-hebcal-sync.sh
```

### Step 5: Production Database Migration

**⚠️ CRITICAL: Backup first!**

```bash
# Backup production database
source api/.env.production
pg_dump "$DATABASE_URL" | gzip > backup-prod-$(date +%Y%m%d-%H%M%S).sql.gz

# Upload backup to S3
aws s3 cp backup-prod-*.sql.gz s3://zmanim-backups/

# Run migrations (FAST - no downtime needed)
psql "$DATABASE_URL" < db/migrations/20251224204010_add_missing_hebcal_events.sql
psql "$DATABASE_URL" < db/migrations/20251224210000_sync_hebcal_events.sql
psql "$DATABASE_URL" < db/migrations/20251224220000_add_tag_metadata.sql
psql "$DATABASE_URL" < db/migrations/20251224220001_populate_tag_metadata.sql
psql "$DATABASE_URL" < db/migrations/20251224230000_add_tisha_bav_category_tags.sql
```

**Expected Duration**: 5-10 seconds total (all migrations are fast, create indexes concurrently)

### Step 6: Deploy Code (Production)

```bash
# Option A: Manual deployment
cd api
go build -o bin/api ./cmd/api
scp bin/api production:/opt/zmanim/
ssh production "sudo systemctl restart zmanim-api"

# Option B: Automated deployment (CDK)
cd infrastructure
npx cdk deploy ZmanimApiStack --require-approval never

# Option C: Git-based deployment
git tag v2.0.0-tag-driven
git push origin v2.0.0-tag-driven
# (Triggers GitHub Actions workflow)
```

### Step 7: Smoke Test (Production)

```bash
# Test public endpoint
curl -s https://zmanim.shtetl.io/api/v1/countries | jq '.'

# Test zmanim endpoint
TOKEN=$(node scripts/get-test-token.js production)
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  "https://zmanim.shtetl.io/api/v1/publisher/zmanim?locality_id=281184&date=$(date +%Y-%m-%d)" \
  | jq '.'

# Check active_event_codes
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  "https://zmanim.shtetl.io/api/v1/publisher/zmanim?locality_id=281184&date=2025-12-26" \
  | jq '.active_event_codes'
```

### Step 8: Monitor Production

**First 15 minutes**:
- [ ] Watch error logs (no new errors)
- [ ] Check response times (< 500ms)
- [ ] Monitor database queries (no slow queries)
- [ ] Verify HebCal API calls succeeding
- [ ] Check cache hit rates

**First 1 hour**:
- [ ] Review error rates (should be 0%)
- [ ] Check user-facing zmanim results
- [ ] Monitor API rate limits
- [ ] Verify tag filtering working
- [ ] Check database connection pool

**First 24 hours**:
- [ ] Daily error report (should be clean)
- [ ] Performance metrics (no degradation)
- [ ] User feedback (no complaints)
- [ ] Data consistency checks
- [ ] Cache performance review

---

## Post-Deployment

### Immediate (Day 1)

- [ ] Verify all publishers' zmanim displaying correctly
- [ ] Check for any unexpected event patterns
- [ ] Monitor HebCal API response times
- [ ] Review error logs for any tag-related issues
- [ ] Confirm no performance degradation

```bash
# Check logs
ssh production "sudo journalctl -u zmanim-api --since '1 hour ago' | grep -i error"

# Check performance
ssh production "sudo journalctl -u zmanim-api --since '1 hour ago' | grep 'response_time' | sort -k5 -n | tail -20"

# Verify event codes being used
ssh production "sudo journalctl -u zmanim-api --since '1 hour ago' | grep 'active_event_codes'"
```

### Week 1

- [ ] Gather publisher feedback
- [ ] Review analytics for any anomalies
- [ ] Check cache hit rates (should be high)
- [ ] Monitor database query performance
- [ ] Document any edge cases discovered

### Week 2

- [ ] Performance optimization review
- [ ] Tag usage analysis
- [ ] Identify any missing event mappings
- [ ] Plan for publisher UI enhancements
- [ ] Document lessons learned

---

## Rollback Plan

### If Critical Issues Found

**⚠️ NOT RECOMMENDED** - Migration is designed to be one-way

**Better approach**: Fix forward with hotfix patch

```sql
-- Example: Add missing event mapping
INSERT INTO tag_event_mappings (tag_id, hebcal_event_pattern, is_pattern)
SELECT id, 'Missing Event Name', false
FROM zman_tags WHERE tag_key = 'missing_event';
```

### Emergency Rollback (Last Resort)

**Only if data corruption or catastrophic failure**

```bash
# Restore from backup
source api/.env.production
gunzip -c backup-prod-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"

# Revert code deployment
git revert <commit-sha>
git push origin main

# Redeploy old version
cd infrastructure
npx cdk deploy ZmanimApiStack
```

**Downside**: Loses all new tag configurations made since deployment

---

## Success Criteria

### Must Pass (Hard Requirements)

- [ ] Zero errors in production logs (first 24 hours)
- [ ] API response times < 500ms (p95)
- [ ] All existing zmanim still displaying correctly
- [ ] HebCal API integration working (100% success rate)
- [ ] Tag filtering working (verified via active_event_codes)

### Should Pass (Soft Requirements)

- [ ] Publisher satisfaction (no complaints)
- [ ] Performance same or better than before
- [ ] Cache hit rate > 80%
- [ ] Database query time < 50ms (p95)
- [ ] No unexpected event patterns

### Nice to Have (Bonus)

- [ ] Response times improved
- [ ] Fewer database queries (better caching)
- [ ] Publishers experimenting with tag customization
- [ ] Positive feedback on flexibility

---

## Validation Queries

### Verify Migration Success

```sql
-- Check all migrations applied
SELECT * FROM schema_migrations
WHERE version IN (
    '20251224204010',
    '20251224210000',
    '20251224220000',
    '20251224220001',
    '20251224230000'
);

-- Count event mappings
SELECT COUNT(*) FROM tag_event_mappings;
-- Expected: 40-50 rows

-- Count event tags
SELECT COUNT(*) FROM zman_tags WHERE tag_type_id = 170;
-- Expected: 25-30 tags

-- Verify key events mapped
SELECT
    zt.tag_key,
    tem.hebcal_event_pattern,
    tem.is_pattern
FROM tag_event_mappings tem
JOIN zman_tags zt ON tem.tag_id = zt.id
WHERE tem.hebcal_event_pattern IN (
    'Erev Shabbos',
    'Shabbos',
    'Chanukah%',
    'Yom Kippur',
    'Erev Pesach'
)
ORDER BY zt.tag_key;
-- Should return 5+ rows

-- Check publisher zmanim have tags
SELECT
    p.name,
    COUNT(DISTINCT pz.id) as zmanim_count,
    COUNT(pzt.id) as tag_count
FROM publishers p
JOIN publisher_zmanim pz ON p.id = pz.publisher_id
LEFT JOIN publisher_zman_tags pzt ON pz.id = pzt.publisher_zman_id
GROUP BY p.id, p.name
ORDER BY p.name;
-- All publishers should have tag_count > 0
```

### Test Event Code Lookup

```sql
-- Test single event
SELECT get_event_codes_for_hebcal_events(ARRAY['Erev Shabbos']);
-- Expected: {erev_shabbos}

-- Test multiple events
SELECT get_event_codes_for_hebcal_events(ARRAY['Erev Shabbos', 'Chanukah: 3 Candles']);
-- Expected: {erev_shabbos,chanukah}

-- Test wildcard matching
SELECT get_event_codes_for_hebcal_events(ARRAY['Chanukah: 8 Candles']);
-- Expected: {chanukah}

-- Test unmapped event (should return empty)
SELECT get_event_codes_for_hebcal_events(ARRAY['Fake Event']);
-- Expected: {}
```

---

## Monitoring Dashboards

### Key Metrics to Watch

**API Performance**:
- Response time (p50, p95, p99)
- Error rate (should be 0%)
- Request volume (should be steady)
- Cache hit rate (target: 80%+)

**Database**:
- Query execution time (target: < 50ms p95)
- Connection pool usage (should be stable)
- Slow query log (should be empty)
- Table sizes (minimal growth)

**HebCal API**:
- Request success rate (target: 100%)
- Response time (external dependency)
- Rate limit status (should be well below limit)
- Cache hit rate for HebCal responses

**Business Metrics**:
- Zmanim requests per day (should be steady)
- Active publishers (should be stable)
- Event coverage (should be 100%)
- Tag utilization (should increase over time)

---

## Communication Plan

### Pre-Deployment Announcement

**To**: Development team
**When**: 24 hours before deployment
**Message**: Tag-driven architecture deployment scheduled for [DATE/TIME]. No downtime expected. Migrations are fast (< 10 seconds). Rollback plan available but not expected to be needed.

### Deployment Notification

**To**: Stakeholders, publishers (beta)
**When**: Immediately after deployment
**Message**: New tag-driven event system deployed successfully. No action required from publishers. New feature: event-specific zmanim now fully configurable via tags.

### Post-Deployment Report

**To**: All stakeholders
**When**: 24 hours after deployment
**Template**:

```
Subject: Tag-Driven Architecture Deployment - Success Report

Deployment completed successfully on [DATE] at [TIME].

Metrics (first 24 hours):
- Error rate: 0%
- Response time: [X]ms (p95)
- HebCal API success rate: 100%
- Tag filtering success rate: 100%

Key achievements:
- All hardcoded event logic eliminated
- 100% HebCal event coverage achieved
- Publishers can now add events via SQL only

Next steps:
- Monitor for one week
- Gather publisher feedback
- Plan UI enhancements for tag management

Full details: [link to TAG-DRIVEN-MIGRATION-COMPLETE.md]
```

---

## Checklist Summary

**Pre-Deployment** (Complete ALL before deploying):
- [ ] Code review passed
- [ ] All tests passing
- [ ] Validation scripts green
- [ ] Documentation complete
- [ ] Database backup created
- [ ] Staging tested successfully

**Deployment** (Execute in order):
- [ ] Staging database migrated
- [ ] Staging code deployed
- [ ] Staging smoke tested
- [ ] Production database backed up
- [ ] Production database migrated
- [ ] Production code deployed
- [ ] Production smoke tested
- [ ] Monitoring active

**Post-Deployment** (Within 24 hours):
- [ ] Error logs reviewed (clean)
- [ ] Performance metrics normal
- [ ] User feedback collected
- [ ] Success report sent
- [ ] Documentation published

---

## Contact

**Questions during deployment?**
- Check `/docs/architecture/tag-driven-events.md` for technical details
- Review `/docs/TAG-QUICK-START.md` for quick debugging
- Run validation scripts: `./scripts/verify-hebcal-sync.sh`

**Emergency issues?**
- Check error logs first: `ssh production "sudo journalctl -u zmanim-api -f"`
- Verify database connectivity
- Check HebCal API status
- Review active_event_codes in API responses

**Rollback needed?**
- Contact lead developer
- Review rollback plan section above
- Restore from backup only if critical

---

## Final Checks

**Before marking deployment complete**:

```bash
# 1. Verify migrations applied
source api/.env.production
psql "$DATABASE_URL" -c "SELECT version FROM schema_migrations WHERE version LIKE '202512242%' ORDER BY version;"

# 2. Test API endpoint
curl -s https://zmanim.shtetl.io/api/v1/publisher/zmanim?locality_id=281184&date=$(date +%Y-%m-%d) -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" | jq '.active_event_codes'

# 3. Check error rate
ssh production "sudo journalctl -u zmanim-api --since '1 hour ago' | grep -c ERROR"
# Should be 0

# 4. Verify performance
ssh production "sudo journalctl -u zmanim-api --since '1 hour ago' | grep 'response_time' | awk '{sum+=$NF; count++} END {print sum/count}'"
# Should be < 500ms

# 5. Run validation
./scripts/verify-hebcal-sync.sh
./scripts/validate-hebcal-coverage.sh
```

**All checks passed?** ✅ DEPLOYMENT COMPLETE

---

**Deployment Status**: [ ] NOT STARTED / [ ] IN PROGRESS / [ ] COMPLETE

**Deployed By**: _______________

**Deployment Date**: _______________

**Deployment Time**: _______________

**Issues Encountered**: _______________

**Resolution**: _______________

**Sign-off**: _______________
