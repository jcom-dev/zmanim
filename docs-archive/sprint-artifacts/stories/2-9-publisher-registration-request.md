# Story 2.9: Publisher Registration Request

**Epic:** Epic 2 - Publisher User Management & Dashboard
**Status:** Drafted
**Priority:** Medium
**Sprint Change:** Added 2025-11-26

---

## User Story

**As a** potential publisher,
**I want** to submit a registration request with my details,
**So that** I can become a publisher on Shtetl Zmanim after admin approval.

---

## Acceptance Criteria

### AC1: Public Registration Page
**Given** I am not logged in or logged in as a regular user
**When** I navigate to `/become-publisher`
**Then** I see a registration form with fields:
  - Name (required)
  - Organization (required)
  - Email address (required)
  - Website (optional)
  - Description/About (required, textarea)

### AC2: Form Validation
**Given** I am filling out the registration form
**When** I leave required fields empty
**Then** I see inline validation errors
**And** the form cannot be submitted

**Given** I enter an invalid email format
**When** I try to submit
**Then** I see an email validation error

### AC3: Successful Submission
**Given** I fill in all required fields correctly
**When** I submit the form
**Then** I see a confirmation message: "Thank you! Your request has been submitted. We'll review it and get back to you soon."
**And** my request is stored with status "pending"
**And** the form resets or redirects to home

### AC4: Admin Pending Requests View
**Given** I am an admin viewing `/admin/publishers`
**When** I look at the page
**Then** I see a "Pending Requests" section
**And** I see a badge with the count of pending requests
**And** I can click to expand/view the list

### AC5: Admin Request Details
**Given** I am an admin viewing pending requests
**When** I click on a request
**Then** I see full details: name, organization, email, website, description, submitted date
**And** I see "Approve" and "Reject" buttons

### AC6: Approve Request
**Given** I am an admin viewing a pending request
**When** I click "Approve"
**Then** a publisher account is created with the submitted details
**And** an approval email is sent via Resend
**And** the request status changes to "approved"
**And** the request moves out of pending list
**And** I see a success toast

### AC7: Reject Request
**Given** I am an admin viewing a pending request
**When** I click "Reject"
**Then** I can optionally enter a rejection reason
**And** the request status changes to "rejected"
**And** a rejection email is sent via Resend (if configured)
**And** the request moves out of pending list

### AC8: Duplicate Prevention
**Given** a request already exists for an email
**When** someone submits another request with the same email
**Then** they see a message: "A request for this email is already pending or has been processed."

---

## Technical Notes

### New Files

```
web/app/become-publisher/page.tsx           # Public registration form
web/components/admin/PendingRequests.tsx    # Admin pending requests section
api/internal/handlers/publisher_requests.go  # Request handlers
api/internal/models/publisher_request.go     # Request model
```

### Database Schema

```sql
CREATE TABLE publisher_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    organization TEXT NOT NULL,
    email TEXT NOT NULL,
    website TEXT,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    rejection_reason TEXT,
    reviewed_by TEXT, -- admin clerk_user_id
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_publisher_requests_status ON publisher_requests(status);
CREATE UNIQUE INDEX idx_publisher_requests_email_pending
    ON publisher_requests(email) WHERE status = 'pending';
```

### API Endpoints

```
# Public
POST /api/publisher-requests
Body: {
    "name": "Rabbi Smith",
    "organization": "Congregation Beth Israel",
    "email": "rabbi@bethisrael.org",
    "website": "https://bethisrael.org",
    "description": "We serve the Jewish community of Springfield..."
}
Response: { "success": true, "message": "Request submitted successfully" }

# Admin
GET /api/admin/publisher-requests
Query: ?status=pending (optional, defaults to pending)
Response: {
    "data": [
        {
            "id": "uuid",
            "name": "Rabbi Smith",
            "organization": "Congregation Beth Israel",
            "email": "rabbi@bethisrael.org",
            "website": "https://bethisrael.org",
            "description": "...",
            "status": "pending",
            "created_at": "2025-11-26T10:00:00Z"
        }
    ],
    "meta": { "total": 5, "pending": 3 }
}

POST /api/admin/publisher-requests/{id}/approve
Response: {
    "success": true,
    "publisher_id": "new-publisher-uuid",
    "message": "Publisher account created and welcome email sent"
}

POST /api/admin/publisher-requests/{id}/reject
Body: { "reason": "Insufficient information provided" } (optional)
Response: { "success": true, "message": "Request rejected" }
```

### Frontend Components

```tsx
// web/app/become-publisher/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BecomePublisherPage() {
    const [formData, setFormData] = useState({
        name: "",
        organization: "",
        email: "",
        website: "",
        description: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Form implementation...
}
```

### Integration with Email Service

On approval:
```go
emailService.SendPublisherApproved(
    request.Email,
    request.Name,
    "https://zmanim.com/publisher",
)
```

On rejection (if reason provided):
```go
emailService.SendPublisherRejected(
    request.Email,
    request.Name,
    rejectionReason,
)
```

---

## Dependencies

- Story 2.11: Email Service Integration (Resend)

## Dependent Stories

- None

---

## Definition of Done

- [ ] Public `/become-publisher` page implemented
- [ ] Form validation (client and server side)
- [ ] Database table and migrations created
- [ ] API endpoints implemented with proper auth
- [ ] Admin pending requests section in `/admin/publishers`
- [ ] Approve flow creates publisher + sends email
- [ ] Reject flow updates status + sends email
- [ ] Duplicate email prevention
- [ ] Toast notifications for admin actions
- [ ] Mobile responsive form

---

## FRs Covered

| FR | Description |
|----|-------------|
| FR55 | User can submit publisher registration request |
| FR56 | Admin can view pending publisher requests |
| FR57 | Admin can approve/reject publisher requests |

---

_Sprint Change Addition: 2025-11-26_
