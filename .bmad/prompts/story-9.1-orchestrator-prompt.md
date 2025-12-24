# Story 9.1 Implementation Orchestrator - Parallel Agent Execution

**CRITICAL: This prompt is for a DEV AGENT running in ORCHESTRATOR ROLE**

You will coordinate **parallel sub-agents (all using sonnet model)** to implement the Simplified 2-Path Authentication Pattern and fix the production API at https://zmanim.shtetl.io.

---

## MISSION CRITICAL CONTEXT

### Current Production State (BROKEN)
- **EC2 Instance:** `i-0773b7ea04307ff93` (running, IP: 52.19.240.40)
- **Service Status:** zmanim-api is RUNNING but bound to `127.0.0.1:8080` (localhost only!)
- **API Gateway:** Configured for `/api/v1/public/*` and `/api/v1/auth/*` patterns
- **Backend Routes:** Using `/api/v1/*`, `/api/v1/publisher/*`, `/api/v1/admin/*`, `/api/v1/auth/*`
- **Result:** 503 Service Unavailable on all endpoints

### Target Pattern (User Approved)
```
/api/v1/*           → Public routes (no auth or optional auth)
/api/v1/auth/*      → Unified authenticated routes (JWT required)
/api/v1/publisher/* → Publisher protected routes (publisher role required)
/api/v1/admin/*     → Admin routes (admin role required)
```

### What Needs to Happen
1. **Fix API Binding** - Change from `127.0.0.1:8080` to `0.0.0.0:8080`
2. **Update API Gateway** - Align routes with the target pattern (dual-track: AWS CLI immediate + CDK for persistence)
3. **Restart Service** - Restart zmanim-api on EC2
4. **Verify Production** - Confirm https://zmanim.shtetl.io works
5. **Commit & Deploy** - Push changes, wait for GH Actions, verify again
6. **Update Tests** - Ensure all tests pass

---

## DUAL-TRACK STRATEGY (CRITICAL)

**For every infrastructure change:**
1. **Track A (Speed):** Make immediate changes via AWS CLI for instant production fix
2. **Track B (Persistence):** Update CDK/CDKTF files IN PARALLEL to match AWS CLI changes exactly
3. **Track C (Verification):** After commit + GH Actions deploy, verify CDK state matches AWS state (no drift)

This ensures:
- Production is fixed immediately (not waiting for CI/CD)
- Infrastructure-as-code stays in sync
- No manual changes are "lost" or cause drift

---

## ORCHESTRATION PHASES

### Phase 1: Parallel Investigation (3 Sonnet Agents)

Launch these agents **IN PARALLEL**:

#### Agent 1: Backend Config Analysis (sonnet)
```
TASK: Find and fix the API server binding configuration

1. Read api/cmd/api/main.go - find where the server starts/listens
2. Read api/internal/config/config.go - find HOST/PORT configuration
3. Look for "127.0.0.1" or localhost binding
4. The fix: bind to "0.0.0.0:8080" or use HOST env var defaulting to "0.0.0.0"
5. Check .env.example and any production config for HOST setting

DELIVERABLE:
- File path and line number of the binding
- Current value
- Required change (exact code diff)
- Any env var that controls this
```

#### Agent 2: CDK Current State Analysis (sonnet)
```
TASK: Analyze current CDK API Gateway configuration and prepare fixes

Read: infrastructure/lib/stacks/zmanim-prod.ts (lines 726-800)

CURRENT STATE (problematic):
- Route: ANY /api/v1/public/{proxy+} → No auth
- Route: ANY /api/v1/auth/{proxy+} → JWT auth
- Health: GET /api/v1/health → No auth

TARGET STATE (align to backend):
- Route: GET /api/v1/health → No auth (keep as-is)
- Route: ANY /api/v1/{proxy+} → No auth (public catch-all, LOWEST priority)
- Route: ANY /api/v1/auth/{proxy+} → JWT auth
- Route: ANY /api/v1/publisher/{proxy+} → JWT auth
- Route: ANY /api/v1/admin/{proxy+} → JWT auth

IMPORTANT: API Gateway evaluates routes in order of specificity. More specific routes (/publisher/*, /admin/*, /auth/*) must be defined, then catch-all (/*) last.

DELIVERABLE:
- Current route definitions (copy exact code)
- New route definitions (exact TypeScript code to replace)
- Integration URI patterns for each route
```

