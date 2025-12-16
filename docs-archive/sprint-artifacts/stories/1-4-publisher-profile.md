# Story 1.4: Publisher Profile

Status: review

## Story

As a **publisher**,
I want **to manage my profile information**,
so that **end users can identify and trust my organization**.

## Acceptance Criteria

1. Publisher can view their current profile information
2. Publisher can update name, organization, website, contact email, bio
3. Publisher can upload logo image
4. Logo appears on publisher cards when users view zmanim
5. Required fields show inline validation errors

## Tasks / Subtasks

- [x] Task 1: Extend publishers table for profile fields (AC: 2, 3)
  - [x] 1.1 Add migration for website, logo_url, bio columns
  - [x] 1.2 Run database migration

- [x] Task 2: Implement publisher profile API (AC: 1, 2)
  - [x] 2.1 Create api/internal/handlers/publishers.go
  - [x] 2.2 GET /api/publisher/profile - get own profile
  - [x] 2.3 PUT /api/publisher/profile - update profile
  - [x] 2.4 Validate required fields server-side

- [x] Task 3: Implement logo upload (AC: 3)
  - [x] 3.1 Configure Xata | Shared dev DBStorage bucket for logos
  - [x] 3.2 POST /api/publisher/logo - upload logo
  - [x] 3.3 Return logo_url after upload
  - [x] 3.4 Validate file type and size

- [x] Task 4: Create publisher profile page (AC: 1, 2, 5)
  - [x] 4.1 Create web/app/publisher/profile/page.tsx
  - [x] 4.2 Use react-hook-form with shadcn/ui Form
  - [x] 4.3 Display current profile data
  - [x] 4.4 Inline validation errors for required fields
  - [x] 4.5 Success/error toast on save

- [x] Task 5: Create logo upload component (AC: 3)
  - [x] 5.1 Create web/components/publisher/LogoUpload.tsx
  - [x] 5.2 Preview current logo
  - [x] 5.3 File picker with drag-drop support
  - [x] 5.4 Upload progress indicator

- [x] Task 6: Create PublisherCard component (AC: 4)
  - [x] 6.1 Create web/components/shared/PublisherCard.tsx
  - [x] 6.2 Display name, organization, logo
  - [x] 6.3 Handle missing logo gracefully (placeholder)

## Dev Notes

### Architecture Patterns

- **Form Handling:** react-hook-form + zod validation
- **File Storage:** Xata | Shared dev DBStorage with public bucket
- **Image Optimization:** Consider next/image for logo display

### Source Tree Components

```
web/app/publisher/
  └── profile/
      └── page.tsx
web/components/
  ├── publisher/
  │   └── LogoUpload.tsx
  └── shared/
      └── PublisherCard.tsx
api/internal/handlers/
  └── publishers.go
```

### Profile Fields

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| name | Yes | string | Display name |
| organization | No | string | Organization/synagogue |
| email | Yes | string | Contact email |
| website | No | string | URL |
| bio | No | string | Description |
| logo_url | No | string | Xata | Shared dev DBStorage URL |

### References

- [Source: docs/architecture.md#Data-Model]
- [Source: docs/epics.md#Story-1.4-Publisher-Profile]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Story-1.4]
- [Source: docs/ux-design-specification.md#Publisher-Components]

## Dev Agent Record

### Context Reference
None (proceeded with story file only)

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References
- All 6 tasks found already implemented in codebase
- Database schema: `db/migrations/20240001_initial_schema.sql` + `20240003_update_publishers_for_admin.sql`
- Backend handlers: `api/internal/handlers/handlers.go` (GetPublisherProfile, UpdatePublisherProfile)
- Upload handler: `api/internal/handlers/upload.go` (UploadPublisherLogo)
- Frontend page: `web/app/publisher/profile/page.tsx`
- Logo component: `web/components/publisher/LogoUpload.tsx`
- Publisher card: `web/components/shared/PublisherCard.tsx`
- Fixed TypeScript error: Changed `title` to `aria-label` on CheckCircle icon in PublisherCard
- Created E2E tests: `web/tests/publisher-profile.spec.ts`

### Completion Notes List
- All acceptance criteria satisfied by existing implementation
- AC1: GET /api/v1/publisher/profile endpoint returns current profile
- AC2: PUT /api/v1/publisher/profile updates name, organization, website, email, bio
- AC3: POST /api/v1/publisher/logo handles logo upload with validation (5MB, JPEG/PNG/WebP)
- AC4: PublisherCard component displays name, organization, logo with placeholder fallback
- AC5: Profile page shows asterisk (*) on required fields, inline validation errors
- Go API builds successfully
- Web app builds successfully
- E2E tests created for publisher profile feature

### File List
- `db/migrations/20240001_initial_schema.sql` - Initial schema with website, logo_url columns
- `db/migrations/20240003_update_publishers_for_admin.sql` - Added bio column, clerk_user_id
- `api/internal/handlers/handlers.go` - GetPublisherProfile, UpdatePublisherProfile handlers
- `api/internal/handlers/upload.go` - UploadPublisherLogo handler with Xata | Shared dev DBStorage
- `api/internal/models/models.go` - Publisher model with all profile fields
- `api/cmd/api/main.go` - Routes: GET/PUT /api/v1/publisher/profile, POST /api/v1/publisher/logo
- `web/app/publisher/profile/page.tsx` - Profile page with form and validation
- `web/components/publisher/LogoUpload.tsx` - Logo upload with drag-drop and progress
- `web/components/shared/PublisherCard.tsx` - Publisher card with logo/placeholder (fixed TypeScript error)
- `web/tests/publisher-profile.spec.ts` - E2E tests for publisher profile feature (created)
