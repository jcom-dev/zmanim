# Story 8-30: User vs Publisher Entity Separation - Technical Design

**Status:** Ready for Development
**Date:** 2025-12-14
**Priority:** Medium (Conceptual Clarity)

---

## Executive Summary

Clarify the data model distinction between **Users** (people who log in) and **Publishers** (organizations that publish zmanim). This is primarily a **labeling and documentation** effort with minor schema clarifications.

---

## Domain Model Clarification

### Current Confusion

The codebase conflates "user" and "publisher" in several ways:

1. `publishers.clerk_user_id` suggests 1:1 relationship
2. `GetPublisherByClerkUserID` implies "user IS publisher"
3. UI labels like "Publisher Email" are ambiguous
4. No clear `user_publishers` junction table visible

### Correct Mental Model

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│        USER (Person)        │     │    PUBLISHER (Organization) │
├─────────────────────────────┤     ├─────────────────────────────┤
│ Source: Clerk (external)    │     │ Source: Our database        │
│ - clerk_user_id (PK)        │     │ - id (PK)                   │
│ - email (login)             │     │ - name ("Orthodox Union")   │
│ - first_name                │     │ - contact_email (public)    │
│ - last_name                 │     │ - logo_url                  │
│ - role (admin/publisher)    │     │ - description               │
│                             │     │ - status                    │
└──────────────┬──────────────┘     └──────────────┬──────────────┘
               │                                    │
               │    ┌───────────────────────┐      │
               └───►│   user_publishers     │◄─────┘
                    │   (many-to-many)      │
                    ├───────────────────────┤
                    │ - user_id (clerk_id)  │
                    │ - publisher_id        │
                    │ - role (owner/admin)  │
                    │ - is_primary          │
                    └───────────────────────┘
```

### Key Principles

| Entity | Is A | Can Login? | Example |
|--------|------|------------|---------|
| User | Person | Yes (via Clerk) | "Rabbi Cohen" |
| Publisher | Organization | No | "Orthodox Union" |

**A Publisher CANNOT log in.** Users log in and are associated with publishers.

---

## Current Schema Analysis

### Publishers Table

```sql
-- Current definition (simplified)
CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    clerk_user_id TEXT,        -- ⚠️ Problematic: implies 1:1
    name TEXT NOT NULL,
    email TEXT,                -- ⚠️ Ambiguous: user email or contact?
    description TEXT,
    bio TEXT,
    website TEXT,
    logo_url TEXT,
    status_id INT,
    is_verified BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**Issues:**
1. `clerk_user_id` - This is the "owner" user, not the publisher itself
2. `email` - Should be `contact_email` to clarify it's for public inquiries

### Proposed Clarifications

```sql
-- Option A: Rename for clarity (minimal change)
ALTER TABLE publishers RENAME COLUMN email TO contact_email;
-- Add comment for clerk_user_id
COMMENT ON COLUMN publishers.clerk_user_id IS 'Owner user (legacy 1:1, see user_publishers for full access)';

-- Option B: Full junction table (future epic)
CREATE TABLE user_publishers (
    user_id TEXT NOT NULL,           -- Clerk user ID
    publisher_id INT NOT NULL REFERENCES publishers(id),
    role TEXT NOT NULL DEFAULT 'member',  -- owner, admin, member
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, publisher_id)
);
-- Note: This may already exist in Clerk metadata (publisher_access_list)
```

**Recommendation:** For this story, focus on Option A (rename + documentation). Option B is already partially implemented via Clerk's `publisher_access_list` JWT claim.

---

## Implementation Plan

### Phase 1: UI Label Updates (Primary Focus)

#### Files to Update

**Admin Pages:**

```typescript
// File: web/app/admin/publishers/page.tsx
// Change: "Email" → "Contact Email"

<TableHead>Contact Email</TableHead>
// ...
<TableCell>{publisher.contact_email}</TableCell>
```

```typescript
// File: web/app/admin/publishers/[id]/page.tsx
// Change: "Publisher Email" → "Contact Email (for public inquiries)"

<Label htmlFor="contact_email">Contact Email (for public inquiries)</Label>
<Input id="contact_email" {...} />
```

**Publisher Pages:**

```typescript
// File: web/app/publisher/profile/page.tsx
// Change: "Email" → "Contact Email"
// Add helper text

<Label>Contact Email</Label>
<p className="text-sm text-muted-foreground">
  This email is displayed publicly for inquiries. It is not your login email.
</p>
<Input {...} />
```

**Invitation Dialogs:**

