# NUCLEAR CI FIX: 100% GREEN OR BUST

**Mission:** Achieve 100% green checkmarks on ALL GitHub Actions jobs. Zero failures. Zero skipped. No excuses.

---

## SUCCESS DEFINITION (NON-NEGOTIABLE)

This task is **COMPLETE** when and ONLY when:
```bash
gh run list --limit 1 --json conclusion | jq -r '.[0].conclusion'
```
Returns: `success`

**NOTHING ELSE** counts as done. Not "mostly working." Not "pre-existing failures remain." Not "infrastructure limitations."

**SUCCESS** or **CONTINUE ITERATING**.

---

## FORBIDDEN RESPONSES - INSTANT REJECTION

If you catch yourself writing ANY of these, **DELETE IT** and **FIX THE PROBLEM**:

| Forbidden Phrase | Required Action |
|------------------|-----------------|
| "pre-existing failures" | Fix them anyway |
| "unrelated to our changes" | Irrelevant - fix them |
| "requires infrastructure" | Use Fly CLI (see below) |
| "requires external service" | Use Fly CLI or delete test |
| "X failures remain" | Unacceptable - keep going |
| "these failures existed before" | Still your problem |
| "out of scope" | Nothing is out of scope |
| "cannot be fixed without..." | Find a way or delete |
| "known flaky test" | Fix or delete - no middle ground |

---

## INFRASTRUCTURE ACCESS (NO EXCUSES)

**CRITICAL:** Tests that "require infrastructure" are NOT blocked. You have FULL access to all infrastructure via Fly CLI and local environment variables.

### Getting Environment Variables (The Key to Everything)
```bash
# LOCAL: Load all env vars for local development
source api/.env

# LOCAL: See what's available
cat api/.env

# PRODUCTION: List all secrets/env vars on Fly
fly secrets list -a zmanim-api

# PRODUCTION: Get actual values of env vars
fly ssh console -a zmanim-api -C "printenv"
fly ssh console -a zmanim-api -C "printenv | grep DATABASE"
fly ssh console -a zmanim-api -C "printenv | grep REDIS"
fly ssh console -a zmanim-api -C "printenv | grep CLERK"
fly ssh console -a zmanim-api -C "printenv | grep SMTP"
```

### Using Infrastructure Once You Have Env Vars
```bash
# Database (use DATABASE_URL from env)
source api/.env && psql "$DATABASE_URL"
source api/.env && psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM publishers;"

# Redis (use REDIS_URL from env)
source api/.env && redis-cli -u "$REDIS_URL" ping

# API (local)
curl -s http://localhost:8080/health
curl -s http://localhost:8080/api/v1/publishers

# Web (local)
curl -s http://localhost:3001

# Email/SMTP - check env vars for SMTP_HOST, SMTP_USER, etc.
source api/.env && echo "SMTP: $SMTP_HOST"
```

### Clerk CLI (Authentication)
```bash
# List users
clerk users list

# Get user details
clerk users get user_xxx

# List sessions
clerk sessions list

# Get JWT templates
clerk jwt-templates list

# Create test tokens for API testing
clerk tokens create --user user_xxx
```

**Use Clerk CLI for any auth-related test issues** - creating test users, getting tokens, debugging session problems.

### GitHub CLI (CI/CD & Secrets)
```bash
# List repository secrets (what CI has access to)
gh secret list

# View recent workflow runs
gh run list --limit 5

# Watch a running workflow
gh run watch

# Get failed run logs
gh run view <run_id> --log-failed

# Download full logs
gh run view <run_id> --log

# Re-run failed jobs
gh run rerun <run_id> --failed

# View workflow file
gh workflow view pr-e2e.yml

# Check PR status
gh pr status
gh pr checks
```

**Use GitHub CLI to monitor CI, get failure logs, and understand what secrets are available in the CI environment.**

### Environment Variable Fallback Chain
**If a test needs an env var, check these sources IN ORDER:**

| Priority | Source | Command | When to Use |
|----------|--------|---------|-------------|
| 1 | Local `.env` | `source api/.env && echo "$VAR_NAME"` | Local development |
| 2 | GitHub Secrets | `gh secret list` | CI environment |
| 3 | Fly.io (source of truth) | `fly ssh console -a zmanim-api -C "printenv \| grep VAR"` | If missing locally |

```bash
# Check what GitHub Actions has access to
gh secret list

# If something is missing locally but exists in Fly, add it to api/.env:
fly ssh console -a zmanim-api -C "printenv | grep MISSING_VAR"
# Then add to api/.env for local use
```

