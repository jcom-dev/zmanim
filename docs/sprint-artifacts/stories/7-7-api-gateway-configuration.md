# Story 7.7: API Gateway Configuration

Status: review

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

- [x] **Task 1: HTTP API** (AC: 1)
  - [x] 1.1 Define HTTP API in `lib/api-gateway-stack.ts` (separate stack)
  - [x] 1.2 Choose HTTP API over REST API for lower latency
  - [x] 1.3 Configure API name and description
  - [x] 1.4 Set protocol type to HTTP

- [x] **Task 2: EC2 Integration** (AC: 2)
  - [x] 2.1 Create HTTP proxy integration
  - [x] 2.2 Configure integration URI to EC2 Elastic IP:8080
  - [x] 2.3 Create routes for all HTTP methods (`ANY /api/{proxy+}`)
  - [x] 2.4 Configure timeout (29 seconds - max allowed by API Gateway)

- [x] **Task 3: Clerk JWT Authorizer** (AC: 3)
  - [x] 3.1 Create JWT authorizer for Clerk
  - [x] 3.2 Configure issuer URL from Clerk (via SSM Parameter Store)
  - [x] 3.3 Configure audience (Clerk frontend API via SSM Parameter Store)
  - [x] 3.4 Attach authorizer to protected routes (/api/publisher/*, /api/admin/*)
  - [x] 3.5 Leave public routes (`/api/zmanim`, `/api/cities`, `/api/publishers`, `/api/countries`, `/api/health`) without authorizer

- [x] **Task 4: Throttling** (AC: 4)
  - [x] 4.1 Create default stage with throttling
  - [x] 4.2 Set rate limit: 500 requests per second
  - [x] 4.3 Set burst limit: 1000 requests
  - [x] 4.4 Document rate limiting behavior (in stack comments)

- [x] **Task 5: CORS** (AC: 5)
  - [x] 5.1 Configure CORS for API Gateway
  - [x] 5.2 Set allowed origins: `https://zmanim.shtetl.io`
  - [x] 5.3 Set allowed methods: `GET, POST, PUT, DELETE, OPTIONS`
  - [x] 5.4 Set allowed headers: `Authorization, Content-Type, X-Publisher-Id`
  - [x] 5.5 Set expose headers for error responses (`X-Request-Id`, `X-Amzn-RequestId`)

- [x] **Task 6: Access Logging** (AC: 6)
  - [x] 6.1 Create CloudWatch log group for API Gateway
  - [x] 6.2 Configure access log format (JSON)
  - [x] 6.3 Include request ID, method, path, status, latency
  - [x] 6.4 Set log retention (30 days)

- [x] **Task 7: Testing** (AC: 1-6)
  - [x] 7.1 CDK synth succeeds with HTTP API configuration
  - [x] 7.2 CDK tests pass (145 tests total)
  - [x] 7.3 DoD verification tests pass for all ACs
  - [ ] 7.4 Deploy API Gateway to staging (deferred to CI/CD)
  - [ ] 7.5 Test public endpoint access (deferred to CI/CD)
  - [ ] 7.6 Test protected endpoint with valid JWT (deferred to CI/CD)
  - [ ] 7.7 Verify access logs appear in CloudWatch (deferred to CI/CD)

## Definition of Done

**Story is NOT complete until the dev agent has executed ALL of the following verification steps and documented the results:**

### Required Verification Tests

1. **CDK Synthesis for API Gateway**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npm run build && npx cdk synth --all 2>&1 | grep -E "(HttpApi|ApiGateway)" | head -10
   ```
   - [x] Command exits with code 0
   - [x] HTTP API resource exists (not REST API)

2. **HTTP API Type Verification**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth --all 2>&1 | grep -E "(ProtocolType|HTTP)" | head -5
   ```
   - [x] ProtocolType is HTTP (not REST)
   - [x] Confirms lower latency choice

3. **EC2 Integration Verification**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth --all 2>&1 | grep -E "(Integration|HttpUrlIntegration|8080)" | head -10
   ```
   - [x] HTTP proxy integration exists
   - [x] Integration URI points to EC2 Elastic IP:8080

4. **JWT Authorizer Configuration**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth --all 2>&1 | grep -E "(Authorizer|JWT|Clerk|issuer)" | head -10
   ```
   - [x] JWT authorizer resource exists
   - [x] Issuer URL configured (Clerk domain via SSM)
   - [x] Audience configured (via SSM)

5. **Throttling Configuration**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth --all 2>&1 | grep -E "(RateLimit|BurstLimit|Throttl)" | head -10
   ```
   - [x] Rate limit: 500 requests per second
   - [x] Burst limit: 1000 requests

6. **CORS Configuration**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth --all 2>&1 | grep -E "(Cors|AllowOrigins|AllowHeaders|AllowMethods)" | head -15
   ```
   - [x] Allowed origins includes `https://zmanim.shtetl.io`
   - [x] Allowed methods: GET, POST, PUT, DELETE, OPTIONS
   - [x] Allowed headers: Authorization, Content-Type, X-Publisher-Id

7. **Route Configuration**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth --all 2>&1 | grep -E "(Route|/api/)" | head -15
   ```
   - [x] Routes defined for `/api/{proxy+}` or specific paths
   - [x] Public routes (zmanim, cities) without authorizer
   - [x] Protected routes (publisher, admin) with JWT authorizer

8. **CloudWatch Logging**
   ```bash
   cd /home/coder/workspace/zmanim/infrastructure && npx cdk synth --all 2>&1 | grep -E "(LogGroup|AccessLog|RetentionInDays)" | head -10
   ```
   - [x] CloudWatch log group created for API Gateway
   - [x] Log retention configured (30 days)
   - [x] Access logging enabled

### Evidence Required in Dev Agent Record
- CDK synth output showing HTTP API configuration
- JWT authorizer settings
- CORS and throttling configuration
- Route configuration showing public vs protected endpoints

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
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References
- Build and synth: `npm run build && npx cdk synth --all` - SUCCESS
- Test suite: `npm test` - 145 tests passed

### Completion Notes List
- Created new `ApiGatewayStack` in separate file (`lib/api-gateway-stack.ts`) for clean separation of concerns
- HTTP API (not REST) chosen for ~10ms latency vs ~30ms REST, and lower cost ($1/M vs $3.50/M requests)
- JWT authorizer configured to read Clerk domain and audience from SSM Parameter Store (security best practice - no secrets in code)
- Integration timeout set to 29s (max allowed by API Gateway, close to Go API 30s timeout)
- Public routes (zmanim, cities, publishers, countries, health) have no authorizer
- Protected routes (publisher/*, admin/*) require valid Clerk JWT
- Catch-all route `/api/{proxy+}` defaults to requiring authentication
- Added comprehensive CDK test suite covering all ACs (145 tests total pass)

### File List
**Created:**
- `infrastructure/lib/api-gateway-stack.ts` - New API Gateway stack with HTTP API, JWT authorizer, throttling, CORS, logging
- `infrastructure/test/api-gateway-stack.test.ts` - CDK tests for API Gateway configuration

**Modified:**
- `infrastructure/bin/infrastructure.ts` - Added ApiGatewayStack import and instantiation with dependency on ComputeStack

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
| 2025-12-10 | Dev Agent (Claude Opus 4.5) | Implemented API Gateway stack with all ACs met, 145 tests pass |
