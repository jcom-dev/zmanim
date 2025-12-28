# Quick Start: Performance Optimization

**Start Here** → Read this file first for fastest path to implementation

---

## 🎯 The Problem

Weekly zmanim endpoint: **3000ms** (should be **400ms**)

**Root Cause**: 365× redundant database queries in `CalculateRange()` loop

---

## 📋 Read These Files (in order)

1. **PHASE1_COMPLETE.md** (7 KB) - Executive summary
   - What we found
   - Performance targets
   - Timeline and resources
   - Decision points

2. **PERFORMANCE_AUDIT_SUMMARY.md** (20 KB) - Detailed findings
   - 6 agent audit reports
   - Specific code issues with line numbers
   - Performance grades by component

3. **OPTIMIZATION_PLAN.md** (49 KB) - Implementation guide
   - Step-by-step instructions
   - Code examples for all fixes
   - Testing procedures
   - 4-week timeline with tasks

---

## ⚡ Critical Path (Must Do First)

### Week 1: Fix Cache Key Bug (BLOCKING)

**File**: `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go`
**Line**: 988-1007

**Problem**: Missing `ActiveEventCodes` in cache key

**Impact**: 
- Wrong zmanim cached (Friday data shown on Sunday)
- Enables all other optimizations

**Time**: 2 hours

**See**: OPTIMIZATION_PLAN.md Section 1.1 for code

---

## 🚀 Biggest Impact (Week 2)

### Add Preload to CalculateRange

**File**: `/home/daniel/repos/zmanim/api/internal/services/zmanim_service.go`
**Line**: 492-559

**Problem**: Queries DB 7× for weekly (should be 1×)

**Impact**: 6× speedup (3000ms → 500ms)

**Time**: 8 hours

**See**: OPTIMIZATION_PLAN.md Section 2.1 for code

---

## 📊 Expected Results

| Endpoint | Before | After | Improvement |
|----------|--------|-------|-------------|
| Daily | 150ms | 150ms | — |
| **Weekly** | **3000ms** | **300ms** | **10×** |
| Monthly | 8000ms | 2000ms | 4× |
| Yearly | 45000ms | 10000ms | 4.5× |

---

## 🛠️ Implementation Order

1. Week 1: Quick wins (cache fix, logging, indexes)
2. Week 2: Medium complexity (preload, batching, parallelization)
3. Week 3: Major refactors (in-memory caches)
4. Week 4: Validation and deployment

**Total**: 4 weeks, 1-2 engineers

---

## 📂 File Structure

```
/home/daniel/repos/zmanim/
├── PHASE1_COMPLETE.md              ← Start here (executive summary)
├── PERFORMANCE_AUDIT_SUMMARY.md    ← Detailed findings
├── OPTIMIZATION_PLAN.md            ← Implementation guide
└── QUICKSTART_OPTIMIZATION.md      ← This file
```

---

## ✅ Success Criteria

- Weekly endpoint: < 400ms cold, < 100ms cached
- Database queries: < 5 per request (vs 21 current)
- Cache hit rate: > 80%
- Zero functional regressions

---

## 🔗 Quick Links to Key Sections

**OPTIMIZATION_PLAN.md**:
- Section 1.1: Cache key fix (CRITICAL)
- Section 2.1: CalculateRange preload (HIGH IMPACT)
- Section 2.2: Calendar batching (94% fewer API calls)
- Section 7: Performance benchmarks

**PERFORMANCE_AUDIT_SUMMARY.md**:
- Agent 3: Service layer findings (cache bug + preload)
- Agent 4: Calendar integration (redundant HebCal calls)
- Agent 5: Handler layer (parallelization opportunities)

---

**Questions?** Review OPTIMIZATION_PLAN.md for complete details

**Ready to start?** Begin with Week 1 tasks in OPTIMIZATION_PLAN.md