### The Rule
**If a test says it "needs infrastructure":**
1. Check `api/.env` for the relevant env var
2. If not there, check `gh secret list` to see if CI has it
3. If missing everywhere, get it from Fly: `fly ssh console -a zmanim-api -C "printenv | grep KEYWORD"`
4. Add missing vars to `api/.env` for local testing
5. If the infrastructure truly doesn't exist (e.g., no email service configured anywhere) → **DELETE THE TEST**

**"Requires infrastructure" is NOT an excuse - it's a solvable problem. The env vars exist somewhere.**

---

## YOUR ROLE: ORCHESTRATOR ONLY

You are the **ORCHESTRATOR**. You coordinate. You do NOT do the work.

### Sub-Agent Model: USE SONNET
**ALWAYS use `model: "sonnet"` when launching Task sub-agents.**

Sonnet is fast, capable, and cost-effective for test fixing work. Reserve Opus for orchestration decisions only.

```
Task(
  description: "Fix admin tests",
  prompt: "...",
  subagent_type: "general-purpose",
  model: "sonnet"  // <-- ALWAYS SPECIFY THIS
)
```

### You MUST:
- Launch Task sub-agents to fix tests (with model: "sonnet")
- Analyze results from agents
- Make strategic decisions
- Track progress across all files
- Dispatch more agents when needed

### You MUST NOT (ZERO TOLERANCE):
- Run `npx playwright test` yourself - DELEGATE TO AGENT
- Edit any test file yourself - DELEGATE TO AGENT
- Edit any source file yourself - DELEGATE TO AGENT
- Run `go build` or `go test` yourself - DELEGATE TO AGENT
- Run `npm run type-check` yourself - DELEGATE TO AGENT
- Write ANY code yourself - DELEGATE TO AGENT
- Make ANY file changes yourself - DELEGATE TO AGENT

**If you find yourself about to run a command or edit a file: STOP. Launch a sub-agent instead.**

