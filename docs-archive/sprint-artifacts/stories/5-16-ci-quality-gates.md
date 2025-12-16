# Story 5.16: CI Quality Gates

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** backlog
**Priority:** P2
**Story Points:** 3
**Dependencies:** Stories 5.11-5.15 (should be done after other tech debt stories)

---

## Story

As a **developer**,
I want **automated quality gates that enforce coding standards**,
So that **violations are caught before code is merged and standards are maintained over time**.

---

## Problem Statement

Currently, coding standards are documented but **not enforced automatically**. This causes:

1. **Standards drift** - New violations creep in over time
2. **Review burden** - Reviewers must manually check for violations
3. **Inconsistent enforcement** - Some PRs reviewed more strictly than others
4. **Tech debt accumulation** - Easy to add "just one more" violation
5. **Knowledge gaps** - New developers don't know all rules

**Reference:** [docs/coding-standards.md](../../coding-standards.md#enforcement-mechanisms)

---

## Acceptance Criteria

### AC-5.16.1: Pre-commit Hooks
- [ ] `.husky/pre-commit` script exists and runs on commit
- [ ] Blocks commits with raw `fetch()` in .tsx files
- [ ] Blocks commits with `log.Printf` in handlers/services
- [ ] Provides clear error messages explaining violation

### AC-5.16.2: CI Linting Job
- [ ] GitHub Actions workflow includes "Coding Standards Check" step
- [ ] Fails PR if violations detected
- [ ] Runs on all PRs to main branch
- [ ] Provides actionable error messages

### AC-5.16.3: Standards Checks Implemented

| Check | Scope | Blocker |
|-------|-------|---------|
| Raw fetch() | `web/app`, `web/components` | Yes |
| log.Printf | `api/internal/handlers`, `api/internal/services` | Yes |
| waitForTimeout | `tests/e2e` | Yes |
| Hardcoded colors | `web/**/*.tsx` | No (warning) |
| Missing parallel mode | `tests/e2e/*.spec.ts` | No (warning) |

### AC-5.16.4: Developer Experience
- [ ] Pre-commit hooks install automatically via `npm install` (husky)
- [ ] CI provides links to relevant docs sections
- [ ] Violations show file:line for easy navigation
- [ ] Non-blocking warnings shown but don't fail build

### AC-5.16.5: Documentation Updated
- [ ] `docs/coding-standards.md` updated with enforcement info
- [ ] `CLAUDE.md` mentions quality gates
- [ ] `README.md` includes setup instructions for hooks

---

## Technical Context

### Pre-commit Hook Script

**File: `.husky/pre-commit`**
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running coding standards checks..."

# Check 1: No raw fetch in components (CRITICAL)
FETCH_COUNT=$(grep -r "await fetch(" web/app web/components --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$FETCH_COUNT" -gt 0 ]; then
  echo "❌ ERROR: Found $FETCH_COUNT raw fetch() calls in components"
  echo "   Use the useApi() hook instead: import { useApi } from '@/lib/api-client'"
  echo ""
  echo "   Violations:"
  grep -rn "await fetch(" web/app web/components --include="*.tsx" | head -10
  echo ""
  echo "   See: docs/coding-standards.md#3-duplicated-fetch-logic"
  exit 1
fi

# Check 2: No log.Printf in handlers/services (CRITICAL)
LOG_COUNT=$(grep -rE "log\.Printf|fmt\.Printf|fmt\.Println" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | wc -l | tr -d ' ')
if [ "$LOG_COUNT" -gt 0 ]; then
  echo "❌ ERROR: Found $LOG_COUNT log.Printf/fmt.Printf calls in handlers/services"
  echo "   Use slog instead: slog.Error(\"message\", \"error\", err)"
  echo ""
  echo "   Violations:"
  grep -rEn "log\.Printf|fmt\.Printf|fmt\.Println" api/internal/handlers api/internal/services --include="*.go" | head -10
  echo ""
  echo "   See: docs/coding-standards.md#logging-slog"
  exit 1
fi

# Check 3: No waitForTimeout in tests (CRITICAL)
WAIT_COUNT=$(grep -r "waitForTimeout" tests/e2e --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$WAIT_COUNT" -gt 0 ]; then
  echo "❌ ERROR: Found $WAIT_COUNT waitForTimeout() calls in tests"
  echo "   Use deterministic waits instead: waitForLoadState, waitForResponse, etc."
  echo ""
  echo "   Violations:"
  grep -rn "waitForTimeout" tests/e2e --include="*.ts" | head -10
  echo ""
  echo "   See: docs/coding-standards.md#assertions"
  exit 1
fi

# Check 4: Hardcoded colors (WARNING only)
COLOR_COUNT=$(grep -rE "text-\[#|bg-\[#|border-\[#" web/app web/components --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$COLOR_COUNT" -gt 0 ]; then
  echo "⚠️  WARNING: Found $COLOR_COUNT hardcoded color values"
  echo "   Consider using design tokens: text-primary, bg-card, etc."
  echo "   (This is a warning, not blocking commit)"
  echo ""
fi

echo "✅ Coding standards check passed"
```

### GitHub Actions Workflow

**File: `.github/workflows/standards.yml`**
```yaml
name: Coding Standards

on:
  pull_request:
    branches: [main]

jobs:
  standards-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for raw fetch() in components
        run: |
          FETCH_COUNT=$(grep -r "await fetch(" web/app web/components --include="*.tsx" 2>/dev/null | wc -l)
          if [ "$FETCH_COUNT" -gt 0 ]; then
            echo "::error::Found $FETCH_COUNT raw fetch() calls. Use useApi() hook instead."
            grep -rn "await fetch(" web/app web/components --include="*.tsx"
            exit 1
          fi

      - name: Check for log.Printf in handlers
        run: |
          LOG_COUNT=$(grep -rE "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go" 2>/dev/null | wc -l)
          if [ "$LOG_COUNT" -gt 0 ]; then
            echo "::error::Found $LOG_COUNT log.Printf calls. Use slog instead."
            grep -rEn "log\.Printf|fmt\.Printf" api/internal/handlers api/internal/services --include="*.go"
            exit 1
          fi

      - name: Check for waitForTimeout in tests
        run: |
          WAIT_COUNT=$(grep -r "waitForTimeout" tests/e2e --include="*.ts" 2>/dev/null | wc -l)
          if [ "$WAIT_COUNT" -gt 0 ]; then
            echo "::error::Found $WAIT_COUNT waitForTimeout() calls. Use deterministic waits."
            grep -rn "waitForTimeout" tests/e2e --include="*.ts"
            exit 1
          fi

      - name: Check for hardcoded colors (warning)
        run: |
          COLOR_COUNT=$(grep -rE "text-\[#|bg-\[#|border-\[#" web/app web/components --include="*.tsx" 2>/dev/null | wc -l)
          if [ "$COLOR_COUNT" -gt 0 ]; then
            echo "::warning::Found $COLOR_COUNT hardcoded color values. Consider using design tokens."
            grep -rEn "text-\[#|bg-\[#|border-\[#" web/app web/components --include="*.tsx" || true
          fi

      - name: Standards check passed
        run: echo "✅ All critical coding standards checks passed"
```

### Husky Setup

**Update `package.json`:**
```json
{
  "scripts": {
    "prepare": "husky install"
  },
  "devDependencies": {
    "husky": "^8.0.0"
  }
}
```

**Setup commands:**
```bash
npm install husky --save-dev
npx husky install
npx husky add .husky/pre-commit "sh .husky/pre-commit"
```

---

## Tasks / Subtasks

- [ ] Task 1: Setup Husky
  - [ ] 1.1 Install husky: `npm install husky --save-dev`
  - [ ] 1.2 Initialize husky: `npx husky install`
  - [ ] 1.3 Add prepare script to package.json
  - [ ] 1.4 Create `.husky/pre-commit` script

- [ ] Task 2: Implement Pre-commit Checks
  - [ ] 2.1 Add raw fetch() check
  - [ ] 2.2 Add log.Printf check
  - [ ] 2.3 Add waitForTimeout check
  - [ ] 2.4 Add hardcoded colors warning
  - [ ] 2.5 Test pre-commit hook locally

- [ ] Task 3: Setup GitHub Actions
  - [ ] 3.1 Create `.github/workflows/standards.yml`
  - [ ] 3.2 Add fetch() check step
  - [ ] 3.3 Add log.Printf check step
  - [ ] 3.4 Add waitForTimeout check step
  - [ ] 3.5 Add hardcoded colors warning step
  - [ ] 3.6 Test workflow on a PR

- [ ] Task 4: Add VSCode Settings
  - [ ] 4.1 Create/update `.vscode/settings.json`
  - [ ] 4.2 Add search exclusions for generated code
  - [ ] 4.3 Add recommended extensions

- [ ] Task 5: Update Documentation
  - [ ] 5.1 Update `docs/coding-standards.md` with enforcement section
  - [ ] 5.2 Update `CLAUDE.md` to mention quality gates
  - [ ] 5.3 Add setup instructions to README.md

- [ ] Task 6: Verification
  - [ ] 6.1 Test pre-commit hook blocks violations
  - [ ] 6.2 Test pre-commit hook allows clean commits
  - [ ] 6.3 Test CI workflow fails on violations
  - [ ] 6.4 Test CI workflow passes on clean PRs
  - [ ] 6.5 Verify hooks install on fresh `npm install`

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Pre-commit hooks installed and working
- [ ] CI workflow blocks PRs with violations
- [ ] All checks have clear, actionable error messages
- [ ] Documentation updated with enforcement info
- [ ] Fresh `npm install` installs hooks automatically

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `.husky/pre-commit` | Create | Pre-commit hook script |
| `.github/workflows/standards.yml` | Create | CI standards check |
| `.vscode/settings.json` | Create/Modify | IDE settings |
| `package.json` | Modify | Add husky and prepare script |
| `docs/coding-standards.md` | Modify | Add enforcement section |
| `CLAUDE.md` | Modify | Mention quality gates |

---

## Testing Strategy

1. **Pre-commit Test** - Introduce violation, verify hook blocks
2. **CI Test** - Create PR with violation, verify workflow fails
3. **Clean Path Test** - Verify clean code passes all checks
4. **Fresh Install Test** - Clone repo, npm install, verify hooks work

### Test Commands

```bash
# Test pre-commit hook locally
echo 'await fetch("http://test")' > web/app/test.tsx
git add .
git commit -m "test" # Should fail

# Test CI workflow
# Create a test branch, add violation, push PR

# Cleanup
rm web/app/test.tsx
```

---

## Notes

- This story should be done AFTER Stories 5.11-5.15 fix existing violations
- Pre-commit hooks can be bypassed with `--no-verify` for emergencies
- CI workflow cannot be bypassed (by design)
- Consider adding more checks over time (TypeScript strict mode, etc.)
- The goal is prevention, not punishment - make it easy to do the right thing
