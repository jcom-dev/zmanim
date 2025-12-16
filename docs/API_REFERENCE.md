# API Reference

REST API documentation for Shtetl Zmanim.

**Base URL:** `http://localhost:8080/api/v1` (dev) | `https://zmanim.shtetl.io/backend/api/v1` (prod)

**Swagger UI:** http://localhost:8080/swagger/index.html

---

## Authentication

### Bearer Token (JWT)

All authenticated endpoints require a Clerk JWT token:

```bash
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Publisher Context

Publisher endpoints also require the `X-Publisher-Id` header:

```bash
X-Publisher-Id: 1
```

The API validates that the authenticated user has access to this publisher.

### Access Levels

| Level | Headers Required | Description |
|-------|------------------|-------------|
| Public | None | No authentication |
| Auth | `Authorization` | Signed-in user |
| Publisher | `Authorization` + `X-Publisher-Id` | Publisher member |
| Admin | `Authorization` (admin role) | Admin user |

---

## Response Format

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "request_id": "abc123"
  }
}
```

### Error Response

```json
{
  "error": {
    "message": "Validation failed",
    "details": {
      "field": "Reason for error"
    }
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z",
    "request_id": "abc123"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No content (successful delete) |
| 400 | Bad request / validation error |
| 401 | Not authenticated |
| 403 | Not authorized |
| 404 | Not found |
| 500 | Internal server error |

---

## Public Endpoints

### Health Check

```
GET /health
```

Returns API health status.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

---

### List Publishers

```
GET /publishers
```

Returns all active publishers.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `include_global` | boolean | Include global publishers (default: true) |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Young Israel",
      "slug": "young-israel",
      "is_global": false,
      "is_verified": true
    }
  ]
}
```

---

### Get Publisher

```
GET /publishers/{id}
```

Returns a single publisher by ID.

**Response:**
```json
{
  "data": {
    "id": 1,
    "name": "Young Israel",
    "slug": "young-israel",
    "description": "Community synagogue",
    "is_global": false,
    "is_verified": true,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### Get Zmanim

```
GET /zmanim
```

Calculate zmanim for a publisher and location.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `publisher_id` | integer | Yes | Publisher ID |
| `locality_id` | integer | Yes | City/locality ID |
| `date` | string | No | Date (YYYY-MM-DD, default: today) |
| `include_disabled` | boolean | No | Include disabled zmanim |

**Response:**
```json
{
  "data": {
    "zmanim": [
      {
        "key": "alos_hashachar",
        "hebrew_name": "עלות השחר",
        "english_name": "Dawn",
        "time": "05:42:00",
        "formula_dsl": "solar(16.1, before_sunrise)",
        "category": "morning"
      }
    ],
    "locality": {
      "id": 123,
      "name": "Jerusalem",
      "country": "Israel",
      "timezone": "Asia/Jerusalem"
    },
    "date": "2025-01-15",
    "hebrew_date": "15 Teves 5785"
  }
}
```

---

### Search Localities

```
GET /localities/search
```

Search for cities/localities by name.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Search query (min 2 chars) |
| `limit` | integer | No | Max results (default: 20) |

**Response:**
```json
{
  "data": [
    {
      "id": 293397,
      "name": "Jerusalem",
      "region": "Jerusalem District",
      "country": "Israel",
      "country_code": "IL",
      "latitude": 31.7683,
      "longitude": 35.2137,
      "timezone": "Asia/Jerusalem",
      "population": 936425
    }
  ]
}
```

---

### Get Locality

```
GET /localities/{id}
```

Get locality details by ID.

**Response:**
```json
{
  "data": {
    "id": 293397,
    "name": "Jerusalem",
    "region": "Jerusalem District",
    "country": "Israel",
    "country_code": "IL",
    "latitude": 31.7683,
    "longitude": 35.2137,
    "timezone": "Asia/Jerusalem",
    "population": 936425
  }
}
```

---

### List Countries

```
GET /countries
```

Returns all countries.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Israel",
      "iso_code": "IL",
      "continent": "Asia"
    }
  ]
}
```

---

### List Regions

```
GET /regions
```

Returns regions for a country.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `country_id` | integer | Yes | Country ID |

---

### Get Master Registry

```
GET /master-zmanim
```