#### Agent 3: AWS API Gateway Current State (sonnet)
```
TASK: Get current API Gateway state from AWS for comparison

Run these AWS CLI commands:

# Get API Gateway ID
aws apigatewayv2 get-apis --query 'Items[?Name==`zmanim-api-prod`].ApiId' --output text

# Get all routes (use the API ID from above)
aws apigatewayv2 get-routes --api-id <API_ID> --query 'Items[*].[RouteKey,AuthorizationType,Target]' --output table

# Get all integrations
aws apigatewayv2 get-integrations --api-id <API_ID> --query 'Items[*].[IntegrationId,IntegrationType,IntegrationUri]' --output table

DELIVERABLE:
- API Gateway ID
- Current routes table
- Current integrations table
- Note any discrepancies with CDK state
```

---

### Phase 2: Parallel Fix Implementation (Dual-Track)

After Phase 1 completes, launch these **IN PARALLEL**:

#### Agent 4: AWS CLI Immediate Fixes (sonnet)
```
TASK: Apply immediate fixes via AWS CLI (production speed track)

STEP 1: Fix API Server Binding on EC2
aws ssm send-command \
  --instance-ids i-0773b7ea04307ff93 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "grep -r \"127.0.0.1\" /opt/zmanim/ /etc/systemd/system/zmanim* 2>/dev/null || echo No hardcoded localhost found",
    "cat /opt/zmanim/.env | grep -i host || echo No HOST in env",
    "echo HOST=0.0.0.0 >> /opt/zmanim/.env",
    "sudo systemctl restart zmanim-api",
    "sleep 5",
    "ss -tlnp | grep 8080",
    "curl -s http://localhost:8080/health"
  ]'

Wait for completion, verify binding changed to 0.0.0.0:8080

STEP 2: Update API Gateway Routes via AWS CLI
Use API ID from Phase 1 Agent 3.

# Delete the problematic /api/v1/public/* route
aws apigatewayv2 delete-route --api-id <API_ID> --route-id <ROUTE_ID_FOR_PUBLIC>

# Create new routes matching target pattern:
# 1. /api/v1/publisher/* with JWT auth
# 2. /api/v1/admin/* with JWT auth
# 3. /api/v1/auth/* with JWT auth (may already exist)
# 4. /api/v1/* catch-all without auth (replaces /public/*)

For each new route:
aws apigatewayv2 create-route \
  --api-id <API_ID> \
  --route-key "ANY /api/v1/publisher/{proxy+}" \
  --authorization-type JWT \
  --authorizer-id <CLERK_AUTHORIZER_ID> \
  --target integrations/<INTEGRATION_ID>

STEP 3: Verify immediately
curl -s https://zmanim.shtetl.io/api/v1/health
curl -s https://zmanim.shtetl.io/api/v1/publishers | head -c 200

DELIVERABLE:
- Each AWS CLI command executed and its output
- Final verification results
- List of exact changes made (for CDK sync)
```

#### Agent 5: CDK Code Updates (sonnet)
```
TASK: Update CDK/CDKTF code to match AWS CLI changes (persistence track)

Based on Agent 2's analysis, update infrastructure/lib/stacks/zmanim-prod.ts:

1. Remove/replace the /api/v1/public/* route definition
2. Add routes for:
   - ANY /api/v1/publisher/{proxy+} → JWT auth, integration to EC2:8080/api/v1/publisher/{proxy}
   - ANY /api/v1/admin/{proxy+} → JWT auth, integration to EC2:8080/api/v1/admin/{proxy}
   - ANY /api/v1/auth/{proxy+} → JWT auth (keep if exists)
   - ANY /api/v1/{proxy+} → No auth, integration to EC2:8080/api/v1/{proxy} (catch-all)

3. Ensure integration URIs match the backend routes exactly

4. Build and validate:
   cd infrastructure && npm run build

DELIVERABLE:
- Exact file changes made (git diff)
- Build output (success/failure)
```

