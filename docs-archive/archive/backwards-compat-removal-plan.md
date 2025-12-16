# Backwards Compatibility Removal Plan

This document outlines the complete removal of all backwards compatibility code from the codebase.

## Overview

The codebase currently has backwards compatibility for:
1. **`role` field** in Clerk metadata (old) vs `is_admin` + `publisher_access_list` (new)
2. **`verified` status** in publishers table (old) vs `active` status (new)

## Phase 1: Database Migration

### 1.1 Update all `verified` status to `active`

```sql
-- Migration: Convert all 'verified' status to 'active'
UPDATE publishers SET status = 'active' WHERE status = 'verified';
```

### 1.2 Add constraint to prevent `verified` status

```sql
-- Ensure status constraint only allows: pending, active, suspended
ALTER TABLE publishers DROP CONSTRAINT IF EXISTS publishers_status_check;
ALTER TABLE publishers ADD CONSTRAINT publishers_status_check
  CHECK (status IN ('pending', 'active', 'suspended'));
```

## Phase 2: Backend Changes (Go)

### 2.1 clerk_service.go

Remove all `role` field fallback checks and writes:

| Line | Current Code | New Code |
|------|--------------|----------|
| 207-208 | `else if role, ok := metadata["role"].(string); ok && role == "admin"` | Remove this fallback |
| 211 | `metadata["role"] = "publisher"` | Remove |
| 271-272 | Same fallback pattern | Remove |
| 538-549 | Sets both `is_admin` AND `role` | Only set `is_admin` |
| 541 | `metadata["role"] = "admin"` | Remove |
| 545 | `metadata["role"] = "publisher"` | Remove |
| 547 | `metadata["role"] = "user"` | Remove |
| 571-573 | Fallback to `role` check | Remove |
| 590-591 | Same pattern | Remove |
| 661-662 | Same pattern | Remove |
| 741 | `publicMetadata["role"] = "admin"` | Remove |
| 749 | `publicMetadata["role"] = "publisher"` | Remove |
| 753-756 | Default role logic | Remove entirely |

**Simplified IsAdmin function:**
```go
func (s *ClerkService) IsAdmin(ctx context.Context, clerkUserID string) (bool, error) {
    metadata, err := s.GetUserPublicMetadata(ctx, clerkUserID)
    if err != nil {
        return false, err
    }
    if isAdmin, ok := metadata["is_admin"].(bool); ok {
        return isAdmin, nil
    }
    return false, nil
}
```

### 2.2 publisher_service.go

Remove all `status = 'verified' OR status = 'active'` patterns:

| Line | Current Code | New Code |
|------|--------------|----------|
| 39 | `(p.status = 'verified' OR p.status = 'active')` | `p.status = 'active'` |
| 44 | Same pattern | `p.status = 'active'` |
| 53 | Same pattern | `status = 'active'` |
| 57 | Same pattern | `status = 'active'` |
| 93 | Same pattern | `p.status = 'active'` |
| 97 | Same pattern | `status = 'active'` |
| 118, 142, 149, 178, 184 | Same patterns | Replace with `= 'active'` |

### 2.3 handlers.go

| Line | Current Code | New Code |
|------|--------------|----------|
| 166 | `(p.status = 'verified' OR p.status = 'active')` | `p.status = 'active'` |

### 2.4 admin.go

| Line | Current Code | New Code |
|------|--------------|----------|
| 908 | `COUNT(*) FILTER (WHERE status = 'verified')` | `COUNT(*) FILTER (WHERE status = 'active')` |

## Phase 3: Test Files

### 3.1 auth.setup.ts

Update to use `is_admin` instead of `role`:

```typescript
// Finding admin user
const existingAdmin = allUsers.data.find((u) => {
  return (u.publicMetadata as any)?.is_admin === true;
});

// Creating admin user
const user = await clerkClient.users.createUser({
  emailAddress: [email],
  password: TEST_PASSWORD,
  publicMetadata: { is_admin: true },
  skipPasswordChecks: true,
  skipPasswordRequirement: true,
});

// Finding publisher user
const existingPublisher = allUsers.data.find((u) => {
  const accessList = (u.publicMetadata as any)?.publisher_access_list;
  return Array.isArray(accessList) && accessList.length > 0 &&
    email.startsWith(TEST_EMAIL_PREFIX);
});

// Creating publisher user
publicMetadata: {
  publisher_access_list: [publisherId],
},
```

### 3.2 clerk-auth.ts

Same changes as auth.setup.ts - use `is_admin` and `publisher_access_list` only.

### 3.3 test-fixtures.ts

Remove `verified` from status mapping:

```typescript
function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'pending',
    suspended: 'suspended',
    active: 'active',
  };
  return statusMap[status] || 'pending';
}
```

### 3.4 shared-fixtures.ts

Remove `verified` → `active` mapping:

```typescript
// Remove lines 96-98:
// const dbStatus = config.status === 'verified' ? 'active' : config.status;
// const isVerified = config.status === 'verified' || dbStatus === 'active';

// Replace with:
const dbStatus = config.status;
const isVerified = dbStatus === 'active';
```

## Phase 4: Clerk User Migration

After code changes, migrate existing Clerk users to new metadata format:

```typescript
// One-time migration script
async function migrateClerkUsers() {
  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const users = await clerkClient.users.getUserList({ limit: 500 });

  for (const user of users.data) {
    const metadata = user.publicMetadata as any || {};
    const newMetadata: Record<string, any> = {};

    // Migrate admin status
    if (metadata.is_admin === true || metadata.role === 'admin') {
      newMetadata.is_admin = true;
    }

    // Keep publisher_access_list as-is
    if (metadata.publisher_access_list) {
      newMetadata.publisher_access_list = metadata.publisher_access_list;
    }

    // Keep primary_publisher_id as-is
    if (metadata.primary_publisher_id) {
      newMetadata.primary_publisher_id = metadata.primary_publisher_id;
    }

    // Update user (removes 'role' field entirely)
    await clerkClient.users.updateUser(user.id, {
      publicMetadata: newMetadata,
    });
  }
}
```

## Execution Order

1. **Run database migration** (Phase 1)
2. **Deploy backend changes** (Phase 2)
3. **Run Clerk user migration** (Phase 4)
4. **Update test files** (Phase 3)
5. **Run full test suite** to verify

## Verification

After migration:
- [ ] No `role` field in any Clerk user metadata
- [ ] No `verified` status in publishers table
- [ ] All queries use `status = 'active'` only
- [ ] All admin checks use `is_admin` only
- [ ] All publisher checks use `publisher_access_list` only
- [ ] Tests pass
- [ ] Build succeeds