Returns the master zmanim registry.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "key": "alos_hashachar",
      "hebrew_name": "עלות השחר",
      "english_name": "Dawn",
      "category": "morning",
      "default_formula": "solar(16.1, before_sunrise)",
      "documentation": "..."
    }
  ]
}
```

---

## Publisher Endpoints

All require `Authorization` and `X-Publisher-Id` headers.

### Get Publisher Profile

```
GET /publisher/profile
```

Returns the current publisher's profile.

---

### Update Publisher Profile

```
PUT /publisher/profile
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

---

### List Publisher Zmanim

```
GET /publisher/zmanim
```

Returns all zmanim for the publisher.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `include_disabled` | boolean | Include disabled zmanim |
| `include_deleted` | boolean | Include soft-deleted (admin only) |

**Response:**
```json
{
  "data": [
    {
      "id": 42,
      "key": "alos_hashachar",
      "hebrew_name": "עלות השחר",
      "english_name": "Dawn",
      "formula_dsl": "solar(16.1, before_sunrise)",
      "is_enabled": true,
      "is_published": true,
      "sort_order": 1,
      "master_zman_id": 1,
      "linked_publisher_zman_id": null
    }
  ]
}
```

---

### Create Publisher Zman

```
POST /publisher/zmanim
```

**Request Body:**
```json
{
  "master_zman_id": 1,
  "key": "alos_hashachar",
  "hebrew_name": "עלות השחר",
  "english_name": "Dawn",
  "formula_dsl": "solar(16.1, before_sunrise)",
  "is_enabled": true,
  "is_published": false
}
```

---

### Update Publisher Zman

```
PUT /publisher/zmanim/{id}
```

**Request Body:**
```json
{
  "hebrew_name": "Updated Name",
  "formula_dsl": "sunset - 18min",
  "is_enabled": true,
  "is_published": true
}
```

---

### Delete Publisher Zman

```
DELETE /publisher/zmanim/{id}
```

Soft-deletes the zman.

---

### Preview Formula

```
POST /publisher/zmanim/preview
```

Calculate a formula without saving.

**Request Body:**
```json
{
  "formula_dsl": "sunset - 18min",
  "locality_id": 293397,
  "date": "2025-01-15"
}
```

**Response:**
```json
{
  "data": {
    "time": "16:42:00",
    "valid": true
  }
}
```

---

### Preview Week

```
POST /publisher/zmanim/preview-week
```

Calculate a formula for a week.

**Request Body:**
```json
{
  "formula_dsl": "sunset - 18min",
  "locality_id": 293397,
  "start_date": "2025-01-15"
}
```

**Response:**
```json
{
  "data": [
    { "date": "2025-01-15", "time": "16:42:00" },
    { "date": "2025-01-16", "time": "16:43:00" },
    ...
  ]
}
```

---

### Validate DSL

```
POST /publisher/dsl/validate
```

Validate a DSL formula syntax.

**Request Body:**
```json
{
  "formula_dsl": "sunset - 18min"
}
```

**Response:**
```json
{
  "data": {
    "valid": true,
    "error": null
  }
}
```

---

### List Coverage

```
GET /publisher/coverage
```

Returns the publisher's geographic coverage areas.

---

### Add Coverage

```
POST /publisher/coverage
```

**Request Body:**
```json
{
  "coverage_level": "city",
  "coverage_id": 293397
}
```

---

### Remove Coverage

```
DELETE /publisher/coverage/{id}
```

---

### List Team Members

```
GET /publisher/team
```

Returns team members for the publisher.

---

### Invite Team Member

```
POST /publisher/team/invite
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "editor"
}
```

---

### Remove Team Member

```
DELETE /publisher/team/{user_id}
```

---

### List Correction Requests

```
GET /publisher/correction-requests
```

Returns correction requests for the publisher.

---

### Respond to Correction Request

```
PUT /publisher/correction-requests/{id}
```

**Request Body:**
```json
{
  "status": "accepted",
  "response": "Thank you, we've updated the formula."
}
```

---

### Get Activity Log

```
GET /publisher/activity
```

Returns audit log for the publisher.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `action` | string | Filter by action type |
| `entity_type` | string | Filter by entity type |

---

### Create Snapshot

```
POST /publisher/snapshots
```

Creates a backup snapshot of the publisher's data.

---

### List Snapshots

