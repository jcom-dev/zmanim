# Story 7.6: CloudFront Distribution

Status: ready-for-dev

## Story

As a **developer**,
I want **CloudFront CDN in front of API and static assets**,
So that **US/Israel users get fast edge-cached responses**.

## Acceptance Criteria

1. **AC1:** CloudFront distribution created with Origin Shield (eu-west-1)
2. **AC2:** Origin 1: API Gateway (dynamic, 1hr cache)
3. **AC3:** Origin 2: S3 (static, 1yr cache)
4. **AC4:** Behaviors route `/api/*` → API Gateway, `/*` → S3
5. **AC5:** HTTPS only with HTTP redirect
6. **AC6:** Custom domain: zmanim.shtetl.io

## Tasks / Subtasks

- [ ] **Task 1: CloudFront Distribution** (AC: 1)
  - [ ] 1.1 Define CloudFront distribution in `lib/cdn-stack.ts`
  - [ ] 1.2 Enable Origin Shield in eu-west-1
  - [ ] 1.3 Configure price class (US, EU, Israel edges)
  - [ ] 1.4 Set default root object to `index.html`

- [ ] **Task 2: API Gateway Origin** (AC: 2)
  - [ ] 2.1 Create origin for API Gateway endpoint
  - [ ] 2.2 Configure origin protocol HTTPS only
  - [ ] 2.3 Create cache policy: 1 hour TTL for `/api/zmanim/*`
  - [ ] 2.4 Create cache policy: no cache for auth endpoints
  - [ ] 2.5 Configure origin request policy (forward headers)

- [ ] **Task 3: S3 Static Origin** (AC: 3)
  - [ ] 3.1 Create S3 origin with OAI (Origin Access Identity)
  - [ ] 3.2 Configure cache policy: 1 year TTL for `/_next/static/*`
  - [ ] 3.3 Configure cache policy: 1 day for HTML files
  - [ ] 3.4 Enable compression (gzip, brotli)

- [ ] **Task 4: Behaviors** (AC: 4)
  - [ ] 4.1 Create behavior `/api/*` → API Gateway origin
  - [ ] 4.2 Create behavior `/_next/static/*` → S3 (long cache)
  - [ ] 4.3 Create behavior `/*` (default) → S3
  - [ ] 4.4 Configure SPA routing function for client-side routes

- [ ] **Task 5: HTTPS Configuration** (AC: 5)
  - [ ] 5.1 Configure viewer protocol policy: redirect-to-https
  - [ ] 5.2 Set minimum protocol version TLSv1.2
  - [ ] 5.3 Configure security headers (HSTS, X-Frame-Options)

- [ ] **Task 6: Custom Domain** (AC: 6)
  - [ ] 6.1 Reference ACM certificate from DNS stack
  - [ ] 6.2 Configure alternate domain name (CNAME)
  - [ ] 6.3 Export distribution domain for Route53 alias

- [ ] **Task 7: SPA Routing Function** (AC: 4)
  - [ ] 7.1 Create CloudFront Function for client-side routing
  - [ ] 7.2 Rewrite requests without extension to `/index.html`
  - [ ] 7.3 Associate function with default behavior

- [ ] **Task 8: Testing** (AC: 1-6)
  - [ ] 8.1 Deploy distribution to staging
  - [ ] 8.2 Test API routing through CloudFront
  - [ ] 8.3 Test static asset caching
  - [ ] 8.4 Verify cache hit ratios in CloudWatch
  - [ ] 8.5 Test from US and Israel locations
  - [ ] 8.6 Verify HTTPS redirect works

## Dev Notes

### Architecture Alignment

This story implements the **CDN layer** providing:
- **Global edge caching** for US and Israel users
- **Origin Shield** to reduce origin load
- **SSL termination** with custom domain

**Request Flow:**
```
User → CloudFront Edge (cache check)
     ↓ (cache miss)
CloudFront → Origin Shield eu-west-1 (regional cache)
     ↓ (cache miss)
Origin Shield → API Gateway or S3
     ↓
Response → Cache at Origin Shield → Cache at Edge → User
```

**Cache Hit Ratio Target:** >80% for zmanim calculations (same date/location repeated)

### Behavior Configuration

| Path Pattern | Origin | Cache TTL | Notes |
|--------------|--------|-----------|-------|
| `/api/zmanim/*` | API Gateway | 1 hour | Zmanim calculations (cacheable) |
| `/api/*` | API Gateway | 0 (no cache) | Auth, mutations |
| `/_next/static/*` | S3 | 1 year | Immutable hashed assets |
| `/*.html` | S3 | 1 day | HTML pages (SPA) |
| `/*` (default) | S3 | 1 day | Other static files |

### CloudFront Function (SPA Routing)

```javascript
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // If no file extension and not /api/, serve index.html
  if (!uri.includes('.') && !uri.startsWith('/api/')) {
    request.uri = '/index.html';
  }

  return request;
}
```

### CDK Implementation Pattern

```typescript
// lib/cdn-stack.ts
const distribution = new cloudfront.Distribution(this, 'ZmanimCDN', {
  defaultBehavior: {
    origin: new origins.S3Origin(staticBucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    functionAssociations: [{
      function: spaRoutingFunction,
      eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
    }],
  },
  additionalBehaviors: {
    '/api/*': {
      origin: new origins.HttpOrigin(apiGatewayDomain),
      cachePolicy: apiCachePolicy,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    },
  },
  domainNames: ['zmanim.shtetl.io'],
  certificate: certificate,
  enableLogging: true,
  priceClass: cloudfront.PriceClass.PRICE_CLASS_100,  // US, EU, Israel
});
```

### References

- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Story-7.6]
- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Frontend-Deployment]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Story-7.6]

## Dev Agent Record

### Context Reference

[Story Context XML](./7-6-cloudfront-distribution.context.xml)

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