#### Agent 6: Backend Code Fix (sonnet)
```
TASK: Fix the API binding in source code

Based on Agent 1's findings, edit the appropriate file(s):

If in main.go:
- Change "127.0.0.1:8080" to "0.0.0.0:8080" OR
- Use os.Getenv("HOST") with default "0.0.0.0"

If in config:
- Update default HOST value
- Ensure production config uses 0.0.0.0

Build and verify:
cd api && go build ./cmd/api

DELIVERABLE:
- Exact file changes (git diff)
- Build output (success/failure)
```

---

### Phase 3: Commit, Push, Wait for GH Actions

**This phase is SEQUENTIAL:**

#### Step 3.1: Stage and Commit All Changes
```bash
git add -A
git status

git commit -m "fix(infra): align API Gateway routes with backend pattern + fix binding

BREAKING: API Gateway route pattern changed from /public/* to direct routes

Changes:
- Backend: API server now binds to 0.0.0.0:8080 (was 127.0.0.1)
- CDK: Updated API Gateway routes to match backend:
  - /api/v1/publisher/* → JWT auth
  - /api/v1/admin/* → JWT auth
  - /api/v1/auth/* → JWT auth
  - /api/v1/* → No auth (public catch-all)
- Removed: /api/v1/public/* route (consolidated into /api/v1/*)

Manual AWS CLI changes applied for immediate fix, CDK updated to match.

Fixes: Story 9.1 - API Gateway Path Configuration
Closes: #<issue_number_if_any>"
```

#### Step 3.2: Push and Monitor GH Actions
```bash
git push origin main

# Monitor GH Actions
gh run list --limit 5
gh run watch  # Watch the triggered run
```

#### Step 3.3: Wait for Deployment
```
Poll GH Actions status every 30 seconds until:
- Status is "completed" AND conclusion is "success"
OR
- Status is "completed" AND conclusion is "failure" (report and stop)

Timeout: 20 minutes
```

---

### Phase 4: Post-Deployment Verification (2 Parallel Agents)

#### Agent 7: Production API Verification (sonnet)
```
TASK: Comprehensive production endpoint testing

Test against https://zmanim.shtetl.io:

PUBLIC ENDPOINTS (expect 200):
curl -s -w "\n%{http_code}" https://zmanim.shtetl.io/api/v1/health
curl -s -w "\n%{http_code}" https://zmanim.shtetl.io/api/v1/publishers
curl -s -w "\n%{http_code}" https://zmanim.shtetl.io/api/v1/countries
curl -s -w "\n%{http_code}" https://zmanim.shtetl.io/api/v1/registry/zmanim
curl -s -w "\n%{http_code}" https://zmanim.shtetl.io/api/v1/localities/search?q=new+york

PROTECTED ENDPOINTS (expect 401 without auth):
curl -s -w "\n%{http_code}" https://zmanim.shtetl.io/api/v1/publisher/profile
curl -s -w "\n%{http_code}" https://zmanim.shtetl.io/api/v1/admin/stats
curl -s -w "\n%{http_code}" https://zmanim.shtetl.io/api/v1/auth/correction-requests

DELIVERABLE:
| Endpoint | Expected | Actual | Status |
|----------|----------|--------|--------|
| ...      | ...      | ...    | PASS/FAIL |
```

#### Agent 8: CDK Drift Detection (sonnet)
```
TASK: Verify no infrastructure drift between AWS and CDK

1. Run CDK diff:
   cd infrastructure && npx cdktf diff zmanim-prod

2. The diff should show NO CHANGES if CDK matches AWS state

3. If diff shows changes:
   - Document what's different
   - These are drift issues that need resolution
   - May need to adjust CDK code to match actual AWS state

4. Get current AWS API Gateway state again:
   aws apigatewayv2 get-routes --api-id <API_ID> --output table

5. Compare with CDK expected state

DELIVERABLE:
- CDK diff output
- AWS current state
- Drift assessment: CLEAN or DRIFT_DETECTED with details
```

---

### Phase 5: Test Suite Verification