```
GET /publisher/snapshots
```

Returns all snapshots for the publisher.

---

### Export Data

```
GET /publisher/export
```

Exports all publisher data as JSON.

---

## Admin Endpoints

All require `Authorization` header with admin role.

### Get Admin Stats

```
GET /admin/stats
```

Returns platform statistics.

**Response:**
```json
{
  "data": {
    "total_publishers": 42,
    "total_users": 156,
    "total_zmanim": 1234,
    "total_localities": 4000000
  }
}
```

---

### List All Publishers (Admin)

```
GET /admin/publishers
```

Returns all publishers including inactive.

---

### Update Publisher Status (Admin)

```
PUT /admin/publishers/{id}/status
```

**Request Body:**
```json
{
  "status": "verified"
}
```

---

### List All Users (Admin)

```
GET /admin/users
```

Returns all platform users.

---

### List All Correction Requests (Admin)

```
GET /admin/correction-requests
```

Returns all correction requests across publishers.

---

### Update Master Registry (Admin)

```
PUT /admin/master-zmanim/{id}
```

Updates a master registry entry.

---

## Webhook Endpoints

### Clerk Webhook

```
POST /webhooks/clerk
```

Receives Clerk user events (user.created, user.updated, etc.).

---

## DSL Endpoints

### Get DSL Reference

```
GET /dsl/reference
```

Returns DSL function documentation.

---

### AI Formula Suggestion

```
POST /dsl/ai-suggest
```

Get AI-generated formula suggestions.

**Request Body:**
```json
{
  "description": "18 minutes before sunset",
  "context": "candle lighting"
}
```

---

## Rate Limiting

- **Public endpoints:** 100 requests/minute per IP
- **Authenticated endpoints:** 1000 requests/minute per user
- **Calculation endpoints:** 50 requests/minute per publisher

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312800
```

---

## Error Handling

### Validation Errors (400)

```json
{
  "error": {
    "message": "Validation failed",
    "details": {
      "formula_dsl": "Invalid syntax at position 15",
      "locality_id": "Locality not found"
    }
  }
}
```

### Authentication Errors (401)

```json
{
  "error": {
    "message": "Authentication required"
  }
}
```

### Authorization Errors (403)

```json
{
  "error": {
    "message": "You do not have access to this publisher"
  }
}
```

### Not Found (404)

```json
{
  "error": {
    "message": "Zman not found"
  }
}
```

### Internal Errors (500)

```json
{
  "error": {
    "message": "An internal error occurred"
  }
}
```

Note: Internal errors never expose stack traces or database details.

---

## Testing with cURL

### Public Endpoint

```bash
curl -s http://localhost:8080/api/v1/publishers | jq '.'
```

### Authenticated Endpoint

```bash
# Get token first
source api/.env && node scripts/get-test-token.js

# Use token (paste full token, don't use variables)
curl -s -H "Authorization: Bearer eyJhbG..." \
     -H "X-Publisher-Id: 2" \
     http://localhost:8080/api/v1/publisher/profile | jq '.'
```

### POST Request

```bash
curl -s -X POST \
     -H "Authorization: Bearer eyJhbG..." \
     -H "X-Publisher-Id: 2" \
     -H "Content-Type: application/json" \
     -d '{"formula_dsl":"sunset - 18min","locality_id":293397}' \
     http://localhost:8080/api/v1/publisher/zmanim/preview | jq '.'
```

---

## Client Libraries

### Frontend (TypeScript)

```typescript
import { useApi } from '@/lib/api-client';

const api = useApi();

// Publisher endpoints (Auth + X-Publisher-Id)
const profile = await api.get<Profile>('/publisher/profile');

// Public endpoints (no auth)
const publishers = await api.public.get<Publisher[]>('/publishers');

// Admin endpoints (Auth only, admin role)
const stats = await api.admin.get<Stats>('/admin/stats');
```

### React Query Hooks

```typescript
import { usePublisherQuery, usePublisherMutation } from '@/lib/hooks';

// Query
const { data, isLoading } = usePublisherQuery<Zman[]>(
  'zmanim-list',
  '/publisher/zmanim'
);

// Mutation
const mutation = usePublisherMutation<Zman, CreateRequest>(
  '/publisher/zmanim',
  'POST',
  { invalidateKeys: ['zmanim-list'] }
);
```
