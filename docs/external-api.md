# External API Reference

**Last Updated:** 2025-12-25

## Overview

The Shtetl Zmanim External API provides programmatic access to zmanim calculations for machine-to-machine (M2M) integrations. This API uses Clerk M2M tokens for authentication, allowing backend services to securely access zmanim data without user interaction.

## Table of Contents

- [Authentication](#authentication)
- [Using the External API](#using-the-external-api)
- [Rate Limiting](#rate-limiting)
- [Error Responses](#error-responses)
- [Available Endpoints](#available-endpoints)
- [Best Practices](#best-practices)
- [Support](#support)
- [Changelog](#changelog)

## Authentication

### M2M Token Overview

M2M (Machine-to-Machine) tokens are JWT tokens issued by Clerk specifically for backend-to-backend communication. Unlike user JWTs, M2M tokens:

- Do not represent a specific user
- Contain a `client_id` in the subject claim
- Do not have user metadata (roles, publisher access, etc.)
- Are intended for server-to-server authentication

### Creating M2M Tokens in Clerk

1. **Access Clerk Dashboard**
   - Navigate to https://dashboard.clerk.com
   - Select your Shtetl Zmanim application

2. **Create M2M Application**
   - Go to "JWT Templates" or "API Keys" section
   - Click "Create M2M Application"
   - Provide a name (e.g., "Production Integration", "Partner X API")
   - Note the generated `client_id` and `client_secret`

3. **Generate Token**
   - Use the Clerk API or SDK to generate tokens programmatically
   - Tokens are time-limited (default: 1 hour)
   - Token format: `Bearer <jwt_token>`

### Token Generation Example

```bash
# Using Clerk API to generate M2M token
curl -X POST "https://api.clerk.com/v1/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "your_client_id",
    "client_secret": "your_client_secret",
    "grant_type": "client_credentials"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## Using the External API

### Base URL

```
Production: https://zmanim.shtetl.io/api/v1/external
Development: http://localhost:8080/api/v1/external
```

### Authentication Header

All requests to `/api/v1/external/*` endpoints must include:

```
Authorization: Bearer <m2m_token>
```

### Example Request

```bash
# Health check endpoint
curl -X GET "https://zmanim.shtetl.io/api/v1/external/health" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Response:
```json
{
  "data": {
    "status": "ok",
    "message": "External API is available",
    "client_id": "your_client_id"
  },
  "meta": {
    "timestamp": "2025-12-13T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

## Rate Limiting

All external API endpoints are rate-limited to prevent abuse and ensure fair usage. The platform uses a dual-bucket token system with both per-minute and per-hour limits.

### Rate Limit Headers

Every response includes rate limit information. The headers reflect the most restrictive limit (whichever has fewer remaining requests):

```
X-RateLimit-Limit: 10              # Requests allowed per window (minute or hour)
X-RateLimit-Remaining: 8           # Requests remaining in current window
X-RateLimit-Reset: 1735128600      # Unix timestamp when limit resets
```

### Default Limits

Rate limits are applied per `client_id` using a token bucket algorithm:

| Window | Requests Allowed |
|--------|------------------|
| Per Minute | 10 |
| Per Hour | 100 |

**How it works:**
- Both limits must be satisfied for a request to succeed
- If either limit is exceeded, the request is rejected with HTTP 429
- Limits reset at the end of each time window
- Headers always show the most restrictive limit

**Need higher limits?** Contact support with your use case.

### Rate Limit Exceeded Response

When either rate limit is exceeded, you'll receive:

**Status:** `429 Too Many Requests`

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please wait 45 seconds.",
  "retry_after": 45
}
```

**Headers:**
```
Retry-After: 45                    # Seconds to wait before retrying
X-RateLimit-Limit: 10              # The limit that was exceeded
X-RateLimit-Remaining: 0           # No requests remaining
X-RateLimit-Reset: 1735128645      # Unix timestamp when limit resets
```

### Rate Limiter Failure

If the rate limiting service is unavailable, requests will be rejected for security:

**Status:** `503 Service Unavailable`

```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limiter temporarily unavailable: connection refused",
  "retry_after": 60
}
```

This "fail closed" behavior ensures the API remains protected even during infrastructure issues.

## Error Responses

### 401 Unauthorized

Missing or invalid M2M token:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing M2M token"
  }
}
```

### User Token Rejection

Attempting to use a user JWT instead of M2M token:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User tokens are not accepted for external API. Please use M2M tokens."
  }
}
```

## Available Endpoints

### Health Check

**Endpoint:** `GET /api/v1/external/health`
**Authentication:** Required (M2M token)
**Rate Limit:** Yes

Returns API health status and authenticated client ID.

### List Publisher Zmanim

**Endpoint:** `GET /api/v1/external/publishers/{id}/zmanim`
**Authentication:** Required (M2M token)
**Rate Limit:** Yes
**Caching:** 1 hour (3600 seconds)

Returns all enabled zmanim for a specific publisher with formula metadata.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Publisher ID |

#### Example Request

```bash
curl -X GET "https://zmanim.shtetl.io/api/v1/external/publishers/2/zmanim" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Response

```json
{
  "data": {
    "publisher_id": "2",
    "publisher_name": "Chabad Lubavitch",
    "zmanim": [
      {
        "zman_key": "alos_hashachar",
        "master_zman_id": "1",
        "english_name": "Dawn",
        "hebrew_name": "עלות השחר",
        "version_id": "v1",
        "formula_type": "fixed_offset",
        "formula_summary": "Sunrise - 72 minutes"
      },
      {
        "zman_key": "sunrise",
        "master_zman_id": "5",
        "english_name": "Sunrise",
        "hebrew_name": "הנץ החמה",
        "version_id": "v1",
        "formula_type": "solar_primitive",
        "formula_summary": "Solar primitive: sunrise"
      }
    ],
    "total": 2,
    "generated_at": "2025-12-25T10:30:00Z"
  },
  "meta": {
    "timestamp": "2025-12-25T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `publisher_id` | string | Publisher ID |
| `publisher_name` | string | Publisher display name |
| `zmanim` | array | Array of zman objects |
| `zmanim[].zman_key` | string | Unique zman identifier |
| `zmanim[].master_zman_id` | string | Master registry ID (if linked) |
| `zmanim[].english_name` | string | English display name |
| `zmanim[].hebrew_name` | string | Hebrew display name |
| `zmanim[].version_id` | string | Formula version identifier |
| `zmanim[].formula_type` | string | Type: `fixed_offset`, `solar_primitive`, `custom_dsl` |
| `zmanim[].formula_summary` | string | Human-readable formula description |
| `total` | integer | Total number of zmanim |
| `generated_at` | string | ISO 8601 timestamp |

#### Error Responses

**400 Bad Request** - Invalid publisher ID format
**404 Not Found** - Publisher not found or has no enabled zmanim

### Calculate Bulk Zmanim

**Endpoint:** `POST /api/v1/external/zmanim/calculate`
**Authentication:** Required (M2M token)
**Rate Limit:** Yes
**Max Date Range:** 365 days

Calculates zmanim for multiple days in a single request.

#### Request Body

```json
{
  "publisher_id": "2",
  "locality_id": 5128581,
  "date_range": {
    "start": "2025-12-20",
    "end": "2025-12-27"
  },
  "zmanim": [
    {
      "zman_key": "alos_hashachar",
      "version_id": "v1"
    },
    {
      "zman_key": "sunrise"
    }
  ]
}
```

#### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `publisher_id` | string | Yes | Publisher ID |
| `locality_id` | integer | Yes | Geographic locality ID (from `/localities` endpoint) |
| `date_range.start` | string | Yes | Start date (YYYY-MM-DD) |
| `date_range.end` | string | Yes | End date (YYYY-MM-DD) |
| `zmanim` | array | Yes | Array of zmanim to calculate |
| `zmanim[].zman_key` | string | Yes | Zman key from publisher's enabled zmanim |
| `zmanim[].version_id` | string | No | Formula version (optional) |

#### Example Request

```bash
curl -X POST "https://zmanim.shtetl.io/api/v1/external/zmanim/calculate" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "publisher_id": "2",
    "locality_id": 5128581,
    "date_range": {
      "start": "2025-12-20",
      "end": "2025-12-27"
    },
    "zmanim": [
      {"zman_key": "alos_hashachar"},
      {"zman_key": "sunrise"}
    ]
  }'
```

#### Response

```json
{
  "data": {
    "publisher_id": "2",
    "location": {
      "locality_id": "5128581",
      "locality_name": "New York",
      "country": "United States",
      "country_code": "US",
      "display_hierarchy": "New York, NY, United States",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "elevation": 0,
      "timezone": "America/New_York"
    },
    "results": [
      {
        "zman_key": "alos_hashachar",
        "version_id": "v1",
        "times": {
          "2025-12-20": "05:45:00",
          "2025-12-21": "05:46:00",
          "2025-12-22": "05:46:00",
          "2025-12-23": "05:47:00",
          "2025-12-24": "05:47:00",
          "2025-12-25": "05:48:00",
          "2025-12-26": "05:48:00",
          "2025-12-27": "05:49:00"
        }
      },
      {
        "zman_key": "sunrise",
        "version_id": "v1",
        "times": {
          "2025-12-20": "07:17:00",
          "2025-12-21": "07:18:00",
          "2025-12-22": "07:18:00",
          "2025-12-23": "07:19:00",
          "2025-12-24": "07:19:00",
          "2025-12-25": "07:20:00",
          "2025-12-26": "07:20:00",
          "2025-12-27": "07:21:00"
        }
      }
    ],
    "date_range": {
      "start": "2025-12-20",
      "end": "2025-12-27",
      "days": 8
    },
    "cached": false,
    "calculation_time_ms": 142,
    "generated_at": "2025-12-25T10:30:00Z"
  },
  "meta": {
    "timestamp": "2025-12-25T10:30:00Z",
    "request_id": "req_xyz789"
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `publisher_id` | string | Publisher ID from request |
| `location` | object | Geographic location details |
| `location.locality_id` | string | Locality ID |
| `location.locality_name` | string | Locality display name |
| `location.timezone` | string | IANA timezone identifier |
| `results` | array | Array of zman results |
| `results[].zman_key` | string | Zman identifier |
| `results[].version_id` | string | Formula version used |
| `results[].times` | object | Map of date→time (HH:MM:SS in local timezone) |
| `date_range.days` | integer | Total days calculated |
| `calculation_time_ms` | integer | Server processing time in milliseconds |

#### Validation Rules

- Date range cannot exceed 365 days
- All `zman_key` values must exist in publisher's enabled zmanim
- `locality_id` must be valid and exist in the database
- Dates must be in YYYY-MM-DD format
- `end` date must be after `start` date

## Best Practices

### 1. Token Security

- **Never** commit tokens to version control
- Store tokens in environment variables or secret management systems
- Rotate tokens regularly
- Use different tokens for development and production

### 2. Token Refresh

M2M tokens expire after 1 hour (default). Implement token refresh logic:

```javascript
// Example token refresh logic
let cachedToken = null;
let tokenExpiry = null;

async function getValidToken() {
  const now = Date.now();

  // Refresh if token is expired or about to expire (5 min buffer)
  if (!cachedToken || tokenExpiry - now < 300000) {
    const response = await fetch('https://api.clerk.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.CLERK_M2M_CLIENT_ID,
        client_secret: process.env.CLERK_M2M_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in * 1000);
  }

  return cachedToken;
}
```

### 3. Rate Limit Handling

Monitor rate limit headers and implement backoff:

```javascript
async function makeApiRequest(url, options = {}) {
  const token = await getValidToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  // Check rate limit headers
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
  const reset = parseInt(response.headers.get('X-RateLimit-Reset'));

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After'));
    console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
    // Implement exponential backoff or wait for reset
    throw new Error(`Rate limit exceeded. Retry after ${retryAfter}s`);
  }

  // Warn when approaching limit (10% remaining)
  const limit = parseInt(response.headers.get('X-RateLimit-Limit'));
  if (remaining < limit * 0.1) {
    console.warn(`Approaching rate limit: ${remaining}/${limit} remaining`);
  }

  return response.json();
}
```

### 4. Error Handling

Always check response status and handle errors gracefully:

```javascript
try {
  const data = await makeApiRequest('https://zmanim.shtetl.io/api/v1/external/health');
  console.log('API Status:', data.data.status);
} catch (error) {
  if (error.message.includes('Rate limit')) {
    // Handle rate limit error
  } else if (error.message.includes('Unauthorized')) {
    // Refresh token and retry
  } else {
    // Handle other errors
  }
}
```

## Support

For questions, issues, or to request higher rate limits:

- **Email:** support@zmanim.com
- **Documentation:** https://docs.zmanim.com
- **Status Page:** https://status.zmanim.com

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-25 | Initial stable release with M2M authentication, publisher zmanim listing, bulk calculations, and dual-bucket rate limiting |
