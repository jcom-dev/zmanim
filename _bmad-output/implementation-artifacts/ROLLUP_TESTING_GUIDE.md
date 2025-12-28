# Rollup Scheduler - Quick Testing Guide

## Verification Commands

### 1. Check Rollup Service Started
```bash
tail -50 /home/daniel/repos/zmanim/logs/api.log | grep -i rollup
```

Expected output:
```
INFO rollup scheduler started interval_hours=1 debounce_seconds=5
Rollup scheduler initialized (interval: 1 hours)
INFO starting calculation stats rollup
INFO rollup completed successfully duration_ms=X dates_processed=2
```

### 2. Health Check Endpoint
```bash
curl http://localhost:8080/health/rollup | jq '.'
```

Expected response:
```json
{
  "data": {
    "healthy": true,
    "last_run": "2025-12-28T13:39:16Z",
    "running": false,
    "status": "ok"
  },
  "meta": {
    "timestamp": "2025-12-28T...",
    "request_id": "shtetl/..."
  }
}
```

### 3. Manual Trigger (Test Endpoint)
```bash
curl -X POST http://localhost:8080/internal/rollup/trigger | jq '.'
```

Expected response:
```json
{
  "data": {
    "message": "Rollup executed successfully",
    "request_id": "",
    "status": "triggered"
  },
  "meta": {
    "timestamp": "2025-12-28T...",
    "request_id": "shtetl/..."
  }
}
```

### 4. Verify Database Tables Exist
```bash
source api/.env && psql "$DATABASE_URL" -c "
  SELECT
    (SELECT COUNT(*) FROM calculation_logs) as logs_count,
    (SELECT COUNT(*) FROM calculation_stats_daily) as stats_count;
"
```

Expected (with no calculations yet):
```
 logs_count | stats_count
------------+-------------
          0 |           0
```

### 5. Test Security Gate (Disabled State)
```bash
# In api/.env, change to: ENABLE_TEST_ENDPOINTS=false
# Then restart: ./restart.sh

curl -X POST http://localhost:8080/internal/rollup/trigger | jq '.'
```

Expected response (when disabled):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Test endpoints are disabled"
  }
}
```

## End-to-End Test (After Agent 1 & 3 Complete)

### Create Test Calculation Log
```bash
source api/.env && psql "$DATABASE_URL" << EOF
INSERT INTO calculation_logs
  (publisher_id, locality_id, date_calculated, cache_hit, response_time_ms, zman_count, source)
VALUES
  (1, 4993250, CURRENT_DATE, false, 150, 10, 1);
EOF
```

### Trigger Rollup
```bash
curl -X POST http://localhost:8080/internal/rollup/trigger
```

### Verify Stats Were Aggregated
```bash
source api/.env && psql "$DATABASE_URL" -c "
  SELECT * FROM calculation_stats_daily
  WHERE publisher_id = 1
  ORDER BY date DESC
  LIMIT 1;
"
```

Expected:
```
 id | publisher_id |    date    | total_calculations | cache_hits | total_response_time_ms | source_web | source_api | source_external | created_at
----+--------------+------------+--------------------+------------+------------------------+------------+------------+-----------------+------------
  1 |            1 | 2025-12-28 |                  1 |          0 |                    150 |          1 |          0 |               0 | ...
```

## Troubleshooting

### Rollup Scheduler Not Starting
**Symptom**: No "rollup scheduler started" in logs
**Check**:
```bash
cd api && go build ./cmd/api
# Look for compilation errors
```

**Solution**: Fix any build errors, restart services

### Rollup Executing But No Stats
**Symptom**: "rollup completed successfully" but stats table empty
**Check**:
```bash
source api/.env && psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM calculation_logs;"
```

**Solution**: This is expected if no calculations have been made yet. Wait for Agent 1 & 3 to complete.

### Test Endpoint Returns 403
**Symptom**: Manual trigger returns "Test endpoints are disabled"
**Check**:
```bash
grep ENABLE_TEST_ENDPOINTS api/.env
```

**Solution**: Set `ENABLE_TEST_ENDPOINTS=true` in api/.env and restart

### Health Endpoint Shows "unhealthy"
**Symptom**: `/health/rollup` returns `"healthy": false`
**Check**: Look at `last_run` timestamp
```bash
curl -s http://localhost:8080/health/rollup | jq '.data.last_run'
```

**Solution**: If last_run is > 2 hours ago, check logs for errors. Trigger manual rollup to reset.

## Configuration Reference

### Environment Variables
```bash
# In api/.env

# Rollup interval in hours (default: 1)
ROLLUP_INTERVAL_HOURS=1

# Enable test endpoints (default: false)
# CRITICAL: Set to false in production
ENABLE_TEST_ENDPOINTS=true
```

### Routes
- `GET /health/rollup` - Health check (public)
- `POST /internal/rollup/trigger` - Manual trigger (gated by ENABLE_TEST_ENDPOINTS)

### Service Lifecycle
```
Startup:
  1. NewRollupScheduler(queries, intervalHours)
  2. Start(ctx) - launches background worker
  3. Immediate rollup on startup
  4. Hourly ticker for scheduled rollups

Shutdown:
  1. Stop() - signals worker to stop
  2. Waits for current rollup to complete
  3. Cancels pending debounce timers
```

## Quick Debug Commands

### View Live Logs
```bash
tail -f /home/daniel/repos/zmanim/logs/api.log | grep -i rollup
```

### Check Service Status
```bash
curl -s http://localhost:8080/health/rollup | jq '{status: .data.status, healthy: .data.healthy, last_run: .data.last_run}'
```

### Verify Tables Exist
```bash
source api/.env && psql "$DATABASE_URL" -c "\dt calculation*"
```

Expected:
```
                  List of relations
 Schema |          Name              | Type  |  Owner
--------+----------------------------+-------+----------
 public | calculation_logs           | table | postgres
 public | calculation_stats_daily    | table | postgres
```

## Success Criteria Checklist

- [ ] Rollup scheduler starts on API startup
- [ ] Health check endpoint returns status
- [ ] Manual trigger executes rollup successfully
- [ ] No errors in API logs
- [ ] Build completes without errors
- [ ] Security gate blocks trigger when ENABLE_TEST_ENDPOINTS=false

---

**Status**: All criteria met ✅
**Last Verified**: 2025-12-28
**Next Steps**: Wait for Agent 1 (Database Migration) and Agent 3 (API Logging)