```typescript
// File: web/components/publisher/InviteDialog.tsx (if exists)
// Change: "Invite Publisher" → "Invite User to Publisher"

<DialogTitle>Invite User to {publisherName}</DialogTitle>
<p>Enter the email address of the person you want to invite.</p>
```

### Phase 2: Backend Clarifications (Optional)

#### SQL Query Updates

```sql
-- File: api/internal/db/queries/publishers.sql
-- Add comments to clarify field purposes

-- name: GetPublisherByID :one
-- Returns publisher organization details (not user login info)
SELECT
    p.id,
    p.clerk_user_id,      -- Owner user ID (for permissions)
    p.name,               -- Organization name
    p.email as contact_email,  -- Public contact (NOT login email)
    -- ...
```

#### API Response Updates

```go
// File: api/internal/handlers/publishers.go
// Rename JSON fields for clarity

type PublisherResponse struct {
    ID           string `json:"id"`
    Name         string `json:"name"`
    ContactEmail string `json:"contact_email"`  // Was: email
    // ...
}
```

**Note:** This is a BREAKING CHANGE for API consumers. Add `email` as deprecated alias if needed.

### Phase 3: Documentation Updates

#### Create Glossary

```markdown
<!-- File: docs/glossary.md (new) -->

# Shtetl Zmanim Glossary

## User
A **person** who can log in to Shtetl Zmanim using their Clerk account. Users have:
- Email (for login)
- Name (first, last)
- Role (admin, publisher, user)

Users can be associated with multiple Publishers.

## Publisher
An **organization** that publishes zmanim calculations. Publishers have:
- Name (e.g., "Orthodox Union")
- Contact Email (for public inquiries - NOT login)
- Logo, Website, Description

Publishers do NOT have login credentials. Users log in and access publishers they're associated with.

## User-Publisher Relationship
- A User can belong to multiple Publishers
- The relationship has a role: owner, admin, or member
- One publisher is marked as "primary" for each user
```

#### Update CLAUDE.md

Add to Domain Concepts section:
```markdown
**User** - A person who logs in (via Clerk). NOT the same as a publisher.
**Publisher** - An organization. Cannot log in. Has contact_email for inquiries.
```

---

## Migration Considerations

### Database Migration (If Renaming Column)

```sql
-- File: db/migrations/00000000000010_clarify_publisher_email.sql

-- Rename for clarity
ALTER TABLE publishers RENAME COLUMN email TO contact_email;

-- Update any views/functions that reference 'email'
-- (check with: grep -r "publishers.email" api/internal/db/queries/)
```

### API Backward Compatibility

If renaming JSON field `email` → `contact_email`:

```go
type PublisherResponse struct {
    ID           string `json:"id"`
    Name         string `json:"name"`
    ContactEmail string `json:"contact_email"`
    Email        string `json:"email,omitempty"` // Deprecated alias
}

// In handler:
response.Email = response.ContactEmail // Populate deprecated field
```

---

## Test Plan

### Manual Testing

1. Check Admin > Publishers list shows "Contact Email" column header
2. Check Publisher Profile form has "Contact Email" label with helper text
3. Check invitation dialog says "Invite User to [Publisher]"
4. Verify API responses (both `contact_email` and deprecated `email`)

### Automated Tests

```typescript
// E2E: Verify UI labels
test('publisher profile shows Contact Email label', async ({ page }) => {
  await page.goto('/publisher/profile');
  await expect(page.getByLabel('Contact Email')).toBeVisible();
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `web/app/admin/publishers/page.tsx` | Label: "Contact Email" |
| `web/app/admin/publishers/[id]/page.tsx` | Label: "Contact Email" |
| `web/app/publisher/profile/page.tsx` | Label + helper text |
| `web/components/publisher/InviteDialog.tsx` | Dialog title |
| `api/internal/db/queries/publishers.sql` | Comments |
| `docs/glossary.md` | New file |
| `CLAUDE.md` | Domain concept clarification |
| `db/migrations/00000000000010_*.sql` | Optional column rename |

---

## Estimated Effort

| Task | Points |
|------|--------|
| UI label updates | 1 |
| Documentation | 1 |
| Optional schema migration | 1 |
| Total | **3 points** |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| API breaking change (email→contact_email) | Medium | Add deprecated alias |
| UI confusion during transition | Low | Update all labels atomically |
| Frontend consumers of `email` field | Low | Search and update imports |

---

## Out of Scope (Future)

- Full `user_publishers` junction table (already in Clerk metadata)
- Removing `clerk_user_id` from publishers table
- User management UI for publishers
