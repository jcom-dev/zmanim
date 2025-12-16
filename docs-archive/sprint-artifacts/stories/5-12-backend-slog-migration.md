# Story 5.12: Backend slog Migration

**Epic:** Epic 5 - DSL Editor Experience & Zman Management
**Status:** backlog
**Priority:** P1
**Story Points:** 5
**Dependencies:** None (can start immediately)

---

## Story

As a **developer**,
I want **all log.Printf and fmt.Printf calls migrated to slog structured logging**,
So that **logs are consistent, searchable, and include proper context for debugging**.

---

## Problem Statement

The current codebase has **~100 instances** of `log.Printf`, `fmt.Printf`, and `fmt.Println` in the backend. This violates the coding standards and causes:

1. **Inconsistent log format** - Mixed formats make log parsing difficult
2. **Missing context** - No user_id, publisher_id, request_id in logs
3. **No log levels** - Can't filter by severity (error vs info vs debug)
4. **No structured fields** - Can't search/filter logs by specific fields
5. **Production debugging pain** - Hard to trace issues across services

**Reference:** [docs/coding-standards.md](../../coding-standards.md#logging-slog)

**Exemptions:** `api/cmd/` directory is EXEMPT (CLI tools can use log.Printf for user feedback)

---

## Acceptance Criteria

### AC-5.12.1: Zero Violations in handlers/services
- [ ] `grep -rE "log\.Printf|fmt\.Printf|fmt\.Println" api/internal/handlers api/internal/services --include="*.go" | wc -l` returns 0
- [ ] All logging uses `log/slog` package
- [ ] Proper import: `"log/slog"`

### AC-5.12.2: Error Logging Pattern
- [ ] All error logs use `slog.Error()` with "error" field
- [ ] Context fields included: error, user_id, publisher_id, etc.
- [ ] Generic user messages (internals not exposed)

```go
// CORRECT
slog.Error("failed to fetch publisher",
    "error", err,
    "user_id", userID,
    "publisher_id", publisherID,
)
```

### AC-5.12.3: Info Logging Pattern
- [ ] Success operations use `slog.Info()`
- [ ] Meaningful event names
- [ ] Relevant context fields

```go
// CORRECT
slog.Info("publisher profile updated",
    "publisher_id", publisherID,
    "fields_changed", len(updates),
)
```

### AC-5.12.4: Warning Logging Pattern
- [ ] Recoverable issues use `slog.Warn()`
- [ ] Deprecated endpoint usage logged
- [ ] Rate limiting events logged

### AC-5.12.5: Debug Logging (Optional)
- [ ] Performance-sensitive operations use `slog.Debug()`
- [ ] Debug logs can be filtered in production

### AC-5.12.6: Middleware Logging
- [ ] Request logging middleware uses slog
- [ ] Request ID propagated to all logs
- [ ] Response time logged

---

## Technical Context

### Current Violation Locations

Run this command to find all violations:
```bash
grep -rEn "log\.Printf|fmt\.Printf|fmt\.Println" api/internal/handlers api/internal/services --include="*.go"
```

**High-priority files (handlers/services only):**
- `api/internal/handlers/*.go` - HTTP handlers
- `api/internal/services/*.go` - Business logic
- `api/internal/middleware/*.go` - Middleware

### Migration Patterns

**Before (WRONG - log.Printf):**
```go
log.Printf("Error fetching publisher %s: %v", publisherID, err)
```

**Before (WRONG - fmt.Printf):**
```go
fmt.Printf("Processing request for user %s\n", userID)
```

**After (CORRECT - slog.Error):**
```go
slog.Error("failed to fetch publisher",
    "error", err,
    "publisher_id", publisherID,
)
```

**After (CORRECT - slog.Info):**
```go
slog.Info("processing request",
    "user_id", userID,
)
```

### Logging at Boundaries

**RULE:** Log at the handler boundary, not everywhere

```go
// In service layer - return error, don't log
func (s *Service) DoSomething() error {
    if err != nil {
        return fmt.Errorf("failed to do something: %w", err)
    }
    return nil
}

// In handler layer - log the error with context
if err != nil {
    slog.Error("operation failed",
        "error", err,
        "user_id", userID,
        "publisher_id", publisherID,
    )
    RespondInternalError(w, r, "Failed to process request")
    return
}
```

### Log Level Guidelines

| Level | When to Use | Example |
|-------|-------------|---------|
| `slog.Error` | Operation failed, user impact | Database error, auth failure |
| `slog.Warn` | Recoverable issue, no user impact | Deprecated endpoint, rate limit hit |
| `slog.Info` | Successful operation, audit trail | User created, profile updated |
| `slog.Debug` | Developer debugging only | Query timing, cache hit/miss |

### Files to Migrate (Prioritized)

| Priority | Directory | Approx Count | Complexity |
|----------|-----------|--------------|------------|
| P1 | `api/internal/handlers/` | ~40 | Medium |
| P1 | `api/internal/services/` | ~30 | Medium |
| P2 | `api/internal/middleware/` | ~15 | Low |
| P2 | `api/internal/dsl/` | ~10 | Low |
| P3 | `api/internal/cache/` | ~5 | Low |
| EXEMPT | `api/cmd/` | ~20 | N/A |

---

## Tasks / Subtasks

- [ ] Task 1: Audit and Categorize
  - [ ] 1.1 Run grep to list all violations
  - [ ] 1.2 Categorize by log level (error/warn/info)
  - [ ] 1.3 Identify context fields needed per log
  - [ ] 1.4 Mark exemptions (cmd/ directory)

- [ ] Task 2: Handler Migrations
  - [ ] 2.1 Migrate `handlers/publisher_profile.go`
  - [ ] 2.2 Migrate `handlers/publisher_zmanim.go`
  - [ ] 2.3 Migrate `handlers/publisher_coverage.go`
  - [ ] 2.4 Migrate `handlers/admin.go`
  - [ ] 2.5 Migrate `handlers/auth.go`
  - [ ] 2.6 Migrate remaining handler files

- [ ] Task 3: Service Migrations
  - [ ] 3.1 Migrate `services/clerk_service.go`
  - [ ] 3.2 Migrate `services/zman_service.go`
  - [ ] 3.3 Migrate `services/calculation_service.go`
  - [ ] 3.4 Migrate remaining service files

- [ ] Task 4: Middleware Migrations
  - [ ] 4.1 Migrate `middleware/auth.go`
  - [ ] 4.2 Migrate `middleware/logging.go`
  - [ ] 4.3 Migrate `middleware/cors.go`

- [ ] Task 5: Other Internal Packages
  - [ ] 5.1 Migrate `dsl/parser.go`
  - [ ] 5.2 Migrate `dsl/validator.go`
  - [ ] 5.3 Migrate `cache/cache.go`

- [ ] Task 6: Verification
  - [ ] 6.1 Run violation check (should return 0)
  - [ ] 6.2 Run `go build ./...`
  - [ ] 6.3 Run `go test ./...`
  - [ ] 6.4 Manual testing of key endpoints
  - [ ] 6.5 Verify logs appear correctly in output

---

## DoD Gate

**This story is NOT ready for review until:**
- [ ] Zero violations in api/internal/handlers and api/internal/services
- [ ] All slog calls include appropriate context fields
- [ ] Go build passes with no errors
- [ ] Go tests pass
- [ ] Sample logs verified for format correctness

---

## Files to Modify

| Directory | Action | Purpose |
|-----------|--------|---------|
| `api/internal/handlers/*.go` | Modify | Handler logging |
| `api/internal/services/*.go` | Modify | Service logging |
| `api/internal/middleware/*.go` | Modify | Middleware logging |
| `api/internal/dsl/*.go` | Modify | DSL logging |
| `api/internal/cache/*.go` | Modify | Cache logging |

---

## Testing Strategy

1. **Compile Check** - `go build ./...` must pass
2. **Unit Tests** - `go test ./...` must pass
3. **Log Verification** - Manually trigger endpoints and verify log format
4. **Error Scenario** - Test error paths produce correct slog output

---

## Log Output Example

**Before (inconsistent):**
```
2025-12-02 10:30:00 Error fetching publisher abc123: connection refused
Processing request for user xyz789
```

**After (structured, searchable):**
```json
{"time":"2025-12-02T10:30:00Z","level":"ERROR","msg":"failed to fetch publisher","error":"connection refused","publisher_id":"abc123","user_id":"xyz789"}
{"time":"2025-12-02T10:30:01Z","level":"INFO","msg":"processing request","user_id":"xyz789"}
```

---

## Notes

- This story addresses HIGH priority technical debt per coding standards
- `api/cmd/` directory is EXEMPT - CLI tools can use log.Printf for user feedback
- Focus on handlers/services first (user-facing impact)
- Migration should NOT change any business logic
