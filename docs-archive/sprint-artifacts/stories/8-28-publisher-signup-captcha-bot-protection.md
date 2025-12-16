# Story 8.28: Publisher Signup CAPTCHA Bot Protection

Status: blocked

**Blocker:** This story requires manual Clerk Dashboard configuration by a human admin. No code changes - enable bot protection toggle in Clerk Dashboard → Configure → Attack protection.

## Story

As a platform administrator,
I want CAPTCHA protection on the publisher signup flow,
So that bots cannot create fraudulent publisher accounts and spam the approval queue.

## Context

The publisher registration flow (implemented in Story 2-9) allows anyone to request publisher status. Without bot protection, automated scripts could flood the system with fake registration requests, overwhelming admins and potentially being used for abuse.

**Research Summary:**
Since the platform already uses **Clerk for authentication**, the recommended approach is to enable **Clerk's built-in bot protection**, which uses **Cloudflare Turnstile** under the hood. This provides:
- Zero additional code integration (dashboard toggle)
- Industry-leading bot detection (Cloudflare)
- Invisible for 99.9% of legitimate users
- Only shows challenge when suspicious activity detected
- Free and included with Clerk

**Alternative (if needed for non-Clerk flows):**
Standalone Cloudflare Turnstile integration (~30KB, free unlimited usage, GDPR compliant).

## Acceptance Criteria

1. Clerk bot protection enabled in production environment
2. "Smart" widget type selected (not deprecated "Invisible" type)
3. Suspected bots shown interactive challenge on signup
4. Legitimate users experience no friction (invisible protection)
5. Publisher registration form works correctly with protection enabled
6. Disposable email blocking enabled (optional, recommended)
7. Email subaddress limiting enabled (optional, recommended)

## Tasks / Subtasks

- [ ] Task 1: Enable Clerk Bot Protection
  - [ ] 1.1 Log into Clerk Dashboard (production)
  - [ ] 1.2 Navigate to "Attack protection" section
  - [ ] 1.3 Enable "Bot sign-up protection" toggle
  - [ ] 1.4 Select "Smart" widget type
  - [ ] 1.5 Document settings in team knowledge base
- [ ] Task 2: Additional Email Protection (Recommended)
  - [ ] 2.1 Enable "Block disposable email domains" in Clerk Dashboard
  - [ ] 2.2 Enable "Limit email subaddresses" (block + separator abuse)
- [ ] Task 3: Verify Custom Signup Flow (if applicable)
  - [ ] 3.1 Check if custom signup flow exists (vs Clerk components)
  - [ ] 3.2 If custom: ensure `<div id="clerk-captcha" />` element exists before `signUp.create()`
  - [ ] 3.3 Test custom flow with bot protection enabled
- [ ] Task 4: Testing
  - [ ] 4.1 Manual test: Normal signup flow works without visible CAPTCHA
  - [ ] 4.2 Manual test: Verify protection is active (check network requests for Turnstile)
  - [ ] 4.3 Manual test: Disposable email rejected (if enabled)
  - [ ] 4.4 Document test results

## Dev Notes

### Clerk Dashboard Settings Location
```
Clerk Dashboard → Configure → Attack protection
├── Bot sign-up protection: [ON]
│   └── Widget type: Smart (recommended) | Invisible (deprecated)
├── Block disposable email domains: [ON]
└── Limit email subaddresses: [ON]
```

### Custom Signup Flow Integration
If using custom signup forms (not `<SignUp />` component), add:
```tsx
<div
  id="clerk-captcha"
  data-cl-theme="auto"     // 'light' | 'dark' | 'auto'
  data-cl-size="normal"    // 'normal' | 'flexible' | 'compact'
  data-cl-language="auto"  // 'auto' | 'en-US' | etc.
/>
```
Place this div BEFORE calling `signUp.create()`.

### Limitations
- Clerk bot protection requires browser environment
- Not supported in: Expo, Chrome Extensions, non-browser contexts
- If these apply, disable bot protection for affected environments

### Why Clerk Bot Protection (vs standalone CAPTCHA)
| Aspect | Clerk Built-in | Standalone Turnstile |
|--------|---------------|---------------------|
| Integration | 1-click toggle | SDK integration |
| Code changes | None | Widget + backend validation |
| Cost | Included | Free |
| Technology | Cloudflare Turnstile | Cloudflare Turnstile |
| Maintenance | Managed by Clerk | Self-managed |

### References
- [Clerk Bot Protection Docs](https://clerk.com/docs/guides/secure/bot-protection)
- [Clerk Custom Flows - Bot Protection](https://clerk.com/docs/custom-flows/bot-sign-up-protection)
- [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/)

## References

- **Coding Standards:** [docs/coding-standards.md](../../coding-standards.md) - MUST READ before implementation
- **Global Standards:** [docs/coding-standards-global.md](../../coding-standards-global.md)
- **Context File:** [8-28-publisher-signup-captcha-bot-protection.context.xml](./8-28-publisher-signup-captcha-bot-protection.context.xml)
- **Tech Design:** See "Clerk Dashboard Settings Location" and external references above
- **External Docs:** [Clerk Bot Protection](https://clerk.com/docs/guides/secure/bot-protection)

## Definition of Done (DoD)

**All items must be checked before marking story "Ready for Review":**

### Configuration
- [ ] Clerk bot protection enabled in production Clerk Dashboard
- [ ] "Smart" widget type selected (not deprecated "Invisible")
- [ ] Disposable email blocking enabled (recommended)
- [ ] Email subaddress limiting enabled (recommended)

### Testing
- [ ] Manual test: Normal signup flow works without visible CAPTCHA
- [ ] Manual test: Verify Turnstile is active (check network requests to `challenges.cloudflare.com`)
- [ ] Manual test: Disposable email (e.g., `test@mailinator.com`) is rejected
- [ ] Manual test: Publisher registration form completes successfully
- [ ] If custom signup flow: `<div id="clerk-captcha" />` element verified

### Documentation
- [ ] Settings documented in team knowledge base or internal docs
- [ ] Screenshot of Clerk Dashboard settings saved

### Verification Steps
```bash
# 1. Check Clerk Dashboard settings (manual)
# Navigate to: Clerk Dashboard → Configure → Attack protection
# Verify: Bot sign-up protection = ON, Widget type = Smart

# 2. Test signup flow (manual in browser)
# Open: https://zmanim.shtetl.io/sign-up
# Complete signup with valid email
# Verify: No CAPTCHA shown for normal flow

# 3. Verify Turnstile is loading (browser DevTools)
# Open Network tab, filter by "cloudflare"
# Expected: Request to challenges.cloudflare.com

# 4. Test disposable email blocking (manual)
# Try signup with: test@mailinator.com
# Expected: Email rejected with error message
```

## Estimated Points

2 points (Configuration - Low Complexity)

## Dependencies

- Clerk account with dashboard access
- Production environment access

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-14 | Story drafted based on CAPTCHA research | Claude Opus 4.5 |
