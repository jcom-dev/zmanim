# Story 7.7: API Gateway Configuration

Status: ready-for-dev

## Story

As a **developer**,
I want **API Gateway routing requests to EC2**,
So that **I get request logging, throttling, and Clerk JWT validation**.

## Acceptance Criteria

1. **AC1:** HTTP API (not REST - lower latency) created
2. **AC2:** Integration proxies to EC2 Elastic IP
3. **AC3:** Clerk JWT authorizer configured
4. **AC4:** Throttling limits set (500 rps, 1000 burst)
5. **AC5:** CORS configured for frontend domain
6. **AC6:** Access logs sent to CloudWatch

## Tasks / Subtasks

- [ ] **Task 1: HTTP API** (AC: 1)
  - [ ] 1.1 Define HTTP API in `lib/cdn-stack.ts` (or separate stack)
  - [ ] 1.2 Choose HTTP API over REST API for lower latency
  - [ ] 1.3 Configure API name and description
  - [ ] 1.4 Set protocol type to HTTP

- [ ] **Task 2: EC2 Integration** (AC: 2)
  - [ ] 2.1 Create HTTP proxy integration
  - [ ] 2.2 Configure integration URI to EC2 Elastic IP:8080
  - [ ] 2.3 Create routes for all HTTP methods (`ANY /api/{proxy+}`)
  - [ ] 2.4 Configure timeout (30 seconds)

- [ ] **Task 3: Clerk JWT Authorizer** (AC: 3)
  - [ ] 3.1 Create JWT authorizer for Clerk
  - [ ] 3.2 Configure issuer URL from Clerk
  - [ ] 3.3 Configure audience (Clerk frontend API)
  - [ ] 3.4 Attach authorizer to protected routes
  - [ ] 3.5 Leave public routes (`/api/zmanim`, `/api/cities`) without authorizer

- [ ] **Task 4: Throttling** (AC: 4)
  - [ ] 4.1 Create default stage with throttling
  - [ ] 4.2 Set rate limit: 500 requests per second
  - [ ] 4.3 Set burst limit: 1000 requests
  - [ ] 4.4 Document rate limiting behavior

- [ ] **Task 5: CORS** (AC: 5)
  - [ ] 5.1 Configure CORS for API Gateway
  - [ ] 5.2 Set allowed origins: `https://zmanim.shtetl.io`
  - [ ] 5.3 Set allowed methods: `GET, POST, PUT, DELETE, OPTIONS`
  - [ ] 5.4 Set allowed headers: `Authorization, Content-Type, X-Publisher-Id`
  - [ ] 5.5 Set expose headers for error responses

- [ ] **Task 6: Access Logging** (AC: 6)
  - [ ] 6.1 Create CloudWatch log group for API Gateway
  - [ ] 6.2 Configure access log format (JSON)
  - [ ] 6.3 Include request ID, method, path, status, latency
  - [ ] 6.4 Set log retention (30 days)

- [ ] **Task 7: Testing** (AC: 1-6)
  - [ ] 7.1 Deploy API Gateway to staging
  - [ ] 7.2 Test public endpoint access (no auth)
  - [ ] 7.3 Test protected endpoint with valid JWT
  - [ ] 7.4 Test protected endpoint without JWT (401)
  - [ ] 7.5 Test throttling limits
  - [ ] 7.6 Verify CORS headers in responses
  - [ ] 7.7 Verify access logs appear in CloudWatch

## Dev Notes

### Architecture Alignment

This story implements the **API routing layer** between CloudFront and EC2:

**Why HTTP API (not REST API):**
| Feature | HTTP API | REST API |
|---------|----------|----------|
| Latency | ~10ms | ~30ms |
| Cost | $1/million | $3.50/million |
| JWT Auth | Built-in | Custom authorizer |
| Features | Basic | Full (caching, WAF) |

For our use case, HTTP API is sufficient and faster.

**Request Flow:**
```
CloudFront → API Gateway HTTP API
                ↓
           JWT Authorizer (for /api/publisher/*, /api/admin/*)
                ↓
           HTTP Proxy → EC2:8080
```

### Route Configuration

| Route | Authorizer | Purpose |
|-------|------------|---------|
| `GET /api/zmanim/*` | None (public) | Zmanim calculations |
| `GET /api/cities/*` | None (public) | City search |
| `GET /api/publishers` | None (public) | Publisher listing |
| `ANY /api/publisher/*` | Clerk JWT | Publisher management |
| `ANY /api/admin/*` | Clerk JWT | Admin operations |

### Clerk JWT Configuration

```typescript
const jwtAuthorizer = new HttpJwtAuthorizer('ClerkAuthorizer',
  `https://${clerkDomain}`,
  {
    jwtAudience: [clerkFrontendApi],
    identitySource: ['$request.header.Authorization'],
  }
);
```

**Clerk JWT Structure:**
```json
{
  "iss": "https://clerk.your-domain.com",
  "sub": "user_xxx",
  "aud": ["your-frontend-api"],
  "exp": 1234567890,
  "iat": 1234567890,
  "metadata": {
    "role": "publisher",
    "publisherId": 123
  }
}
```

### CDK Implementation Pattern

```typescript
// lib/cdn-stack.ts (or api-gateway-stack.ts)
const httpApi = new apigatewayv2.HttpApi(this, 'ZmanimApi', {
  apiName: 'zmanim-api',
  corsPreflight: {
    allowOrigins: ['https://zmanim.shtetl.io'],
    allowMethods: [
      apigatewayv2.CorsHttpMethod.GET,
      apigatewayv2.CorsHttpMethod.POST,
      apigatewayv2.CorsHttpMethod.PUT,
      apigatewayv2.CorsHttpMethod.DELETE,
      apigatewayv2.CorsHttpMethod.OPTIONS,
    ],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Publisher-Id'],
  },
  defaultThrottling: {
    rateLimit: 500,
    burstLimit: 1000,
  },
});

// EC2 integration
const ec2Integration = new integrations.HttpUrlIntegration(
  'EC2Integration',
  `http://${elasticIp}:8080/{proxy}`,
);

// Routes
httpApi.addRoutes({
  path: '/api/{proxy+}',
  methods: [apigatewayv2.HttpMethod.ANY],
  integration: ec2Integration,
  authorizer: jwtAuthorizer,  // Only for protected routes
});
```

### References

- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Story-7.7]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Story-7.7]
- [Source: docs/architecture.md#Authentication-Flow]

## Dev Agent Record

### Context Reference
- [Story Context XML](./7-7-api-gateway-configuration.context.xml)

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
