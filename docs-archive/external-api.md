# External API - M2M Authentication Guide

**Story:** 8-4
**Status:** Active
**Last Updated:** 2025-12-13

## Overview

The Shtetl Zmanim External API provides programmatic access to zmanim calculations for machine-to-machine (M2M) integrations. This API uses Clerk M2M tokens for authentication, allowing backend services to securely access zmanim data without user interaction.

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

All external API endpoints are rate-limited to prevent abuse and ensure fair usage.

### Rate Limit Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 10000          # Total requests allowed per hour
X-RateLimit-Remaining: 9847       # Requests remaining in current window
X-RateLimit-Reset: 3245           # Seconds until limit resets
```

### Default Limits

| Client Type | Requests per Hour |
|-------------|-------------------|
| M2M Token   | 10,000            |

**Note:** Rate limits are per `client_id`. If you need higher limits, contact support.

### Rate Limit Exceeded Response

When rate limit is exceeded, you'll receive:

**Status:** `429 Too Many Requests`

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 10000,
      "retry_after_seconds": 3245
    }
  },
  "meta": {
    "timestamp": "2025-12-13T10:30:00Z",
    "request_id": "req_xyz789"
  }
}
```

Headers:
```
Retry-After: 3245  # Seconds to wait before retrying
```

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

### Future Endpoints (Coming Soon)

The following endpoints are planned for upcoming stories:

- **Story 8-5:** `GET /external/publishers` - List all active publishers
- **Story 8-5:** `GET /external/publishers/{id}/zmanim` - Get publisher zmanim list
- **Story 8-6:** `POST /external/zmanim/bulk` - Bulk zmanim calculation

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

| Date | Change |
|------|--------|
| 2025-12-13 | Initial M2M authentication documentation (Story 8-4) |
