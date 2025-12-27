# API Reference

Base URL: `http://localhost:8080` (development) | `https://zmanim.fly.dev` (production)

## Overview

The Shtetl Zmanim API provides endpoints for:
- Publisher management (list, retrieve)
- Location lookup
- Zmanim calculation with caching

All API responses are JSON. The API uses standard HTTP status codes.

---

## Health Check

### GET /health

Check API and database health status.

**Response**

```json
{
  "status": "ok",
  "database": "ok",
  "version": "1.0.0"
}
```

**Status Codes**
- `200 OK` - API is healthy
- `503 Service Unavailable` - Database connection issue

---

## Publishers

### GET /api/v1/publishers

List all verified publishers with pagination.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `page_size` | integer | 20 | Items per page (max 100) |
| `region_id` | string | - | Filter by geographic region UUID |

**Response**

```json
{
  "publishers": [
    {
      "id": "uuid",
      "name": "Chief Rabbinate of Israel",
      "description": "Official Jewish legal authority...",
      "website": "https://www.rabbinate.gov.il",
      "contact_email": "info@rabbinate.gov.il",
      "logo_url": null,
      "is_verified": true,
      "subscriber_count": 1250,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

---

### GET /api/v1/publishers/{id}

Get a single publisher by ID.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Publisher UUID |

**Response**

```json
{
  "id": "uuid",
  "name": "Chief Rabbinate of Israel",
  "description": "Official Jewish legal authority...",
  "website": "https://www.rabbinate.gov.il",
  "contact_email": "info@rabbinate.gov.il",
  "logo_url": null,
  "is_verified": true,
  "subscriber_count": 1250,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

**Status Codes**
- `200 OK` - Publisher found
- `400 Bad Request` - Missing publisher ID
- `404 Not Found` - Publisher not found

---

## Locations

### GET /api/v1/locations

Get predefined geographic locations (cities).

**Response**

```json
{
  "locations": [
    {
      "id": "uuid",
      "name": "Jerusalem",
      "latitude": 31.7683,
      "longitude": 35.2137,
      "timezone": "Asia/Jerusalem"
    },
    {
      "id": "uuid",
      "name": "New York",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "timezone": "America/New_York"
    }
  ],
  "total": 10
}
```

---

## Zmanim Calculation

### POST /api/v1/zmanim

Calculate Zmanim for a specific location and date.

**Request Body**

```json
{
  "date": "2024-03-15",
  "latitude": 31.7683,
  "longitude": 35.2137,
  "timezone": "Asia/Jerusalem",
  "publisher_id": "uuid",
  "elevation": 754
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | Yes | Date in YYYY-MM-DD format |
| `latitude` | number | Yes | Latitude (-90 to 90) |
| `longitude` | number | Yes | Longitude (-180 to 180) |
| `timezone` | string | No | IANA timezone (default: UTC) |
| `publisher_id` | string | No | Publisher UUID (uses best match if omitted) |
| `elevation` | integer | No | Elevation in meters |

**Response**

```json
{
  "date": "2024-03-15",
  "location": {
    "name": "31.7683, 35.2137",
    "latitude": 31.7683,
    "longitude": 35.2137,
    "timezone": "Asia/Jerusalem",
    "elevation": 754
  },
  "publisher": {
    "id": "uuid",
    "name": "Chief Rabbinate of Israel",
    "description": "...",
    "website": "https://www.rabbinate.gov.il",
    "contact_email": "info@rabbinate.gov.il",
    "logo_url": null,
    "is_verified": true,
    "subscriber_count": 1250,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  },
  "algorithm": {
    "id": "uuid",
    "publisher_id": "uuid",
    "name": "Standard Israeli Calculation",
    "description": "Standard calculation method...",
    "version": "2.0",
    "configuration": {},
    "is_active": true,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  },
  "zmanim": {
    "alot_hashachar": "05:30:00",
    "misheyakir": "05:45:00",
    "sunrise": "06:15:00",
    "sof_zman_shma_gra": "09:00:00",
    "sof_zman_shma_mga": "08:45:00",
    "sof_zman_tefilla": "10:00:00",
    "chatzot": "12:30:00",
    "mincha_gedola": "13:00:00",
    "mincha_ketana": "15:45:00",
    "plag_hamincha": "17:00:00",
    "sunset": "18:30:00",
    "tzait_hakochavim": "19:00:00",
    "tzait_72": "19:42:00"
  },
  "cached_at": null,
  "calculated_at": "2024-03-15T12:00:00Z"
}
```

**Caching Behavior**
- Results are cached for 24 hours
- Cache key: `(date, latitude, longitude, algorithm_id)` with 0.001 degree tolerance
- `cached_at` field indicates if result was served from cache

**Status Codes**
- `200 OK` - Calculation successful
- `400 Bad Request` - Invalid request parameters
- `500 Internal Server Error` - Calculation or database error

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Bad Request",
  "message": "Invalid latitude: must be between -90 and 90",
  "code": 400
}
```

---

## Rate Limiting

The API includes basic rate limiting infrastructure (configurable via environment):

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_REQUESTS` | 60 | Requests per duration |
| `RATE_LIMIT_DURATION` | 1m | Time window |

---

## CORS Configuration

The API allows cross-origin requests from configured origins:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |

---

## Frontend API Client

The frontend includes a typed API client at `lib/api.ts`:

```typescript
import { api } from '@/lib/api';

// Get publishers
const { publishers, total } = await api.getPublishers({ page: 1, page_size: 20 });

// Get single publisher
const publisher = await api.getPublisher('uuid');

// Get locations
const { locations } = await api.getLocations();

// Calculate zmanim
const response = await api.calculateZmanim({
  date: '2024-03-15',
  latitude: 31.7683,
  longitude: 35.2137,
  timezone: 'Asia/Jerusalem',
  publisher_id: 'uuid'
});
```

---

*Generated by BMAD Document Project Workflow - 2025-11-25*
