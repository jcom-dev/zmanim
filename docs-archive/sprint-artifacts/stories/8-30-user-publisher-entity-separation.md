# Story 8.30: User vs Publisher Entity Separation

Status: approved

## Story

As a platform architect,
I want clear separation between User and Publisher entities in the data model and UI,
So that the system correctly represents that publishers are organizations (not people) and users are people who can belong to multiple publishers.

## Context

**Current Confusion:**
The current system conflates "user" and "publisher" concepts:
- Publishers have `contact_email` but this is treated like a user email
- UI sometimes refers to "publisher email" when it should be "publisher contact email"
- Invitation flows don't clearly distinguish between inviting a user vs creating a publisher
- A publisher is an organization (e.g., "Orthodox Union", "Chabad") - not a person

**Correct Model:**
```
User (Person)                    Publisher (Organization)
─────────────                    ────────────────────────
- email (unique, from Clerk)     - name (e.g., "Orthodox Union")
- first_name                     - contact_email (for public inquiries)
- last_name                      - logo_url
- clerk_user_id                  - description
                                 - website_url
        │                                │
        └──────── user_publishers ───────┘
                  (many-to-many)
                  - role: owner | admin | member
                  - is_primary: boolean
```

**Key Principles:**
1. A **Publisher** is an organization - it does NOT have login credentials
2. A **User** is a person - they authenticate via Clerk
3. Users can belong to multiple publishers with different roles
4. Publishers have a `contact_email` for public inquiries (not login)
5. When inviting someone to a publisher, you're inviting a **User**

## Acceptance Criteria

1. Database schema clearly separates User and Publisher entities
2. `publishers` table has `contact_email` (not `email`) - for public contact only
3. `user_publishers` junction table links users to publishers with roles
4. UI labels correctly distinguish "Publisher" (org) from "User" (person)
5. Admin UI shows "Publisher Contact Email" not "Publisher Email"
6. Invitation flows clearly state "Invite User to Publisher"
7. Public publisher profile shows contact email as "Contact" not personal email
8. Documentation updated to reflect entity separation

## Tasks / Subtasks

- [ ] Task 1: Audit current schema and UI
  - [ ] 1.1 Document current `publishers` table fields related to email/contact
  - [ ] 1.2 Document current `user_publishers` or equivalent junction table
  - [ ] 1.3 List all UI locations that reference "publisher email"
  - [ ] 1.4 Identify any conflation of user/publisher concepts
- [ ] Task 2: Database schema updates (if needed)
  - [ ] 2.1 Rename `email` to `contact_email` in publishers table (if applicable)
  - [ ] 2.2 Add comments to schema clarifying entity purposes
  - [ ] 2.3 Ensure `user_publishers` has proper role enum
  - [ ] 2.4 Migration script with data preservation
- [ ] Task 3: Backend updates
  - [ ] 3.1 Update SQLc queries to use correct field names
  - [ ] 3.2 Update API responses to clearly label fields
  - [ ] 3.3 Add validation that publisher contact_email != user invitation
- [ ] Task 4: Frontend UI label updates
  - [ ] 4.1 Admin publisher list: "Contact Email" not "Email"
  - [ ] 4.2 Publisher profile form: "Contact Email (for public inquiries)"
  - [ ] 4.3 Publisher public page: "Contact" section
  - [ ] 4.4 Invitation dialogs: "Invite User to [Publisher Name]"
- [ ] Task 5: Documentation
  - [ ] 5.1 Update data model documentation
  - [ ] 5.2 Add glossary: User vs Publisher definitions
  - [ ] 5.3 Update API documentation with correct terminology

## Dev Notes

### Current Schema (Audit Needed)
```sql
-- publishers table - represents ORGANIZATIONS
CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,           -- Organization name
    contact_email TEXT,           -- For public inquiries (NOT login)
    logo_url TEXT,
    description TEXT,
    website_url TEXT,
    status TEXT,                  -- pending, active, suspended
    -- ...
);

-- users come from Clerk - represents PEOPLE
-- user_publishers links people to organizations
CREATE TABLE user_publishers (
    user_id TEXT NOT NULL,        -- Clerk user ID
    publisher_id INT NOT NULL REFERENCES publishers(id),
    role TEXT NOT NULL,           -- owner, admin, member
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, publisher_id)
);
```

### UI Label Changes
| Current | Correct |
|---------|---------|
| "Publisher Email" | "Contact Email" |
| "Invite Publisher" | "Invite User to Publisher" |
| "Publisher Account" | "Publisher Organization" |
| "Your Email" (in publisher form) | "Contact Email (public)" |

## References

- **Coding Standards:** [docs/coding-standards.md](../../coding-standards.md) - MUST READ before implementation
- **Global Standards:** [docs/coding-standards-global.md](../../coding-standards-global.md)
- **Context File:** [8-30-user-publisher-entity-separation.context.xml](./8-30-user-publisher-entity-separation.context.xml)
- **Tech Design:** See "Current Schema (Audit Needed)" and "UI Label Changes" sections above

## Definition of Done (DoD)

**All items must be checked before marking story "Ready for Review":**

### Schema & Backend
- [ ] `publishers` table uses `contact_email` field name (not `email`)
- [ ] `user_publishers` junction table exists with proper structure
- [ ] SQLc queries use correct field names
- [ ] API responses clearly label `contact_email` for publishers

### UI Labels
- [ ] Admin publisher list shows "Contact Email" (not "Email")
- [ ] Publisher profile form shows "Contact Email (for public inquiries)"
- [ ] Invitation dialogs state "Invite User to [Publisher Name]"
- [ ] Public publisher page shows "Contact" section

### Documentation
- [ ] Data model documentation updated in `docs/`
- [ ] Glossary added: User vs Publisher definitions
- [ ] API documentation uses correct terminology

### Testing
- [ ] Backend tests pass: `cd api && go test ./...`
- [ ] Type check passes: `cd web && npm run type-check`
- [ ] Manual UI review: All labels verified correct

### Verification Commands
```bash
# Backend tests
cd api && go test ./...

# Frontend type check
cd web && npm run type-check

# Verify schema (in psql or via migration)
# Check: publishers.contact_email exists (not publishers.email)

# UI audit checklist (manual):
# [ ] /admin/publishers - shows "Contact Email" column
# [ ] /publisher/profile - shows "Contact Email" label
# [ ] Invite user dialog - says "Invite User to [Publisher]"
# [ ] Public publisher page - shows "Contact" section

# Grep for incorrect terminology (should return 0 results):
grep -r "Publisher Email" web/app web/components --include="*.tsx"
grep -r "publisher_email" api/internal --include="*.go"
```

## Estimated Points

3 points (Refactoring - clarification)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-14 | Story drafted for entity separation clarity | Claude Opus 4.5 |