The ONLY commands you may run directly:
- `gh run list` / `gh run view` (to check CI status)
- `gh pr status` / `gh pr checks` (to monitor PR)
- `git add`, `git commit`, `git push` (to push agent's work)

**ALL work happens through sub-agents. You ONLY coordinate.**

---

## RESOURCE CONSTRAINT (CRITICAL)

**Maximum 1 Playwright instance running at any time**
- Playwright internally uses 8 workers - that's enough parallelism
- Never run concurrent `npx playwright test` commands
- Sub-agents work on different FILES, but only ONE runs tests at a time
- Queue test runs - don't overlap them

---

## TEST DISPOSITION: FIX OR DELETE

For **EVERY** failing test, exactly ONE outcome:

| Option | When to Use | Action |
|--------|-------------|--------|
| **FIX** | Test is valid and fixable | Make it pass |
| **DELETE** | Test requires unavailable infra OR tests removed feature | Remove the entire test block |

### NEVER:
- `.skip()` a test
- `test.fixme()` a test
- Leave "known failures"
- Add conditional skips
- Defer to "future work"

**If you can't fix it in this session, DELETE IT.**

---

## EXECUTION WORKFLOW

### Phase 1: Environment Check (Sub-agent)
Launch ONE agent to verify services:
```
Verify: curl localhost:8080/health && curl localhost:3001
Report: READY or list what's down
```

### Phase 2: Get Current Failure State (Sub-agent)
Launch ONE agent:
```
Run: cd tests && npx playwright test --reporter=list 2>&1 | tail -100
Report:
- Total tests
- Passed count
- Failed count
- Failed file:test list
```

### Phase 3: Parallel File Fixes (Multiple Sub-agents)
Group failures by file. Launch parallel agents (one per file):

**Agent prompt template:**
```
FILE: tests/e2e/{path}/{filename}.spec.ts

1. Read the entire test file
2. Run ONLY this file: npx playwright test {filepath} --reporter=list
3. For EACH failure:
   - Analyze the error
   - Fix the test OR delete it (no skipping)
4. Re-run until 100% pass for this file
5. Report: "{filename}: X tests, 100% pass" OR list remaining issues

FORBIDDEN: Using .skip(), leaving failures, making excuses
```

**Launch 5-8 file agents in parallel** (they edit different files, only one runs playwright at a time via natural sequencing)

### Phase 4: Collect Results
Wait for all file agents. Tally:
```
tests/e2e/admin/publishers.spec.ts: 19/19 PASS
tests/e2e/publisher/algorithm.spec.ts: 12/12 PASS
tests/e2e/user/zmanim.spec.ts: FAILED - 3 remaining
```

For any file still failing: **Re-dispatch agent** with specific failure context.

### Phase 5: Full Local Verification (Sub-agent)
Only when ALL files report 100%:
```
Run: cd tests && npx playwright test --reporter=list
Expected: 0 failures, 0 skipped
```

If failures appear (cross-file issues): dispatch targeted fix agents.

### Phase 6: CI Checks (Parallel Sub-agents)
Before pushing, verify ALL CI checks locally:

| Agent | Command | Must Pass |
|-------|---------|-----------|
| TypeCheck | `cd web && npm run type-check` | Zero errors |
| GoBuild | `cd api && go build ./cmd/api` | Zero errors |
| GoTest | `cd api && go test ./...` | Zero failures |
| SQLc | `cd api && sqlc generate` | Zero errors |
| Lint | `cd web && npm run lint` | Zero errors |

**ALL must pass before pushing.**

### Phase 7: Push and Monitor (Sub-agent)
```bash
git add -A
git commit -m "fix(e2e): achieve 100% test pass rate

- Fixed failing tests across all spec files
- Deleted tests requiring unavailable infrastructure
- All local CI checks passing"
git push
```

Then monitor:
```bash
gh run watch
```

### Phase 8: GitHub Failure Response
If GitHub fails after push:

1. Get failure details:
```bash
gh run view --log-failed | head -200
```

2. Identify failure category:
   - E2E test failure → dispatch file fix agent
   - Go test failure → dispatch Go fix agent
   - Type error → dispatch TypeScript fix agent
   - Build failure → dispatch build fix agent

3. Fix locally, re-verify, push again

4. **REPEAT until green**

---

## THE LOOP (MANDATORY)

```
WHILE true:
    status = $(gh run list --limit 1 --json conclusion | jq -r '.[0].conclusion')

    IF status == "success":
        PRINT "MISSION COMPLETE: 100% GREEN ACHIEVED"
        EXIT

    IF status == "failure" OR status == "":
        failures = get_current_failures()
        agents = dispatch_fix_agents(failures)
        wait_for_agents(agents)
        run_local_verification()
        IF local_passes:
            push_and_monitor()
        CONTINUE
```

**There is NO exit except SUCCESS.**

---

## SUB-AGENT FILE ASSIGNMENTS

Launch these agents in parallel for initial fix wave. **ALL agents use model: "sonnet"**

| Agent | Model | Files | Focus |
|-------|-------|-------|-------|
| 1 | sonnet | `admin/*.spec.ts`, `admin.spec.ts`, `admin-auth.spec.ts` | Admin flows |
| 2 | sonnet | `publisher/algorithm*.spec.ts`, `algorithm-editor.spec.ts` | Algorithm tests |
| 3 | sonnet | `publisher/registry*.spec.ts` | Registry tests |
| 4 | sonnet | `publisher/coverage.spec.ts`, `publisher/dashboard.spec.ts`, `publisher/profile.spec.ts` | Publisher management |
| 5 | sonnet | `publisher/team.spec.ts`, `publisher/analytics.spec.ts`, `publisher/pdf-report.spec.ts` | Publisher features |
| 6 | sonnet | `auth/*.spec.ts`, `auth.spec.ts`, `demo/auth*.spec.ts`, `registration/*.spec.ts` | Authentication |
| 7 | sonnet | `user/*.spec.ts`, `search/*.spec.ts`, `public/*.spec.ts`, `home.spec.ts` | User-facing |
| 8 | sonnet | `errors/*.spec.ts`, `accessibility/*.spec.ts`, `email/*.spec.ts`, `performance/*.spec.ts` | Edge cases |

---

## TRACKING TEMPLATE

Maintain this status mentally:

```
== NUCLEAR CI FIX STATUS ==

Local E2E: ___/___  (X passed / Y total)
Local CI Checks:
  - TypeScript: PASS/FAIL
  - Go Build: PASS/FAIL
  - Go Test: PASS/FAIL
  - SQLc: PASS/FAIL
  - Lint: PASS/FAIL

GitHub Status: PENDING/SUCCESS/FAILURE
Last Push: [timestamp]
Iteration: #N

Files 100%: [list]
Files Remaining: [list]
```

---

## FINAL REMINDER

**You are not done until GitHub shows green.**

- Not when local passes
- Not when "most" tests pass
- Not when you've "done your best"
- Not when failures are "pre-existing"

**GREEN CHECKMARKS OR KEEP ITERATING.**

---

## GO.

Start with Phase 1. Launch sub-agents. Iterate until victory.
