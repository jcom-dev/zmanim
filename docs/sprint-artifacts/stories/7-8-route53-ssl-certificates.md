# Story 7.8: Route 53 & SSL Certificates

Status: ready-for-dev

## Story

As a **developer**,
I want **DNS and SSL configured**,
So that **zmanim.shtetl.io serves over HTTPS with trusted certificates**.

## Acceptance Criteria

1. **AC1:** ACM certificate requested for zmanim.shtetl.io
2. **AC2:** DNS validation configured
3. **AC3:** A record alias points to CloudFront
4. **AC4:** Health check monitors `/health` endpoint

## Tasks / Subtasks

- [ ] **Task 1: ACM Certificate** (AC: 1)
  - [ ] 1.1 Define ACM certificate in `lib/dns-stack.ts`
  - [ ] 1.2 Request certificate for `zmanim.shtetl.io`
  - [ ] 1.3 Request certificate in us-east-1 (required for CloudFront)
  - [ ] 1.4 Configure wildcard if needed (`*.zmanim.shtetl.io`)

- [ ] **Task 2: DNS Validation** (AC: 2)
  - [ ] 2.1 Choose validation method (DNS or Email)
  - [ ] 2.2 If Route 53 hosted zone: create CNAME validation records
  - [ ] 2.3 If external DNS: document manual validation steps
  - [ ] 2.4 Wait for certificate validation (CDK waits automatically)

- [ ] **Task 3: Route 53 Configuration** (AC: 3)
  - [ ] 3.1 Create or import hosted zone for shtetl.io
  - [ ] 3.2 Create A record alias for zmanim.shtetl.io
  - [ ] 3.3 Point alias to CloudFront distribution
  - [ ] 3.4 Configure TTL (300 seconds recommended)

- [ ] **Task 4: Health Check** (AC: 4)
  - [ ] 4.1 Create Route 53 health check
  - [ ] 4.2 Configure check for `https://zmanim.shtetl.io/api/health`
  - [ ] 4.3 Set check interval (30 seconds)
  - [ ] 4.4 Configure failure threshold (3 consecutive failures)
  - [ ] 4.5 Create CloudWatch alarm for health check failures

- [ ] **Task 5: External DNS Option** (AC: 2, 3)
  - [ ] 5.1 Document alternative for external DNS providers
  - [ ] 5.2 Provide CNAME record instructions
  - [ ] 5.3 Document ACM email validation if DNS validation not possible

- [ ] **Task 6: Testing** (AC: 1-4)
  - [ ] 6.1 Verify certificate is issued and valid
  - [ ] 6.2 Test DNS resolution from multiple locations
  - [ ] 6.3 Verify HTTPS works with valid certificate
  - [ ] 6.4 Test health check triggers on endpoint failure
  - [ ] 6.5 Verify alarm notification works

## Dev Notes

### Architecture Alignment

This story implements the **DNS and SSL layer** for production:

**DNS Architecture:**
```
User types: zmanim.shtetl.io
            ↓
Route 53 (or external DNS)
            ↓
A record alias → CloudFront distribution
            ↓
CloudFront serves response with ACM SSL certificate
```

**Certificate Requirement:**
ACM certificates for CloudFront MUST be created in **us-east-1** (N. Virginia), regardless of the distribution's origin region.

### Certificate Options

| Domain | Coverage |
|--------|----------|
| `zmanim.shtetl.io` | Production domain only |
| `*.shtetl.io` + `shtetl.io` | Wildcard (future-proof) |

Recommend: Request single domain certificate to start, add wildcard later if needed.

### Route 53 vs External DNS

**Option 1: Route 53 Hosted Zone**
- Full CDK automation
- Automatic certificate validation
- Native CloudFront alias support
- Cost: $0.50/month per hosted zone

**Option 2: External DNS (Cloudflare, etc.)**
- Manual CNAME record creation
- Email or manual DNS validation for ACM
- CNAME flattening may be needed for apex domain
- No additional AWS cost

### CDK Implementation Pattern

```typescript
// lib/dns-stack.ts

// Certificate in us-east-1 (required for CloudFront)
const certificate = new acm.Certificate(this, 'ZmanimCert', {
  domainName: 'zmanim.shtetl.io',
  validation: acm.CertificateValidation.fromDns(hostedZone),
});

// Route 53 hosted zone (create or import)
const hostedZone = route53.HostedZone.fromLookup(this, 'ShtetlZone', {
  domainName: 'shtetl.io',
});

// A record alias to CloudFront
new route53.ARecord(this, 'ZmanimAlias', {
  zone: hostedZone,
  recordName: 'zmanim',
  target: route53.RecordTarget.fromAlias(
    new targets.CloudFrontTarget(distribution)
  ),
});

// Health check
const healthCheck = new route53.CfnHealthCheck(this, 'ZmanimHealthCheck', {
  healthCheckConfig: {
    type: 'HTTPS',
    fullyQualifiedDomainName: 'zmanim.shtetl.io',
    resourcePath: '/api/health',
    requestInterval: 30,
    failureThreshold: 3,
  },
});
```

### Cross-Region Certificate

For CloudFront, the certificate must be in us-east-1. CDK handles this with:

```typescript
const certificate = new acm.DnsValidatedCertificate(this, 'Cert', {
  domainName: 'zmanim.shtetl.io',
  hostedZone: hostedZone,
  region: 'us-east-1',  // Required for CloudFront
});
```

### Health Check Endpoint

The Go API should expose `/api/health`:
```go
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
    // Check PostgreSQL
    // Check Redis
    RespondJSON(w, r, http.StatusOK, map[string]string{"status": "healthy"})
}
```

### References

- [Source: docs/sprint-artifacts/epic-7-aws-migration.md#Story-7.8]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Story-7.8]
- [Source: docs/sprint-artifacts/tech-spec-epic-7.md#Reliability/Availability]

## Dev Agent Record

### Context Reference

- [Story Context XML](./7-8-route53-ssl-certificates.context.xml)

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-12-10 | SM Agent | Story drafted from Epic 7 tech spec |