#### Agent 9: Full Test Suite (sonnet)
```
TASK: Run all tests to ensure nothing broke

# Backend tests
cd api && go test ./... -v 2>&1 | tee /tmp/go-test-output.txt
echo "Exit code: $?"

# Frontend type check
cd web && npm run type-check 2>&1 | tee /tmp/typecheck-output.txt
echo "Exit code: $?"

# Frontend build
cd web && npm run build 2>&1 | tee /tmp/build-output.txt
echo "Exit code: $?"

# E2E tests (if available)
cd tests && npx playwright test --reporter=list 2>&1 | tee /tmp/e2e-output.txt || echo "E2E skipped or failed"

DELIVERABLE:
- Go tests: PASS/FAIL (X passed, Y failed)
- Type check: PASS/FAIL
- Build: PASS/FAIL
- E2E: PASS/FAIL/SKIPPED
- Any failure details
```

---

## AWS CLI REFERENCE

### EC2 Instance
```bash
INSTANCE_ID="i-0773b7ea04307ff93"
```

### SSM Command Execution
```bash
# Send command
COMMAND_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"$CMD\"]" \
  --query 'Command.CommandId' --output text)

# Get output (wait a few seconds first)
aws ssm get-command-invocation \
  --command-id $COMMAND_ID \
  --instance-id $INSTANCE_ID \
  --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
```

### API Gateway
```bash
# Get API ID
API_ID=$(aws apigatewayv2 get-apis --query 'Items[?Name==`zmanim-api-prod`].ApiId' --output text)

# Get authorizer ID
AUTH_ID=$(aws apigatewayv2 get-authorizers --api-id $API_ID --query 'Items[?Name==`clerk-jwt`].AuthorizerId' --output text)

# List routes
aws apigatewayv2 get-routes --api-id $API_ID --output table

# List integrations
aws apigatewayv2 get-integrations --api-id $API_ID --output table

# Create route with JWT auth
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "ANY /api/v1/publisher/{proxy+}" \
  --authorization-type JWT \
  --authorizer-id $AUTH_ID \
  --target integrations/$INTEGRATION_ID

# Create route without auth
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key "ANY /api/v1/{proxy+}" \
  --target integrations/$INTEGRATION_ID

# Delete route
aws apigatewayv2 delete-route --api-id $API_ID --route-id $ROUTE_ID
```

---

## EXECUTION CHECKLIST

### Phase 1: Investigation ⬜
- [ ] Agent 1: Backend config analysis complete
- [ ] Agent 2: CDK analysis complete
- [ ] Agent 3: AWS current state captured

### Phase 2: Dual-Track Implementation ⬜
- [ ] Agent 4: AWS CLI fixes applied, verified working
- [ ] Agent 5: CDK code updated, builds successfully
- [ ] Agent 6: Backend code fixed, builds successfully

### Phase 3: Commit & Deploy ⬜
- [ ] All changes committed
- [ ] Pushed to main
- [ ] GH Actions triggered
- [ ] GH Actions completed successfully

### Phase 4: Verification ⬜
- [ ] Agent 7: All endpoints verified
- [ ] Agent 8: No CDK drift detected

### Phase 5: Tests ⬜
- [ ] Agent 9: All tests pass

---

## SUCCESS CRITERIA

**Production is fixed when ALL of these pass:**

1. ✅ `curl https://zmanim.shtetl.io/api/v1/health` → 200 + JSON
2. ✅ `curl https://zmanim.shtetl.io/api/v1/publishers` → 200 + data
3. ✅ `curl https://zmanim.shtetl.io/api/v1/publisher/profile` → 401
4. ✅ `curl https://zmanim.shtetl.io/api/v1/admin/stats` → 401
5. ✅ `npx cdktf diff zmanim-prod` → No changes (no drift)
6. ✅ `go test ./...` → All pass
7. ✅ `npm run type-check && npm run build` → Success
8. ✅ GH Actions deployment completed successfully

---

## FAILURE HANDLING

If any phase fails:
1. **STOP** further execution
2. **REPORT** the exact failure with logs
3. **ROLLBACK** AWS CLI changes if needed:
   - Restore previous API Gateway routes
   - Restart service with previous config
4. **DO NOT** push broken code to main

---

## BEGIN ORCHESTRATION

**START NOW:**

1. Launch Phase 1 agents (3 agents in parallel)
2. Wait for all Phase 1 agents to complete
3. Analyze findings and proceed to Phase 2
4. Report progress after each phase

Use `Task` tool with `model: "sonnet"` for all sub-agents.

**GO!**
