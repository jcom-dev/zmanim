# Story 8-28: Publisher Signup CAPTCHA Bot Protection - Technical Design

**Status:** Ready for Implementation
**Date:** 2025-12-14
**Priority:** Low (Configuration Only)

---

## Executive Summary

Enable Clerk's built-in bot protection for publisher signup to prevent automated/fraudulent registrations. This is a **configuration-only** change requiring no code modifications.

---

## Solution Overview

### Technology: Clerk + Cloudflare Turnstile

Clerk provides built-in bot protection powered by **Cloudflare Turnstile**. Benefits:
- Zero code changes (dashboard toggle)
- Industry-leading bot detection
- Invisible for 99.9% of legitimate users
- Included free with Clerk

### Why Not Standalone CAPTCHA?

| Aspect | Clerk Built-in | Standalone Turnstile |
|--------|---------------|---------------------|
| Integration | 1-click toggle | SDK integration |
| Code changes | None | Widget + backend validation |
| Cost | Included | Free |
| Technology | Cloudflare Turnstile | Cloudflare Turnstile |
| Maintenance | Managed by Clerk | Self-managed |

**Decision:** Use Clerk's built-in protection since we already use Clerk for auth.

---

## Implementation Steps

### Step 1: Enable Bot Protection (5 minutes)

1. Log into [Clerk Dashboard](https://dashboard.clerk.dev) (production)
2. Navigate to: **Configure** → **Attack protection**
3. Toggle ON: **Bot sign-up protection**
4. Select widget type: **Smart** (recommended)

```
Clerk Dashboard → Configure → Attack protection
├── Bot sign-up protection: [ON] ✓
│   └── Widget type: Smart (recommended)
│       (NOT "Invisible" - deprecated)
```

### Step 2: Enable Email Protection (Optional, 2 minutes)

Recommended to reduce fake accounts:

```
├── Block disposable email domains: [ON] ✓
└── Limit email subaddresses: [ON] ✓
```

### Step 3: Verify SignUp Component (5 minutes)

Check if we use Clerk's `<SignUp />` component or a custom form:

**If using Clerk components (likely):**
No changes needed - bot protection works automatically.

**If using custom signup form:**
Add CAPTCHA container before `signUp.create()`:

```tsx
// File: web/components/onboarding/OnboardingWizard.tsx (if custom)

<div
  id="clerk-captcha"
  data-cl-theme="auto"
  data-cl-size="normal"
  data-cl-language="auto"
/>
```

### Step 4: Test & Document (10 minutes)

1. Test signup flow - should work without visible CAPTCHA
2. Check browser Network tab for Turnstile requests
3. Document settings in team wiki/knowledge base

---

## Technical Details

### How Clerk Bot Protection Works

```
User clicks "Sign Up"
        │
        ▼
┌─────────────────────────┐
│ Clerk evaluates request │
│ (IP, behavior, headers) │
└───────────┬─────────────┘
            │
    ┌───────┴───────┐
    │               │
    ▼               ▼
[Low Risk]      [High Risk]
    │               │
    ▼               ▼
Proceed         Show Turnstile
silently        challenge
```

### Turnstile Widget Types

| Type | Behavior | Recommendation |
|------|----------|----------------|
| **Smart** | Shows challenge only when needed | ✓ Use this |
| Invisible | Never shows UI (deprecated) | ✗ Avoid |
| Interactive | Always shows checkbox | ✗ Overkill |

### Custom Flow Integration (If Needed)

```tsx
// Only if using custom signup form (not <SignUp />)

import { useSignUp } from '@clerk/nextjs';

function CustomSignupForm() {
  const { signUp } = useSignUp();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // CAPTCHA widget must be in DOM before this call
    await signUp.create({
      emailAddress: email,
      password: password,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" ... />
      <input type="password" ... />

      {/* Add this div for bot protection */}
      <div
        id="clerk-captcha"
        data-cl-theme="auto"
        data-cl-size="normal"
      />

      <button type="submit">Sign Up</button>
    </form>
  );
}
```

---

## Verification Checklist

After enabling, verify:

- [ ] Normal signup works without visible CAPTCHA
- [ ] Browser Network tab shows Turnstile requests (cloudflare)
- [ ] Disposable email (temp-mail.org) rejected (if enabled)
- [ ] Email with + subaddress blocked (if enabled)

---

## Limitations

1. **Browser-only** - Won't protect API-only signups
2. **Not supported in:**
   - Expo apps
   - Chrome Extensions
   - Non-browser environments
3. **Requires Clerk** - Won't work if Clerk disabled

---

## Rollback

If issues occur:
1. Toggle OFF "Bot sign-up protection" in Clerk Dashboard
2. Immediate effect (no deploy needed)

---

## Files to Modify

| File | Action |
|------|--------|
| Clerk Dashboard | Enable bot protection |
| `web/components/onboarding/OnboardingWizard.tsx` | Add CAPTCHA div (only if custom form) |

---

## Estimated Effort

| Task | Points |
|------|--------|
| Dashboard configuration | 0.5 |
| Verification | 0.5 |
| Documentation | 1 |
| Total | **2 points** |

---

## References

- [Clerk Bot Protection Docs](https://clerk.com/docs/guides/secure/bot-protection)
- [Clerk Custom Flows - Bot Protection](https://clerk.com/docs/custom-flows/bot-sign-up-protection)
- [Cloudflare Turnstile](https://www.cloudflare.com/application-services/products/turnstile/)
