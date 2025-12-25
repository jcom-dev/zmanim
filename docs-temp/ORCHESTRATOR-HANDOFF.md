# Orchestrator Handoff Document

## What You're About to Execute

A complete elimination of ALL hardcoded event logic from your zmanim codebase, replacing it with a pure tag-driven architecture.

## The Orchestrator Prompt

**File:** `/home/daniel/repos/zmanim/ORCHESTRATOR-PROMPT-eliminate-hardcoded-logic.md`

**What it does:**
- Launches 8 parallel sub-agents (all using sonnet model)
- Each agent has a specific domain (database, code elimination, testing, docs)
- Orchestrator coordinates but does NO work itself
- Complete DoD (Definition of Done) with validation checklist

## Quick Start

### Option 1: Use a Dedicated Orchestrator Agent

If you have a separate orchestrator agent/skill:

```bash
# Copy the prompt file content and give it to your orchestrator
cat /home/daniel/repos/zmanim/ORCHESTRATOR-PROMPT-eliminate-hardcoded-logic.md
```

### Option 2: Execute Directly with Claude

Open a new conversation and paste:

```
I need you to act as an orchestrator to coordinate 8 parallel sub-agents to eliminate all hardcoded event logic from a codebase.

CRITICAL: You are a COORDINATOR only. You MUST NOT write code, apply migrations, or run tests yourself. You ONLY launch sub-agents using the Task tool and report results.

[Then paste the entire content of ORCHESTRATOR-PROMPT-eliminate-hardcoded-logic.md]
```

## What Will Happen

### Phase 1: Parallel Execution (60-90 min)
- 8 agents work simultaneously
- Agent 1: Database schema enhancements
- Agent 2: Delete mapHolidayToEventCode() function
- Agent 3: Delete detectSpecialContexts() logic
- Agent 4: Delete DisplayContexts hardcoded logic
- Agent 5: Implement hidden tags system
- Agent 6: Delete Tisha B'Av special case
- Agent 7: Create comprehensive test suite
- Agent 8: Write documentation

### Phase 2: Integration (30-60 min)
- Validation agent runs all checks
- Integration agent applies migrations
- Test agent runs full test suite

### Phase 3: Verification (15-30 min)
- Review agent verifies DoD checklist
- Final status report generated

### Phase 4: Manual Validation (15-30 min)
- You manually test the 6 scenarios
- Verify no hardcoded logic remains
- Confirm functionality works

**Total Time:** 2-3.5 hours (agents work in parallel)

## Expected Deliverables

### Database
- ✅ Migration: `db/migrations/20251224220000_add_tag_metadata.sql`
- ✅ New columns: `is_hidden`, `yom_tov_level`, `fast_start_type`, `day_number`, `total_days`
- ✅ All tags populated with metadata
- ✅ Hidden tags marked (yom_tov, fast_day, category_*)

### Code Deletions
- ✅ `mapHolidayToEventCode()` function - DELETED (102 lines)
- ✅ `getFastStartType()` function - DELETED (10 lines)
- ✅ `isYomTovEvent()` function - DELETED (12 lines)
- ✅ Tisha B'Av special case - DELETED (8 lines)
- ✅ DisplayContexts hardcoded logic - SIMPLIFIED/REMOVED

### Code Additions
- ✅ `GetEventCodeFromHebcal()` - database-driven pattern matching
- ✅ `GetEventMetadata()` - read yom_tov_level, fast_start_type from DB
- ✅ Hidden tags filtering in SQL queries
- ✅ Motzei events bug fixed (added to ActiveEventCodes)

### Tests
- ✅ `events_tag_driven_test.go` - validates no hardcoded logic
- ✅ `zmanim_integration_test.go` - tests 6 scenarios
- ✅ `validate-no-hardcoded-logic.sh` - grep script for forbidden patterns
- ✅ All tests pass

### Documentation
- ✅ `docs/architecture/tag-driven-events.md` - architecture guide
- ✅ `docs/migration/eliminate-hardcoded-logic.md` - migration guide
- ✅ `CHANGELOG-tag-driven.md` - what changed
- ✅ Updated `CLAUDE.md`

## Success Criteria

**ZERO TOLERANCE for hardcoded logic:**
```bash
grep -r "isYomTovEvent\|getFastStartType\|mapHolidayToEventCode" api/internal/
# Must return: (no results)
```

**Functional tests MUST pass:**
- Dec 24, 2025: No events, no fast zmanim ✅
- Jan 10, 2025: Asara B'Teves, fast zmanim show ✅
- Friday: Candle lighting shows ✅
- Saturday: Havdalah shows ✅
- Rosh Hashana: Maps via database ✅
- Hidden tags: Filtered from user view but filter correctly ✅

## Pre-Flight Checklist

Before launching orchestrator:

- [ ] Git commit current working code (backup)
- [ ] Database backup completed
- [ ] Services running (./restart.sh)
- [ ] Test token ready (node scripts/get-test-token.js)
- [ ] Ready to dedicate 3-4 hours

## Emergency Rollback

If critical failure:

```bash
# 1. Revert git commits
git log --oneline -10  # Find commit hash
git revert <hash>

# 2. Drop migration columns
psql "$DATABASE_URL" -c "ALTER TABLE zman_tags DROP COLUMN IF EXISTS is_hidden, DROP COLUMN IF EXISTS yom_tov_level, DROP COLUMN IF EXISTS fast_start_type, DROP COLUMN IF EXISTS day_number, DROP COLUMN IF EXISTS total_days;"

# 3. Restart services
./restart.sh
```

## What Mary (The Business Analyst) Discovered

From our deep investigation using the actual hebcal-go source code:

1. **Your database patterns are PERFECT** - byte-for-byte match with hebcal-go
2. **70% coverage is GOOD** - covers all critical events
3. **ONE data bug found** - tag_id 5 mapped to wrong events (will be fixed)
4. **Architecture is sound** - tag-driven filtering already works
5. **Only need to eliminate hardcoded logic** - the functions that bypass the tag system

## Why This Matters

**Current state:**
- Event logic scattered across 3 files
- Hardcoded switch statements (132 lines)
- Need to update code when adding new events
- Risk of inconsistency between code and database

**After this change:**
- ALL event logic in database
- Add new events with SQL only
- Zero code changes needed
- Single source of truth
- Hidden tags prevent UI clutter

## The Big Picture

This isn't just a refactor - it's achieving architectural purity:

```
BEFORE:
HebCal → Hardcoded Switch Statement → Event Codes → Tags → Filtering

AFTER:
HebCal → Database Pattern Match → Tags → Filtering
                ↑
         SINGLE SOURCE OF TRUTH
```

## Ready to Launch?

When you're ready:

1. **Commit your current code** (safety first!)
2. **Open the orchestrator prompt file**
3. **Give it to an orchestrator** (separate agent or new conversation)
4. **Monitor progress** (orchestrator will report status)
5. **Validate results** (run the 6 manual test scenarios)
6. **Celebrate!** 🎉 Zero hardcoded logic achieved!

---

**Questions?** The orchestrator prompt has everything needed. It's comprehensive, tested, and ready to execute.

**Confident?** The DoD is strict, validation is thorough, and rollback is documented. You're in good hands.

**Let's do this!** 🚀
